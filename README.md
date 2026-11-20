# VeritasAI — versi Vercel + Google Drive

Deteksi teks AI untuk tugas & karya ilmiah mahasiswa. Halaman statis
(`index.html`, Ensemble Heuristik v3 + classifier transformers.js opsional)
plus satu fungsi server (`api/simpan-hasil.js`) yang menyimpan **hasil**
analisis sebagai baris baru pada Google Sheet di Google Drive pemilik situs.

Yang disimpan hanya hasil: waktu, nama berkas/sumber, jumlah kata/kalimat,
skor akhir, vonis, mesin, skor heuristik, skor classifier, dan 7 sinyal.
**Isi teks/dokumen yang dianalisis tidak pernah disimpan.**

## Struktur

- `index.html` — seluruh aplikasi (analisis berjalan lokal di peramban).
- `api/simpan-hasil.js` — endpoint `POST /api/simpan-hasil` (tanpa dependensi npm).
- `package.json` — `"type": "module"` agar fungsi Vercel berjalan sebagai ESM.
- `.env.example` — daftar variabel lingkungan yang dibutuhkan.

## 1. Siapkan Google (satu kali)

Akun Google yang dipakai adalah pemilik Drive tujuan (jatjitjitt@gmail.com).

1. Buka https://console.cloud.google.com → buat project baru bernama `VeritasAI`.
2. Di project itu, aktifkan dua API (APIs & Services → Library):
   **Google Sheets API** dan **Google Drive API**.
3. APIs & Services → OAuth consent screen: tipe **External**, nama aplikasi
   `VeritasAI`, email dukungan = email akun. Simpan (status "testing" cukup;
   tambahkan akun sendiri sebagai test user bila diminta).
4. APIs & Services → Credentials → Create credentials → **OAuth client ID**:
   - Application type: **Web application**, nama: `VeritasAI Web`.
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`
   - Buat, lalu catat **Client ID** dan **Client secret**.
5. Buat refresh token via OAuth Playground:
   - Buka https://developers.google.com/oauthplayground
   - Klik ikon roda gigi → centang **Use your own OAuth credentials** →
     isi Client ID & Client secret dari langkah 4.
   - Di daftar scope (Step 1) pilih/ketik:
     `https://www.googleapis.com/auth/spreadsheets` dan
     `https://www.googleapis.com/auth/drive.file`
   - **Authorize APIs** → masuk dengan akun pemilik Drive → izinkan.
   - Step 2: **Exchange authorization code for tokens** → catat **Refresh token**.
6. Buat Sheet tujuan di https://drive.google.com (akun yang sama):
   - Spreadsheet baru bernama `VeritasAI — Hasil Analisis`.
   - Ganti nama tab pertama menjadi `Hasil`.
   - Isi baris pertama (A1:P1) persis dengan judul kolom ini:
     `Waktu (ISO) | Nama Berkas/Sumber | Jumlah Kata | Jumlah Kalimat | Skor Akhir (%) | Vonis | Mesin | Skor Heuristik (%) | Skor Classifier (%) | Burstiness (%) | Kosakata (%) | Frasa (%) | Stilometri (%) | Markdown (%) | Simetri (%) | Pengulangan (%)`
   - Catat **ID Sheet** dari URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

## 2. Terbitkan ke Vercel

1. Unggah isi folder ini ke repo GitHub baru bernama `veritasai`
   (jangan sertakan berkas `.env` — memang tidak ada).
2. Buka https://vercel.com → **Add New → Project** → impor repo `veritasai`.
   Framework preset: **Other**. Build/output: kosongkan (statis + /api otomatis).
3. Sebelum/di sesudah deploy pertama, isi Environment Variables
   (Project → Settings → Environment Variables), sesuai `.env.example`:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
   `HASIL_SHEET_ID`. Berlaku untuk Production.
4. **Deploy**. Bila variabel diisi setelah deploy pertama, lakukan
   **Redeploy** agar fungsi membaca variabelnya.

## 3. Uji

1. Buka URL Vercel → klik salah satu contoh uji → **Analisis**.
2. Di bagian bawah laporan, klik **Simpan Hasil ke Google Drive**.
3. Status harus berubah menjadi "✓ Tersimpan ke Google Drive", dan satu baris
   baru muncul pada Sheet `VeritasAI — Hasil Analisis` tab `Hasil`.

## Keamanan & privasi

- Refresh token setara kunci ke Drive pemilik (terbatas pada scope yang
  diberikan). Simpan hanya sebagai Environment Variable di Vercel —
  jangan di repo, jangan di chat, jangan di berkas.
- Endpoint tidak menerima isi teks; klien memang tidak mengirimkannya.
- Model classifier tetap diunduh dari Hugging Face oleh peramban pengunjung;
  Google Drive tidak dipakai untuk menyajikan model.
