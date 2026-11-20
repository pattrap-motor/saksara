# Phase 7 — Audit UX & Inventaris (20–21 Nov 2026)

Basis: produksi v0.14.0-beta (main cdb1a08). Berkas identik md5 dengan produksi.

## Temuan audit per halaman

- **Navigasi**: 10 tautan datar tanpa kelompok; label teknis Inggris
  (Detector, Writing Forensic, Benchmark, OCR). "Metode" dan "Benchmark"
  tumpang tindih bagi awam. Batch tidak punya pintu masuk sendiri
  (tersembunyi di bawah halaman Detector).
- **Beranda/Dashboard**: judul hero "Indikasi AI yang terukur, metode yang
  terbuka, privasi yang utuh" — bagus untuk kredibilitas, kurang manfaat
  langsung bagi awam. Kartu akses cepat tanpa ikon; istilah "classifier",
  "benchmark", "OCR" tanpa penjelasan.
- **Detector**: laporan langsung membuka dengan angka persen besar + 7
  sinyal teknis (burstiness, kosakata, frasa, stilometri, markdown,
  simetri, pengulangan) + tabel kalimat. Tidak ada kesimpulan bahasa
  manusia di depan; peringatan "indikasi bukan bukti" ada tetapi di
  catatan kaki.
- **Writing Forensic**: semua istilah statistik mentah (TTR, Guiraud,
  hapax, distribusi, z-score) tanpa penjelasan/interpretasi/saran.
- **Compare**: angka dan lencana teknis tampil tanpa kalimat kesimpulan;
  pengguna harus menafsirkan sendiri +13/−16/≈1.
- **Batch**: instruksi cukup jelas tetapi judul "Analisis Batch" teknis.
- **OCR**: instruksi sudah sederhana; judul "OCR" adalah singkatan teknis.
- **Benchmark**: lengkap dan jujur, tetapi akurasi/presisi/recall/FP/FN/
  confusion matrix tidak dijelaskan bagi awam; tidak ada ringkasan
  "seberapa bisa dipercaya" berbahasa sederhana di depan.
- **Konsistensi**: judul tab per halaman masih teknis (TITLES map).

## Keputusan rancangan

1. Label navigasi ramah (rute hash TIDAK berubah): Beranda · Periksa
   Tulisan · Kenali Gaya Tulisan · Bandingkan Tulisan · Periksa Banyak
   Dokumen (ke #/detector + gulir ke bagian batch) · Baca Teks dari
   Gambar · Riwayat Saya; kelompok "Pelajari": Cara Menggunakan Saksara ·
   Pengujian & Transparansi (Benchmark) · Privasi & Batasan. "Metode"
   keluar dari navigasi, tetap terhubung dari halaman Benchmark/Cara
   Menggunakan.
2. Dua tingkat: Tampilan **Sederhana** (bawaan) dan **Mendalam** (pilihan).
   Kontrol segmented di halaman Detector/Forensik/Benchmark; status hanya
   di memori sesi (tanpa penyimpanan baru — privasi tidak berubah).
   Blok mendalam dibungkus `.deep-wrap` (display:none / contents).
3. Detector: kartu kesimpulan bahasa manusia di puncak laporan (per pita
   skor), persen tetap tampil sebagai indikator, peringatan indikasi
   selalu menyertai kesimpulan. Sinyal 7 + baris mesin teknis → mendalam.
4. Forensik: kartu ramah per metrik utama (nama awam + artinya +
   interpretasi deskriptif + saran); tabel metrik lengkap → mendalam.
   Tanpa kategori baik/buruk.
5. Compare: kalimat kesimpulan sederhana di atas hasil.
6. Benchmark: kartu "Seberapa bisa dipercaya?" + glosarium awam
   (akurasi, presisi, recall, false positive, false negative, confusion
   matrix) di depan; tabel rinci → mendalam. Angka & metode utuh.
7. Microcopy: judul halaman, judul tab, dan tombol utama diseragamkan ke
   kata kerja ramah. ID elemen TIDAK berubah (kontrak uji aman).
8. Ikon SVG sebaris (currentColor) pada 8 kartu akses cepat.

## Tabel istilah — sebelum → sesudah

| Sebelum | Sesudah |
|---|---|
| Detector | Periksa Tulisan |
| Writing Forensic | Kenali Gaya Tulisan |
| Benchmark (Center) | Pengujian & Transparansi |
| OCR | Baca Teks dari Gambar |
| Riwayat | Riwayat Saya |
| Cara Kerja | Cara Menggunakan Saksara |
| Posisi & Batasan | Privasi & Batasan |
| Analisis Batch | Periksa Banyak Dokumen |
| Classifier (di kartu/beranda) | Penguat Otomatis / Penguat AI |
| "Indikasi AI yang terukur…" (hero) | "Pahami tulisan Anda. Jadikan lebih baik." |
| Laporan hasil | Hasil pemeriksaan |
| Analisis Karakteristik (tombol) | Kenali Gaya Tulisan |
| Proses Semua (tombol batch) | Periksa Semua Berkas |
| Skor mentah tanpa kesimpulan | Kartu kesimpulan bahasa manusia per pita skor + persen sebagai ringkasan |
| Metrik forensik mentah (TTR, CV, z) | Kartu ramah: nama awam + artinya + interpretasi deskriptif + saran; tabel lengkap di Mode Mendalam |
| Angka compare tanpa narasi | Kalimat kesimpulan sederhana (mirip/berubah/tambah/hapus) |
| Akurasi/presisi/recall/FP/FN tanpa penjelasan | Glosarium awam + ringkasan "Seberapa bisa dipercaya?" |

## Yang TIDAK berubah

Mesin skor & seluruh bobot/ambang/gerbang, skor per kalimat, baseline,
API, privasi (toggle tampilan hanya di memori sesi — tanpa penyimpanan
baru), identitas Langit Cerah, arsitektur vanilla, semua ID elemen.
