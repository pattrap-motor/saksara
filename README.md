# Saksara — Gratis Deteksi Tulisan AI

Situs: **https://saksara.vercel.app** · Repo: `pattrap-motor/saksara`

Detektor indikasi tulisan AI berbahasa Indonesia yang berjalan **sepenuhnya
di peramban pengunjung** (privasi aman, tanpa biaya server untuk analisis):
**Ensemble Heuristik v3** (7 sinyal statistik, karya tim Saksara) plus
**classifier lokal opsional** — konversi ONNX dari model publik
XLM-RoBERTa HC3 — sebagai penguat bersyarat. Skor adalah *indikasi
statistik, bukan bukti/vonis*.

Yang disimpan server hanya **hasil** analisis (atas klik pengguna):
waktu, nama berkas/sumber, jumlah kata/kalimat, skor akhir, vonis, mesin,
skor heuristik, skor classifier, dan 7 sinyal — sebagai baris baru pada
Google Sheet di Drive pemilik situs. **Isi teks/dokumen yang dianalisis
tidak pernah dikirim maupun disimpan** (kecuali fitur Donasi teks, yang
memerlukan label + persetujuan eksplisit pengirim).

> Catatan nama: proyek ini sebelumnya bernama "VeritasAI" (diganti menjadi
> Saksara pada 20 November 2026). Beberapa artefak lama masih memakai nama
> itu — proyek Google Cloud, klien OAuth, dan judul Sheet tujuan dibuat
> dengan nama "VeritasAI". Nama-nama tersebut **tidak berpengaruh** pada
> fungsi (yang dipakai sistem adalah ID dan tab `Hasil`), dan tidak perlu
> diganti.

## Struktur

- `index.html` — seluruh aplikasi satu berkas (analisis berjalan lokal di peramban).
- `api/simpan-hasil.js` — `POST /api/simpan-hasil`: menyimpan satu baris **hasil** ke tab `Hasil` (16 kolom).
- `api/kalibrasi.js` — `POST /api/kalibrasi`: menyimpan **statistik saja** ke tab `Kalibrasi`; permintaan yang membawa kolom teks ditolak (400).
- `api/donasi.js` — `POST /api/donasi`: menyimpan teks donasi berlabel (dengan persetujuan) ke tab `Donasi`.
- `benchmark/` — harness benchmark 18 sampel + gerbang regresi (`check-regression.cjs`) dengan baseline emas `baseline-phase0.json`.
- `feature-harness.cjs` — uji kontrak fitur (pra-proses, paritas batch, payload telemetri).
- `.github/workflows/regression-gate.yml` — gerbang regresi otomatis di GitHub Actions (setiap push & pull request).
- `sw.js`, `manifest.json` — PWA (shell offline; navigasi network-first).
- `package.json` — `"type": "module"` agar fungsi Vercel berjalan sebagai ESM.
- `.env.example` — daftar variabel lingkungan yang dibutuhkan.

## Gerbang regresi (wajib hijau sebelum merge/publikasi)

```bash
node benchmark/check-regression.cjs   # skor mesin == baseline Phase 0
node benchmark/run-benchmark.cjs      # laporan benchmark lengkap
node feature-harness.cjs              # kontrak fitur
```

GitHub Actions menjalankan ketiganya (plus cek sintaks `api/`) pada setiap
push dan pull request. Bila merah, jangan merge dan jangan publikasikan —
skor mesin telah bergeser atau kontrak fitur patah.

## 1. Siapkan Google (satu kali)

Akun Google yang dipakai adalah pemilik Drive tujuan (akun terkelola
pemilik situs).

1. Buka https://console.cloud.google.com → buat project baru (saat proyek
   ini dibuat, namanya `VeritasAI`; nama bebas, tidak berpengaruh).
2. Di project itu, aktifkan dua API (APIs & Services → Library):
   **Google Sheets API** dan **Google Drive API**.
3. APIs & Services → OAuth consent screen: tipe **External**, nama aplikasi
   bebas, email dukungan = email akun. Simpan (status "testing" cukup;
   tambahkan akun sendiri sebagai test user bila diminta).
4. APIs & Services → Credentials → Create credentials → **OAuth client ID**:
   - Application type: **Web application**.
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
   - Spreadsheet baru (judul bebas; yang dipakai adalah ID-nya).
   - Ganti nama tab pertama menjadi `Hasil`.
   - Isi baris pertama (A1:P1) persis dengan judul kolom ini:
     `Waktu (ISO) | Nama Berkas/Sumber | Jumlah Kata | Jumlah Kalimat | Skor Akhir (%) | Vonis | Mesin | Skor Heuristik (%) | Skor Classifier (%) | Burstiness (%) | Kosakata (%) | Frasa (%) | Stilometri (%) | Markdown (%) | Simetri (%) | Pengulangan (%)`
   - Siapkan juga tab `Kalibrasi` dan `Donasi` (judul kolom dibuat oleh
     endpoint masing-masing saat pertama dipakai).
   - Catat **ID Sheet** dari URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

## 2. Terbitkan ke Vercel

1. Repo GitHub: `pattrap-motor/saksara` (jangan sertakan berkas `.env` —
   memang tidak ada).
2. Buka https://vercel.com → **Add New → Project** → impor repo `saksara`.
   Framework preset: **Other**. Build/output: kosongkan (statis + /api otomatis).
3. Sebelum/di sesudah deploy pertama, isi Environment Variables
   (Project → Settings → Environment Variables), sesuai `.env.example`:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
   `HASIL_SHEET_ID`. Berlaku untuk Production.
4. **Deploy**. Bila variabel diisi setelah deploy pertama, lakukan
   **Redeploy** agar fungsi membaca variabelnya.
5. Produksi hanya dari branch `main`. Branch lain menghasilkan preview
   deployment (bila integrasi Git Vercel aktif) dan **bukan** produksi.

## 3. Uji

1. Buka https://saksara.vercel.app → klik salah satu contoh uji → **Analisis**.
2. Di bagian bawah laporan, klik **Simpan Hasil ke Google Drive**.
3. Status harus berubah menjadi "✓ Tersimpan ke Google Drive", dan satu baris
   baru muncul pada Sheet tujuan tab `Hasil`.

## Keamanan & privasi

- Refresh token setara kunci ke Drive pemilik (terbatas pada scope yang
  diberikan). Simpan hanya sebagai Environment Variable di Vercel —
  jangan di repo, jangan di chat, jangan di berkas.
- Endpoint hasil & kalibrasi tidak menerima isi teks; klien memang tidak
  mengirimkannya. Endpoint donasi satu-satunya yang menerima teks, dan itu
  pun hanya dengan label + persetujuan eksplisit pengirim.
- Situs tidak memakai `localStorage`/`sessionStorage`/`IndexedDB`;
  penyimpanan peramban hanya Cache API untuk model classifier (opt-in,
  dapat dihapus pengguna) dan shell PWA.
- Model classifier diunduh dari Hugging Face (`saksara/ai-text-detector-onnx`)
  oleh peramban pengunjung; Google Drive tidak dipakai untuk menyajikan model.

---
© 2026 Saksara — Dikembangkan oleh Ciptanala Devs
