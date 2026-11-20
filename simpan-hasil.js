// api/simpan-hasil.js — VeritasAI (versi Vercel)
//
// Menyimpan SATU hasil analisis sebagai baris baru pada Google Sheet
// "VeritasAI — Hasil Analisis" yang tersimpan di Google Drive pemilik situs.
// Yang disimpan hanya HASIL (skor, vonis, rincian sinyal, nama berkas sumber,
// jumlah kata/kalimat). Isi teks/dokumen yang dianalisis TIDAK pernah dikirim
// ke endpoint ini dan tidak disimpan.
//
// Tanpa dependensi npm: token OAuth ditukar langsung ke endpoint Google.
//
// Variabel lingkungan yang wajib ada di Vercel (Settings → Environment Variables):
//   GOOGLE_CLIENT_ID      — OAuth client ID dari Google Cloud Console
//   GOOGLE_CLIENT_SECRET  — OAuth client secret
//   GOOGLE_REFRESH_TOKEN  — refresh token pemilik Drive (dari OAuth Playground)
//   HASIL_SHEET_ID        — ID Google Sheet tujuan (dari URL Sheet)

const SHEET_RANGE = 'Hasil!A:P';

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(obj));
}

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
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
    throw new Error('Gagal memperoleh akses ke Google Drive');
  }
  return data.access_token;
}

function num(v, min, max) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n)) return '';
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

function str(v, maxLen) {
  return (typeof v === 'string' ? v : '').slice(0, maxLen);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Metode tidak diizinkan' });
  }
  const sheetId = process.env.HASIL_SHEET_ID;
  if (!sheetId) {
    return json(res, 500, { ok: false, error: 'Konfigurasi server belum lengkap (HASIL_SHEET_ID)' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return json(res, 400, { ok: false, error: 'Isi permintaan tidak valid' });
  }
  const s = (body.sinyal && typeof body.sinyal === 'object') ? body.sinyal : {};
  const waktu = new Date().toISOString();
  // Urutan kolom A:P — harus sama dengan baris judul pada Sheet "Hasil".
  const row = [
    waktu,
    str(body.namaSumber, 200) || 'Teks tempel / contoh uji',
    num(body.jumlahKata, 0, 1000000),
    num(body.jumlahKalimat, 0, 100000),
    num(body.skorAkhir, 0, 100),
    str(body.vonis, 80),
    str(body.mesin, 300),
    (body.skorHeuristik === null || body.skorHeuristik === undefined) ? '' : num(body.skorHeuristik, 0, 100),
    (body.skorClassifier === null || body.skorClassifier === undefined) ? '' : num(body.skorClassifier, 0, 100),
    num(s.burstiness, 0, 100),
    num(s.kosakata, 0, 100),
    num(s.frasa, 0, 100),
    num(s.stilometri, 0, 100),
    num(s.markdown, 0, 100),
    num(s.simetri, 0, 100),
    num(s.pengulangan, 0, 100)
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
    console.error('simpan-hasil error', e && e.message);
    return json(res, 500, { ok: false, error: (e && e.message) || 'Gagal menyimpan hasil' });
  }
}
