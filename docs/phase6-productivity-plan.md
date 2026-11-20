# Phase 6 — Productivity Tools: OCR, History, Batch 2.0, Report 2.0

Branch: `saksara-phase6-productivity` (dari ujung Phase 5, `ce95c7f`). Mesin
deteksi tidak berubah; seluruh regresi Phase 1–5 wajib hijau di setiap tahap.

## Hasil recon & probe (dijalankan sebelum membangun)

- Batch lama: proses sekuensial, baris hasil per berkas, ekspor CSV, tanpa
  antrean/batal/retry/batas jumlah. `scoreBatchText` dijamin harness sama
  dengan `analyze()` — fungsi itu tidak diubah.
- Batas ukuran berkas 20 MB sudah ditegakkan ekstraktor (MAX_FILE_BYTES).
- Ukuran aset OCR terukur dari CDN: tesseract.min.js 66.711 B · worker
  123.632 B · core WASM (js+wasm) ±6,8 MB · traineddata *fast* Indonesia
  611.736 B · Inggris 1.984.273 B → total unduhan pertama ±9,5 MB.
- **Probe OCR nyata** (Firefox headless, Tesseract.js 5.0.5, langPath
  tessdata 4.0.0_fast, ind+eng): worker siap 4,8 dtk; gambar uji Indonesia
  terbaca **sempurna kata-per-kata** (kepercayaan 95) dalam ±0,4 dtk;
  versi buram (Gaussian 2,2) juga terbaca sempurna. Kesimpulan: layak bangun.

## 1. OCR — halaman `#/ocr`

- Muat malas & berpersetujuan: tidak ada unduhan sebelum pengguna menekan
  "Unduh & aktifkan OCR"; kartu persetujuan mencantumkan ukuran per aset dan
  sumber CDN-nya. Bahasa: Indonesia + Inggris (model fast).
- Masukan: gambar (PNG/JPG/WebP/BMP) atau PDF. PDF dirasterisasi lokal oleh
  pdf.js 3.11.174 (CDN cdnjs, dimuat malas bersamaan dengan persetujuan yang
  sama) pada skala 2; pengguna memilih halaman (semua / daftar nomor);
  pratinjau kanvas halaman pertama terpilih; progres per halaman; hasil per
  halaman digabung di textarea yang dapat disunting, dengan kepercayaan
  rata-rata dan peringatan bila kepercayaan rendah (< 60) atau halaman kosong.
- Aksi hasil: Salin · Unduh .txt · Analisis di Detector (mengisi kotak
  Detector dan menjalankan analisis).
- **Fallback B-01**: ekstraksi teks tetap jalur utama di mana-mana. Bila
  unggahan PDF di Detector/Writing Forensic/Compare gagal terbaca, status
  galat menawarkan tombol "Buka di OCR" yang membawa berkas yang sama ke
  halaman OCR. Halaman OCR menyatakan dengan tegas: OCR membaca halaman
  sebagai gambar — ia jalan pintas untuk PDF pindai/gambar dan dapat menolong
  bila halaman tampil benar tetapi lapisan teksnya rusak; **ia tidak
  memperbaiki ekstraktor teks**, dan B-01 tetap terbuka.

## 2. Analysis History — halaman `#/history` (IndexedDB)

- **Nonaktif secara bawaan.** Tidak ada basis data yang dibuat sebelum
  persetujuan. Dua persetujuan terpisah, disimpan sebagai dua penanda kecil
  di localStorage (diungkapkan terbuka di halaman): (a) aktifkan riwayat —
  hanya **metadata** hasil yang disimpan (jenis, waktu, judul singkat,
  ringkasan angka); (b) izinkan menyimpan **teks** dokumen (dipotong 200.000
  karakter, ditandai) — tanpa (b), teks tidak pernah ditulis ke disk.
- Hook satu baris di titik yang sudah ada: selesai analisis Detector
  (applyScore), Writing Forensic, Compare, dan Batch (satu entri ringkasan).
  Bila nonaktif, hook langsung kembali tanpa menyentuh IndexedDB.
