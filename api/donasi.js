// api/donasi.js — Saksara (versi Vercel)
//
// Menyimpan SATU sumbangan teks sukarela sebagai baris baru pada tab
// "Donasi" di Google Sheet yang sama dengan api/kalibrasi.js.
// BERBEDA dari endpoint kalibrasi: endpoint ini SENGAJA menerima isi teks —
// hanya bila pengunjung sendiri memilih label teks ("manusia"/"ai"),
// mencentang persetujuan eksplisit (consent === true), lalu menekan tombol
// sumbang di halaman laporan. Inilah satu-satunya jalur yang menerima teks;
// analisis itu sendiri tetap 100% lokal di peramban pengunjung.
//
// Baris yang disimpan (7 kolom A:G pada tab "Donasi"):
//   waktu, label, jumlah kata, skor akhir, skor heuristik, skor classifier
//   (kosong bila tidak ada), dan isi teks — teks SELALU di kolom terakhir.
// Bila tab "Donasi" belum ada, tab dibuat (dengan baris judul) lalu append
// dicoba sekali lagi.
//
// Append memakai valueInputOption=RAW (bukan USER_ENTERED) agar teks
// sumbangan yang diawali "=" atau "+" tidak pernah ditafsirkan Google
// Sheets sebagai rumus.
//
// Tanpa dependensi npm: token OAuth ditukar langsung ke endpoint Google.
//
// Variabel lingkungan yang wajib ada di Vercel (Settings → Environment Variables):
//   GOOGLE_CLIENT_ID      — OAuth client ID dari Google Cloud Console
//   GOOGLE_CLIENT_SECRET  — OAuth client secret
//   GOOGLE_REFRESH_TOKEN  — refresh token pemilik Drive (dari OAuth Playground)
//   HASIL_SHEET_ID        — ID Google Sheet tujuan (dari URL Sheet)

const SHEET_RANGE = 'Donasi!A:G';
const DONASI_HEADERS = ['Waktu', 'Label', 'Jumlah Kata', 'Skor Akhir', 'Skor Heuristik', 'Skor Classifier', 'Teks'];

const DONATION_LABELS = ['manusia', 'ai'];
const TEXT_MIN_CHARS = 200;
const TEXT_MAX_CHARS = 45000;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(obj));
}

async function getAccessToken() {
  const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const GOOGLE_REFRESH_TOKEN = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Konfigurasi Google belum lengkap di server');
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    // Catat alasan ASLI dari Google (tanpa membocorkan kredensial apa pun)
    // agar kegagalan token bisa didiagnosis dari log Vercel.
    console.error('Token Google ditolak', r.status, JSON.stringify(data).slice(0, 300));
    throw new Error('Gagal memperoleh akses ke Google Drive');
  }
  return data.access_token;
}

function isScore(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1;
}

function isCount(v) {
  return typeof v === 'number' && isFinite(v) && Number.isInteger(v) && v >= 0;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Cap waktu ISO dengan zona Asia/Jakarta (UTC+7 sepanjang tahun, tanpa DST).
function jakartaTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second + '+07:00';
}

// Memvalidasi isi permintaan. Mengembalikan pesan kesalahan (string) atau null.
// Isi teks TIDAK pernah dicatat ke log — hanya nama kolom/pelanggaran aturan.
function validate(body) {
  if (body.consent !== true) return 'Persetujuan (consent) wajib bernilai true';
  if (!DONATION_LABELS.includes(body.label)) return 'Kolom label harus "manusia" atau "ai"';
  if (typeof body.text !== 'string') return 'Kolom text harus berupa teks';
  if (body.text.length < TEXT_MIN_CHARS) return 'Teks terlalu pendek (min. ' + TEXT_MIN_CHARS + ' karakter)';
  if (body.text.length > TEXT_MAX_CHARS) return 'Teks terlalu panjang (maks. ' + TEXT_MAX_CHARS + ' karakter)';
  if (!isCount(body.words)) return 'Kolom words harus berupa bilangan bulat ≥ 0';
  if (!isScore(body.final)) return 'Kolom final harus berupa angka 0–1';
  if (!isScore(body.heur)) return 'Kolom heur harus berupa angka 0–1';
  if (!(body.clf === null || body.clf === undefined || isScore(body.clf))) {
    return 'Kolom clf harus berupa angka 0–1 atau null';
  }
  return null;
}

async function appendRow(token, sheetId, row) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId)
    + '/values/' + encodeURIComponent(SHEET_RANGE)
    + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] })
  });
}

// Membuat tab "Donasi" (dengan baris judul) bila belum ada. Mengembalikan
// true bila tab dapat dipastikan ada sesudahnya (baru dibuat, atau memang
// sudah ada), false bila pembuatan gagal karena alasan lain.
async function ensureDonasiTab(token, sheetId) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId);
  const r = await fetch(base + ':batchUpdate', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Donasi' } } }] })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (/already exists/i.test(t)) return true; // tab memang sudah ada
    console.error('donasi: buat tab gagal', r.status, t.slice(0, 300));
    return false;
  }
  const h = await fetch(base + '/values/' + encodeURIComponent('Donasi!A1:G1') + '?valueInputOption=RAW', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [DONASI_HEADERS] })
  });
  if (!h.ok) {
    const t = await h.text().catch(() => '');
    console.error('donasi: tulis judul tab gagal', h.status, t.slice(0, 300));
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Metode tidak diizinkan' });
  }
  const sheetId = (process.env.HASIL_SHEET_ID || '').trim();
  if (!sheetId) {
    return json(res, 500, { ok: false, error: 'Konfigurasi server belum lengkap (HASIL_SHEET_ID)' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(res, 400, { ok: false, error: 'Isi permintaan tidak valid' });
  }
  const invalid = validate(body);
  if (invalid) {
    return json(res, 400, { ok: false, error: invalid });
  }
  const waktu = jakartaTimestamp();
  // Urutan kolom A:G pada tab "Donasi":
  // waktu, label, jumlah kata, skor akhir, skor heuristik, skor classifier,
  // teks (selalu terakhir).
  const row = [
    waktu,
    body.label,
    body.words,
    round4(body.final),
    round4(body.heur),
    (body.clf === null || body.clf === undefined) ? '' : round4(body.clf),
    body.text
  ];
  try {
    const token = await getAccessToken();
    let r = await appendRow(token, sheetId, row);
    if (!r.ok) {
      // Kemungkinan paling umum: tab "Donasi" belum ada. Buat tab-nya
      // (dengan judul), lalu coba append tepat satu kali lagi.
      const firstErr = await r.text().catch(() => '');
      console.error('Sheets append donasi gagal, mencoba membuat tab', r.status, firstErr.slice(0, 300));
      if (await ensureDonasiTab(token, sheetId)) {
        r = await appendRow(token, sheetId, row);
      }
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('Sheets append donasi gagal', r.status, t.slice(0, 300));
      return json(res, 502, { ok: false, error: 'Google Sheets menolak penyimpanan' });
    }
    return json(res, 200, { ok: true, waktu });
  } catch (e) {
    console.error('donasi error', e && e.message);
    return json(res, 500, { ok: false, error: (e && e.message) || 'Gagal menyimpan sumbangan' });
  }
}
