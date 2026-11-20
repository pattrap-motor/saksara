# Hasil Benchmark Bahasa Indonesia — Ensemble Heuristik v3

- **Tanggal pengukuran:** 20 November 2026
- **Mesin:** Ensemble Heuristik v3, diekstrak langsung dari `index.html`
  (jalankan ulang: `node benchmark/run-benchmark.cjs`)
- **Kumpulan uji:** 18 teks, ±200–400 kata (lihat `README.md` untuk asal
  setiap sampel)
- **Pita vonis situs:** RENDAH < 0,35 · SEDANG 0,35–0,65 · TINGGI ≥ 0,65
- **Regresi 5 contoh kalibrasi bawaan:** semua tetap di pitanya
  (MANUSIA 0,0859 · AI 0,7714 · PARAFRASE 0,3582 · GEMINI 0,6693 ·
  REFLEKSI 0,7953)

## Skor per sampel

| Berkas | Kategori | Kata | Skor | Pita |
|---|---|---:|---:|---|
| hf-01-majapahit.txt | human-formal | 348 | 0,2960 | RENDAH |
| hf-02-fotosintesis.txt | human-formal | 380 | 0,3006 | RENDAH |
| hf-03-borobudur.txt | human-formal | 311 | 0,3128 | RENDAH |
| hf-04-demokrasi.txt | human-formal | 299 | 0,2121 | RENDAH |
| hf-05-magang.txt | human-formal | 295 | 0,0859 | RENDAH |
| hp-01-kos.txt | human-personal | 228 | 0,1857 | RENDAH |
| hp-02-kkn.txt | human-personal | 232 | 0,1876 | RENDAH |
| hp-03-ojek.txt | human-personal | 233 | 0,2209 | RENDAH |
| hp-04-skripsi.txt | human-personal | 227 | 0,1395 | RENDAH |
| ai-01-teknologi-pendidikan.txt | ai-formal | 226 | 0,6740 | TINGGI |
| ai-02-media-sosial.txt | ai-formal | 228 | 0,6159 | SEDANG |
| ai-03-lingkungan.txt | ai-formal | 227 | 0,6248 | SEDANG |
| ai-04-kesehatan-mental.txt | ai-formal | 223 | 0,6281 | SEDANG |
| ai-05-ekonomi-digital.txt | ai-formal | 226 | 0,6499 | SEDANG |
| ap-01-teknologi-pendidikan.txt | ai-paraphrase | 238 | 0,1615 | RENDAH |
| ap-02-media-sosial.txt | ai-paraphrase | 209 | 0,1597 | RENDAH |
| ap-03-lingkungan.txt | ai-paraphrase | 210 | 0,1925 | RENDAH |
| ap-04-kesehatan-mental.txt | ai-paraphrase | 220 | 0,2160 | RENDAH |

## Ringkasan per kategori

| Kategori | n | Rata-rata | Rentang | RENDAH | SEDANG | TINGGI |
|---|---:|---:|---:|---:|---:|---:|
| human-formal | 5 | 0,2415 | 0,0859–0,3128 | 5 | 0 | 0 |
| human-personal | 4 | 0,1834 | 0,1395–0,2209 | 4 | 0 | 0 |
| ai-formal | 5 | 0,6385 | 0,6159–0,6740 | 0 | 4 | 1 |
| ai-paraphrase | 4 | 0,1824 | 0,1597–0,2160 | 4 | 0 | 0 |

## Positif palsu & negatif palsu (pada pita vonis situs)

- **Positif palsu** (manusia = human-formal + human-personal, n=9):
  terindikasi ≥ 0,35 sebanyak **0/9 (0%)**; terindikasi tinggi ≥ 0,65
  sebanyak **0/9 (0%)**.
- **Negatif palsu** (ai-formal, n=5): lolos sebagai manusia (< 0,35)
  sebanyak **0/5 (0%)**; tidak mencapai pita tinggi (< 0,65) sebanyak
  **4/5 (80%)** — kelimanya tetap tertandai, empat di antaranya di pita
  SEDANG (“Campuran — perlu pemeriksaan dosen”).
- **ai-paraphrase** (n=4): keempatnya RENDAH — tidak tertandai sama sekali.

## Tiga temuan utama

1. **Tulisan manusia formal tidak terindikasi.** Kekhawatiran utama Tahap 1
   — prosa akademik formal yang kaya penghubung baku (“merupakan salah
   satu”, “salah satu subjek penelitian”) terjerat kamus frasa — **tidak
   terbukti** pada sampel ini. Kepadatan frasa sampel Wikipedia hanya
   0,0–1,1 per 100 kata, jauh di bawah teks AI generik (5,3–10,6 per 100
   kata), dan skor tertinggi manusia (0,3128, hf-03) masih di bawah garis
   SEDANG 0,35. Yang menaikkan skor sampel Wikipedia terutama burstiness
   (kalimat ensiklopedis memang seragam: 0,65–0,98) dan, pada hf-03,
   pengulangan nama/topik — tetapi tanpa kepadatan frasa, skor akhir tetap
   rendah. Pemisahan kelas bersih: ada celah kosong antara skor manusia
   tertinggi (0,3128) dan skor ai-formal terendah (0,6159).

