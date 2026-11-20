# Audit Ekstraktor PDF — Font CID & ToUnicode (Phase 1, B-01)

**Status: TERBUKA — belum diperbaiki.** Sampel PDF bermasalah belum tersedia
(diperlukan untuk perbaikan + verifikasi; sudah diminta ke pemilik pada
20 Nov 2026). Dokumen ini adalah hasil audit kode, **bukan** klaim selesai.
Jalan pintas resmi bagi pengguna saat ini: **unggah berkas .docx aslinya**
(format itu didukung penuh).

## Bagaimana ekstraktor bekerja hari ini

`extractPdfText()` + `pdfContentToText()` di `index.html` (murni JS, tanpa
dependensi):

1. Memindai seluruh objek PDF, men-decode stream ber-`FlateDecode` (dan
   stream mentah) menjadi teks konten.
2. Dari stream konten, mengumpulkan string yang digambar oleh operator
   `Tj`, `'`, `"`, dan array `TJ` (dengan heuristik spasi pada penyesuaian
   kerning besar).
3. String literal `(...)` dan heksadesimal `<...>` di-decode sebagai byte;
   ada penanganan khusus string **UTF-16BE dengan BOM `FE FF`** (umum pada
   teks hasil ekspor tertentu).
4. Teks hasil digabung per halaman/stream, lalu dinormalisasi spasi-baris.

Yang **tidak** dilakukan (terverifikasi dari kode): tidak ada pembacaan
objek font, tidak ada pelacakan operator pemilihan font (`Tf`), dan tidak
ada penguraian peta **ToUnicode CMap** (`beginbfchar`/`beginbfrange` tidak
muncul di mana pun dalam kode).

## Mengapa PDF konversi HP gagal

Konverter PDF di HP (WPS Office, Microsoft Word mobile, dan layanan konversi
daring) lazim menyematkan **font subset berkunci CID** (`Identity-H`):
glyph digambar dengan **kode 2-byte yang merupakan nomor glyph internal
font**, bukan kode Unicode. Tanpa peta ToUnicode font tersebut, kode-kode
itu tidak membawa arti huruf apa pun — string yang diekstrak ekstraktor
saat ini menjadi sampah biner atau kosong, dan situs dengan jujur menolak:
*"teks dari PDF tidak terbaca"* (penjaga `looksGarbled()` / jumlah kata
terlalu kecil). PDF dari desktop (font standar WinAnsi/UTF-16) tidak terkena
masalah ini — terbukti pada berkas uji 218 halaman yang terbaca penuh.

## Yang dibutuhkan untuk perbaikan permanen

1. **Parser objek font:** untuk setiap font pada halaman, baca rujukan
   `/ToUnicode` dan urai CMap-nya (`beginbfchar`, `beginbfrange`, termasuk
   rentang dengan larik tujuan) menjadi peta kode→Unicode per font.
2. **Pelacakan font aktif:** ikuti operator `Tf` di stream konten; setiap
   string `Tj`/`TJ` di-decode memakai peta font yang sedang aktif (string
   CID = rangkaian kode 2-byte).
3. **Cadangan yang aman:** font tanpa ToUnicode tetap memakai jalur lama;
   tidak ada perubahan untuk PDF yang hari ini terbaca (regresi dijaga oleh
   berkas uji 218 halaman + sampel uji ekstraktor).
4. **Sampel uji wajib:** minimal satu PDF hasil konversi HP yang hari ini
   gagal, dari pengguna. Perbaikan **tidak boleh dinyatakan selesai** tanpa
   berkas itu terbaca benar (jumlah kata wajar, teks dapat dibaca manusia,
   dan lolos penjaga `looksGarbled` tanpa dilonggarkan).

## Risiko perbaikan (dicatat sejak sekarang)

- Ukuran kode bertambah cukup besar di dalam berkas tunggal `index.html`;
  kerjakan sebagai modul terpisah di dalam berkas yang sama dan uji dengan
  harness ekstraktor sebelum digabung.
- CMap dapat berukuran besar dan berbentuk tidak baku antar-konverter;
  parser harus defensif (gagal pada satu font ≠ gagal seluruh dokumen).
- Kinerja: dokumen ratusan halaman tidak boleh melambat secara berarti;
  peta font di-cache per dokumen.

## Protokol penerimaan (acceptance)

- [ ] Sampel PDF konversi HP diterima dan disimpan sebagai berkas uji.
- [ ] Berkas itu terbaca: teks hasil ekstraksi dapat dibaca manusia.
- [ ] Berkas uji lama (PDF desktop 218 halaman) tetap terbaca identik.
- [ ] `node benchmark/check-regression.cjs` tetap hijau (mesin tidak berubah).
- [ ] Pesan galat untuk PDF pindai/gambar (yang memang butuh OCR) tidak berubah.