- Halaman: daftar entri (jenis, waktu, judul, ringkasan), Buka (detail +
  teks bila ada + "Muat ke Detector" bila teks tersimpan), Unduh JSON per
  entri, Hapus satu, Hapus semua, Nonaktifkan (dengan pilihan menghapus
  data), estimasi pemakaian penyimpanan peramban, dan tombol "Hapus cache
  model classifier" (Cache API) sebagai penghapusan data lokal menyeluruh.
- Baris status perangkat di Dashboard diperbarui jujur mengikuti status
  riwayat (tidak lagi mengklaim "tidak ada teks disimpan" secara mutlak).

## 3. Batch Analysis 2.0 (di tempat, pada view Detector)

- Memilih berkas membangun **antrean** terlebih dahulu: nama, ukuran, status
  (Menunggu/Proses/Selesai/Gagal/Dibatalkan), tombol hapus per item.
- Batas yang ditegakkan dengan pesan jelas: maks **50 berkas** per batch,
  per berkas maks 20 MB (sudah ada), total maks **100 MB**. Berkas yang
  melanggar ditandai tidak valid beserta alasannya, tidak diproses diam-diam.
- Tombol **Batalkan** selama proses (berkas berjalan diselesaikan, sisanya
  ditandai Dibatalkan), **Coba lagi** untuk yang gagal saja, panel **ringkasan**
  (total/sukses/gagal/dibatalkan, rata-rata & median skor, hitungan per pita),
  ekspor **CSV + JSON + PDF ringkasan**. Proses tetap sekuensial dengan jeda
  antarberkas (memori aman); formula Detector tidak berubah.

## 4. PDF Report 2.0

Kit laporan bersama: kop identitas "Saksara" + judul + waktu pembuatan lokal,
kaki halaman berisi disclaimer + nomor halaman, blok metodologi &
keterbatasan baku. Detector dan Compare sudah memiliki laporan kaya —
keduanya diselaraskan ke kop/kaki/blok yang sama tanpa mengubah isinya.
Baru: laporan PDF **Writing Forensic** (kartu statistik, tabel metrik,
distribusi kalimat sebagai batang, saran, metodologi) dan **Batch**
(ringkasan + tabel per berkas). Semua dibuat lokal via jsPDF yang sama.

## 5. Dashboard

Grid akses cepat disusun menjadi perangkat kerja: Detector, Analisis Batch,
Writing Forensic, Bandingkan, Benchmark, OCR, Riwayat, Penguat Classifier.
Kartu Riwayat menampilkan status nyata (Aktif/Nonaktif); kartu OCR
menyebutkan unduhan model ±9,5 MB sekali. Tanpa statistik fiktif.

## 6. Privasi & jaringan (didokumentasikan di halaman OCR/Riwayat)

Tidak ada unggahan otomatis, tidak ada API AI berbayar, tidak ada login.
Permintaan jaringan yang memang terjadi dan diungkapkan: aset CDN sesuai
fitur yang dibuka pengguna (jsPDF; mesin+model Tesseract; pdf.js; model
classifier ±280 MB bila diaktifkan) dan aset hosting situs itu sendiri.
Isi dokumen tidak pernah dikirim — OCR, riwayat, dan analisis semuanya
lokal. Telemetri kalibrasi yang sudah ada tidak berubah cakupannya (tidak
memuat isi dokumen).

## 7. Pengujian

Node: seluruh suite lama + uji murni baru (validasi batch, agregasi
kepercayaan OCR, sanitasi entri riwayat). Peramban: OCR gambar jelas/buram,
PDF pindai via fallback Detector, PDF teks (ekstraksi tetap utama — OCR tidak
dipaksa), batch 3 berkas + batal + retry, riwayat aktif → analisis → muat
ulang → entri ada → buka → hapus, ekspor CSV/JSON/PDF, desktop/mobile.
Sampel PDF CID asli dari pengguna tetap belum ada — B-01 diuji lewat gejala
yang sama (PDF tanpa lapisan teks) dan statusnya tetap TERBUKA.