2. **Teks AI generik tertandai, tetapi menumpuk tepat di bawah garis
   TINGGI.** Kelima ai-formal bergerombol di 0,6159–0,6740 (rata-rata
   0,6385). Profil sinyalnya konsisten: burstiness jenuh (1,00), frasa
   tinggi (0,89–0,96), simetri paragraf tinggi (0,90–1,00) — tetapi
   pengulangan 4-gram = 0 dan sisa markdown = 0, sehingga dua “dorongan
   bukti gabungan” mesin (yang mensyaratkan pengulangan pola atau markdown
   bertemu kepadatan frasa) tidak pernah menyala. Inilah yang membedakan
   profil ini dari dokumen refleksi birokrasi (REFLEKSI 0,7953) yang memang
   menjadi target kalibrasi mesin. Akibat praktisnya: esai AI generik yang
   bersih kemungkinan besar tampil sebagai “Campuran — perlu pemeriksaan
   dosen”, bukan “Indikasi AI tinggi”. Ini **kurang tegas, tetapi bukan
   kegagalan deteksi** — tidak satu pun lolos sebagai tulisan manusia.

3. **Parafrase agresif tidak terdeteksi — dan tidak bisa diperbaiki dengan
   ambang.** Keempat ap-* memperoleh skor frasa 0,00 (kamus terhindari
   sepenuhnya) dan burstiness 0,39–0,72. Rentang skornya (0,1597–0,2160)
   **tumpang tindih hampir persis** dengan human-personal (0,1395–0,2209).
   Artinya, tidak ada ambang yang bisa menangkap kategori ini tanpa
   sekaligus menjerat tulisan manusia personal dalam jumlah yang sama.
   Ini batas mendasar heuristik permukaan, dan sudah dinyatakan terbuka di
   situs (“teks AI yang diparafrase bisa lolos”). Perbaikannya adalah
   pekerjaan Tahap 2 (classifier Bahasa Indonesia yang lebih relevan),
   bukan penyesuaian ambang.

## Keputusan kalibrasi ulang: TIDAK dilakukan

Alasan:

- Pemicu yang ditetapkan untuk kalibrasi ulang — sampel manusia-formal
  menumpuk di pita SEDANG/TINGGI — **tidak terjadi** (positif palsu 0/9;
  semua sampel manusia RENDAH).
- Tidak ada ai-formal yang lolos sebagai manusia (negatif palsu < 0,35 =
  0/5). Temuan no. 2 adalah kekurangan ketegasan di tepi pita, bukan
  kesalahan klasifikasi yang sistematis; kelas manusia dan AI terpisah
  bersih pada kumpulan uji ini.
- n per kategori hanya 4–5, dan sampel ai-formal ditulis oleh penulis yang
  sama yang akan menyetel bobotnya — menyetel ulang bobot/ambang global
  dari sampel sekecil dan seterkait itu berisiko *overfitting* dan
  mengganggu kalibrasi REFLEKSI/GEMINI yang menjadi alasan mesin ini
  dibangun.
- Temuan no. 3 membuktikan penyesuaian ambang tidak dapat memperbaiki
  kelemahan terbesar (parafrase) tanpa menciptakan positif palsu baru.

Yang dicatat sebagai **bahan Tahap 2**: bila kumpulan uji diperbesar
dengan sampel independen (tulisan mahasiswa asli + keluaran beberapa LLM),
tinjau kembali posisi garis TINGGI 0,65 terhadap gerombolan ai-formal
0,62–0,67 — satu-satunya kandidat penyesuaian yang teridentifikasi di sini.

## Kejujuran cakupan

Angka-angka di atas berasal dari 18 teks: 4 kutipan Wikipedia adaptasi,
1 contoh bawaan situs, dan 13 teks yang ditulis khusus untuk benchmark ini
(lihat `README.md`). Kategori human-personal adalah gaya-manusia simulasi.
Jangan baca hasil ini sebagai “akurasi 100%” — baca sebagai: pada
kumpulan uji awal yang kecil ini, mesin tidak menjerat tulisan manusia,
menandai semua teks AI generik (kebanyakan di pita tengah-atas), dan —
sesuai keterbatasan yang sudah diakui — tidak menangkap teks AI yang
ditulis ulang secara agresif.
