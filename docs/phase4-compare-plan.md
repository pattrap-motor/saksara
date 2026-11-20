# Phase 4 — Compare Writing: Rencana Mesin Perbandingan Dokumen

Branch: `saksara-phase4-compare-writing` (dari ujung Phase 3, `08db217`).
Prinsip: halaman `#/compare` membandingkan dua dokumen secara deskriptif — perbedaan
tekstual + perbedaan karakteristik Writing Forensic. Halaman ini **tidak menjalankan
Detector** dan tidak menampilkan skor deteksi: selisih karakteristik bukan bukti
kepengarangan, bukan bukti AI, dan bukan bukti "mengakali deteksi".

## 1. Tokenisasi & normalisasi (konsisten, terdokumentasi)

- Kata: pola yang sama dengan `wordsOf` (huruf/angka Unicode + apostrof). Untuk
  perbandingan, token dinormalisasi huruf kecil; bentuk asli dipertahankan untuk
  tampilan diff.
- Kalimat: `splitSentences`; paragraf: `splitParagraphs` (definisi yang sama dengan
  Detector & Writing Forensic — satu definisi di seluruh situs).
- Akibat normalisasi: perbedaan **kapitalisasi, tanda baca, dan spasi saja tidak
  menghasilkan perubahan kata**. Bila aliran token ternormalisasi kedua dokumen
  identik tetapi teks mentahnya berbeda, halaman melaporkan secara eksplisit:
  "perbedaan hanya pada permukaan (tanda baca/kapitalisasi/spasi)".

## 2. Penjajaran (alignment) tiga tingkat

1. **Paragraf** — kunci = token ternormalisasi digabung. Paragraf yang sama persis
   dicocokkan lewat antrean kemunculan (duplikat ditangani per kemunculan). Urutan
   indeks pasangan yang tidak monoton = **paragraf berubah urutan**. Sisa paragraf A
   dan B dipasangkan menurut posisi (ke-i dengan ke-i) sebagai kandidat "berubah";
   kelebihan di satu sisi = paragraf dihapus/ditambah.
2. **Kalimat** — di dalam setiap pasangan paragraf berubah: kalimat sama persis
   menjadi jangkar; sisa dipasangkan menurut posisi sebagai kalimat berubah;
   kelebihan = kalimat dihapus/ditambah. Paragraf yang sama persis dilewati.
3. **Kata** — di dalam setiap pasangan kalimat berubah: diff LCS (pemrograman
   dinamis) atas token ternormalisasi. Blok hapus yang bersebelahan dengan blok
   tambah digabung menjadi blok **berubah**: berubah = min(hapus, tambah); sisanya
   tambah/hapus murni.

Urutan terdeteksi pada tingkat paragraf; kalimat yang berpindah antarparagraf
terbaca sebagai dihapus + ditambah (dinyatakan terbuka di halaman).

## 3. Kemiripan tekstual

Koefisien Dice atas token kata:

```
kemiripan = 2 × kata-cocok ÷ (kata-A + kata-B)
```

kata-cocok = kata pada segmen yang sama (paragraf identik + kalimat identik +
token sama di dalam diff kata). Paragraf yang berpindah urutan tetap terhitung
cocok — urutan dilaporkan terpisah, bukan mengurangi kemiripan. Identik = 100%.

## 4. Batas komputasi (dokumen panjang)

- Analisis dibatasi 100.000 kata per dokumen (`capAnalysisText` yang sama).
- LCS kata hanya berjalan di dalam pasangan kalimat; bila satu pasangan melebihi
  1.000.000 sel (mis. kalimat raksasa tanpa titik), pasangan itu diringkas dengan
  selisih multiset (kata hanya-di-A / hanya-di-B) dan ditandai "perubahan besar
  (diringkas)" — tidak pernah menjalankan DP raksasa.
- Tampilan diff dibatasi 6.000 kata pertama per sisi; statistik mencakup penuh.
- Tanpa Web Worker (pengukuran Phase 3: analisis 100.000 kata ±0,22 detik; diff
  berjenjang ini linear kecuali DP kalimat yang terbatas di atas).

## 5. Perbandingan Writing Forensic (pakai ulang, tanpa duplikasi rumus)

`wfAnalyze` dipanggil untuk kedua dokumen; tabel membandingkan: jumlah kata/
kalimat/paragraf, kata unik, TTR, TTR jendela, hapax, Guiraud, rata-rata & median
panjang kalimat, CV ritme, koma per kalimat, subordinasi per kalimat, % kalimat
panjang, transisi per 100 kata, kata isi tersering, jumlah pola 4-gram berulang,
dan CV konsistensi antarparagraf. Kolom selisih bersifat deskriptif netral
(▲/▼/± angka) — tanpa label "lebih baik/lebih buruk".

## 6. Tiga mode tampilan

- **Analitis** (bawaan): kartu ringkasan (kemiripan, hitungan), tabel perubahan,
  tabel Forensic berdampingan + grafik distribusi panjang kalimat A vs B.
- **Berdampingan**: dua kolom baris kalimat sejajar; tambahan hijau (＋), terhapus
  merah (−), berubah biru (≈) — selalu dengan label teks/ikon, bukan warna saja.
- **Inline**: satu aliran teks; kata terhapus dicoret merah, kata tambahan hijau,
  kalimat berubah menampilkan diff kata sebaris dengan lencana ≈.

## 7. Ekspor PDF lokal

Memakai ulang `loadJsPdf()` (jsPDF dari CDN, lazy — dependensi yang sudah dipakai
laporan Detector) + `pdfSafe()`. Isi: ringkasan & kemiripan, hitungan perubahan,
pasangan kalimat berubah teratas (maks 15), tabel metrik Forensic, metodologi,
keterbatasan. Dibuat sepenuhnya di peramban; tidak ada unggahan.

## 8. Kejujuran & keterbatasan (dicetak di halaman)

- Kemiripan tinggi bukan bukti penulis yang sama; kemiripan rendah bukan bukti
  penulis berbeda. Dua penulis dapat menulis teks yang mirip (topik/templat sama);
  satu penulis dapat menulis dua teks yang sangat berbeda.
- Perubahan karakteristik antarversi adalah deskripsi statistik. Halaman ini tidak
  menghitung skor Detector, dan selisih karakteristik **tidak** ditafsirkan sebagai
  bukti seseorang mengakali deteksi.
- Pengaruh panjang & jenis: dokumen pendek membuat persentase mudah berayun;
  parafrase total dapat menghasilkan kemiripan rendah walau maknanya sama (diff ini
  tekstual, bukan semantik); daftar/tabel tanpa titik melemahkan penjajaran kalimat.
- Seluruh pemrosesan lokal; tidak ada penyimpanan otomatis.
