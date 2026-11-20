# Rencana Phase 3 — Writing Forensic (Saksara)

Tanggal: 20 November 2026 · Branch: `saksara-phase3-writing-forensic` (dari `saksara-phase2-dashboard`)
Prinsip: modul BARU yang berdiri sendiri. Mesin AI Detector (Ensemble Heuristik v3,
classifier, kalibrasi, ambang) **tidak diubah dan tidak dihubungkan** ke modul ini —
hasil Writing Forensic tidak memengaruhi skor detector, dan sebaliknya.

## Apa itu Writing Forensic di sini

Pengukuran **karakteristik tulisan** (statistik gaya) yang berjalan 100% lokal di
peramban: tanpa API, tanpa pengiriman teks, tanpa penyimpanan otomatis. Modul ini
**bukan** detektor AI dan **bukan** bukti kepengarangan — ia memberi angka-angka
deskriptif yang dapat diperiksa ulang, untuk keperluan penyuntingan dan pembelajaran
menulis. Keragaman kosakata yang rendah **bukan** bukti AI; kalimat yang seragam
**bukan** bukti AI. Semua interpretasi dibatasi pada bunyi perhitungannya.

## Tujuh kelompok analisis & metode perhitungan

Tokenisasi memakai ulang fungsi situs yang ada: `wordsOf` (kata = rangkaian huruf/
angka/apostrof, huruf kecil), `splitSentences` (pisah pada . ! ? …), `splitParagraphs`
(pisah pada baris kosong). Semua angka di bawah dihitung persis seperti tertulis.

1. **Keragaman leksikal** — total kata W, kata unik U, TTR = U/W; TTR jendela
   (rata-rata TTR pada jendela 50 kata berurutan, agar adil untuk teks panjang);
   kata hapax (muncul sekali) dan % nya terhadap U; indeks Guiraud = U/√W.
2. **Distribusi panjang kalimat** — rata-rata, median, simpangan baku, CV dari jumlah
   kata per kalimat; histogram 7 kantong (1–5, 6–10, 11–15, 16–20, 21–25, 26–30, >30).
3. **Kompleksitas struktur kalimat** — rata-rata koma per kalimat (proksi klausa);
   penanda subordinasi (karena, sehingga, ketika, jika, apabila, bahwa, meskipun,
   walaupun, agar, supaya, setelah, sebelum, saat, hingga, sambil, meski): total per
   kalimat dan % kalimat yang mengandung ≥1; % kalimat panjang (>25 kata).
4. **Konsistensi paragraf** — jumlah paragraf; kata per paragraf (rata-rata, CV,
   terpendek/terpanjang); kalimat per paragraf.
5. **Frekuensi kata transisi** — kamus ±30 penanda (selain itu, namun, oleh karena itu,
   dengan demikian, di sisi lain, misalnya, selanjutnya, pada akhirnya, …): total,
   kepadatan per 100 kata, dan rincian per penanda yang ditemukan.
6. **Pengulangan kata/frasa** — kata isi (di luar kata fungsi) teratas beserta % nya;
   rangkaian 4 kata (4-gram) yang muncul ≥2 kali; awalan kalimat (2 kata pertama)
   yang berulang.
7. **Konsistensi gaya antarparagraf** — untuk tiap paragraf (≥15 kata): rata-rata
   panjang kalimat, TTR, kepadatan transisi; konsistensi dinyatakan sebagai CV
   antarparagraf; paragraf yang menyimpang ditandai bila |z| ≥ 1,75 terhadap
   rata-rata panjang kalimat paragraf (aturan dicetak di halaman; butuh ≥4 paragraf).
   Penyimpangan dapat disebabkan topik/struktur (mis. pendahuluan vs daftar) —
   **bukan** bukti beda penulis.

## Tampilan

Kartu statistik utama; grafik batang distribusi kalimat (CSS murni); panel per
kelompok; sorotan (highlight) kata isi berulang & frasa 4-gram pada teks (maks.
6.000 kata pertama ditampilkan, statistik tetap atas seluruh teks); ringkasan
otomatis yang hanya menyusun angka hasil hitung; saran penyuntingan berbasis aturan
ambang yang dicetak (setiap saran menampilkan nilai pemicunya; saran tidak mengubah
makna — memecah kalimat, memvariasikan kata, menata transisi).

## Masukan

Tempel teks, contoh bawaan (2 gaya kontras dari contoh situs yang ada), atau unggah
.txt/.docx/.pdf memakai ulang ekstraktor + penjaga yang sama dengan Detector
(batas 20 MB, penolakan .doc, penjaga PDF tak terbaca). Batas analisis sama:
100.000 kata pertama. Input kosong → pesan galat sebaris; teks <±300 kata → banner
keterandalan pada hasil.

## Web Worker?

Tidak dipakai — dengan alasan terukur: seluruh perhitungan adalah pemindaian linear
satu-dua lintasan; waktu hitung pada dokumen batas atas (100.000 kata) diukur pada
pengujian dan dilaporkan. Bila < ±2 detik, worker hanya menambah kompleksitas pada
arsitektur satu berkas. Tombol analisis menampilkan status sibuk selama hitungan.

## Keterbatasan (dicetak juga di halaman)

- Tanpa stemming: kata berimbuhan ("lari", "berlari", "pelari") dihitung sebagai kata
  berbeda — TTR Bahasa Indonesia cenderung terlihat lebih tinggi.
- Pemisah kalimat berbasis tanda baca: singkatan ("Dr.", "Rp.") dapat memecah kalimat
  secara keliru; tanda baca tidak beraturan mengaburkan statistik kalimat.
- Angka & token non-huruf dihitung sebagai kata (mengikuti `wordsOf` detector).
- Statistik deskriptif tidak dapat membuktikan siapa penulis sebuah teks.
