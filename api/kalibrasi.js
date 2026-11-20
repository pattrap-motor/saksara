// api/kalibrasi.js — Saksara (versi Vercel)
//
// Menyimpan SATU kiriman kalibrasi sukarela sebagai baris baru pada tab
// "Kalibrasi" di Google Sheet yang sama dengan api/simpan-hasil.js.
// Yang disimpan hanya METRIK STATISTIK (skor heuristik, skor classifier,
// skor akhir, tujuh nilai sinyal, jumlah kata/kalimat, persentase kalimat
// terindikasi) plus label penilaian pengguna sendiri ("manusia"/"ai"/"ragu").
// Isi teks/dokumen yang dianalisis TIDAK pernah diterima endpoint ini:
// permintaan yang membawa kolom teks apa pun DITOLAK (400).
//
// Tanpa dependensi npm: token OAuth ditukar langsung ke endpoint Google.
//
// Variabel lingkungan yang wajib ada di Vercel (Settings → Environment Variables):
//   GOOGLE_CLIENT_ID      — OAuth client ID dari Google Cloud Console
//   GOOGLE_CLIENT_SECRET  — OAuth client secret
//   GOOGLE_REFRESH_TOKEN  — refresh token pemilik Drive (dari OAuth Playground)
//   HASIL_SHEET_ID        — ID Google Sheet tujuan (dari URL Sheet)

const SHEET_RANGE = 'Kalibrasi!A:P';

// Kolom teks yang TIDAK boleh ada: endpoint ini tidak menerima isi dokumen.
const FORBIDDEN_FIELDS = ['text', 'content', 'excerpt', 'teks', 'isi', 'dokumen', 'document'];

// Tujuh sinyal heuristik, urutan sama seperti yang ditampilkan situs
// (analyze() → burst, vocab, frasa, stilometri, markdown, symmetry, repetition).
const SIGNAL_KEYS = ['burstiness', 'kosakata', 'frasa', 'stilometri', 'markdown', 'simetri', 'pengulangan'];

const USER_LABELS = ['manusia', 'ai', 'ragu'];

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

function str(v, maxLen) {
  return (typeof v === 'string' ? v : '').slice(0, maxLen);
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
// Hanya NAMA kolom yang dicatat ke log — tidak pernah nilainya.
function validate(body) {
  for (const f of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      console.error('kalibrasi ditolak: kolom teks tidak diizinkan', f);
      return 'Endpoint ini tidak menerima isi teks dokumen';
    }
  }
  if (!isScore(body.heur)) return 'Kolom heur harus berupa angka 0–1';
  if (!(body.clf === null || body.clf === undefined || isScore(body.clf))) {
    return 'Kolom clf harus berupa angka 0–1 atau null';
  }
  if (!isScore(body.final)) return 'Kolom final harus berupa angka 0–1';
  if (!isScore(body.sentPct)) return 'Kolom sentPct harus berupa angka 0–1';
  const s = body.signals;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'Kolom signals harus berupa objek';
  for (const k of SIGNAL_KEYS) {
    if (!isScore(s[k])) return 'Sinyal ' + k + ' harus berupa angka 0–1';
  }
  if (!isCount(body.words)) return 'Kolom words harus berupa bilangan bulat ≥ 0';
  if (!isCount(body.sentences)) return 'Kolom sentences harus berupa bilangan bulat ≥ 0';
  if (!USER_LABELS.includes(body.userLabel)) return 'Kolom userLabel tidak dikenal';
  if (typeof body.engine !== 'string' || body.engine.trim().length === 0) {
    return 'Kolom engine harus berupa teks';
  }
  return null;
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
  // Urutan kolom A:P pada tab "Kalibrasi":
  // waktu, mesin, label pengguna, skor akhir, heuristik, classifier,
  // 7 sinyal (burstiness, kosakata, frasa, stilometri, markdown, simetri,
  // pengulangan), jumlah kata, jumlah kalimat, % kalimat terindikasi.
  const row = [
    waktu,
    str(body.engine, 300),
    body.userLabel,
    round4(body.final),
    round4(body.heur),
    (body.clf === null || body.clf === undefined) ? '' : round4(body.clf),
    round4(body.signals.burstiness),
    round4(body.signals.kosakata),
    round4(body.signals.frasa),
    round4(body.signals.stilometri),
    round4(body.signals.markdown),
    round4(body.signals.simetri),
    round4(body.signals.pengulangan),
    body.words,
    body.sentences,
    round4(body.sentPct)
  ];
  try {
    const token = await getAccessToken();
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId)
      + '/values/' + encodeURIComponent(SHEET_RANGE)
      + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('Sheets append gagal', r.status, t.slice(0, 300));
      return json(res, 502, { ok: false, error: 'Google Sheets menolak penyimpanan' });
    }
    return json(res, 200, { ok: true, waktu });
  } catch (e) {
    console.error('kalibrasi error', e && e.message);
    return json(res, 500, { ok: false, error: (e && e.message) || 'Gagal menyimpan kalibrasi' });
  }
}
