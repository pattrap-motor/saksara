# VeritasAI — Benchmark Bahasa Indonesia (Tahap 1)

Kumpulan uji awal (*starter test set*) untuk mengukur perilaku **Ensemble
Heuristik v3** pada teks Bahasa Indonesia: seberapa sering tulisan manusia
formal terindikasi AI (positif palsu), dan seberapa sering teks AI generik
lolos atau hanya mendarat di pita tengah (negatif palsu).

## Cara menjalankan

```bash
node benchmark/run-benchmark.cjs
```

Runner mengekstrak mesin heuristik **langsung dari `../index.html`** pada
setiap run — yang diuji selalu kode persis yang dipakai situs, bukan salinan
yang bisa menyimpang. Runner juga menjalankan ulang 5 contoh kalibrasi
bawaan situs sebagai penjaga regresi. Hasil pengukuran terakhir ada di
[`results.md`](results.md).

## Isi kumpulan uji (18 teks, ±200–400 kata)

| Awalan berkas | Kategori | n | Asal |
|---|---|---:|---|
| `hf-` | human-formal | 5 | Tulisan manusia bergaya akademik/formal |
| `ai-` | ai-formal | 5 | Teks AI bergaya LLM generik yang dipoles |
| `ap-` | ai-paraphrase | 4 | Hasil tulis-ulang dari `ai-01` s.d. `ai-04` |
| `hp-` | human-personal | 4 | Teks reflektif/naratif bergaya personal |

### human-formal (`hf-01` s.d. `hf-04`) — Wikipedia bahasa Indonesia

Kutipan yang **diadaptasi** dari artikel Wikipedia bahasa Indonesia
(berlisensi CC BY-SA; adaptasi = penanda sitasi dan aksara non-Indonesia
dibuang, teks dipangkas menjadi 200–400 kata, redaksi isi tidak diubah):

- `hf-01-majapahit.txt` — artikel **“Majapahit”** (id.wikipedia.org)
- `hf-02-fotosintesis.txt` — artikel **“Fotosintesis”** (id.wikipedia.org)
- `hf-03-borobudur.txt` — artikel **“Borobudur”** (id.wikipedia.org)
- `hf-04-demokrasi.txt` — artikel **“Demokrasi”** (id.wikipedia.org)

### human-formal (`hf-05`) — contoh bawaan situs

- `hf-05-magang.txt` — contoh uji “Tulisan Manusia” (esai pengalaman magang)
  yang tertanam di situs, disalin apa adanya dari `index.html`.

### ai-formal (`ai-01` s.d. `ai-05`)

Teks yang dihasilkan model bahasa untuk benchmark ini dengan gaya LLM
generik yang khas: penghubung formulaik padat (“selain itu”, “dengan
demikian”, “merupakan salah satu”, “kesimpulannya”), kalimat seragam
15–25 kata, paragraf simetris berpembuka generik, tanpa rincian konkret.
Topik: teknologi pendidikan, media sosial remaja, lingkungan hidup,
kesehatan mental mahasiswa, ekonomi digital/UMKM.

### ai-paraphrase (`ap-01` s.d. `ap-04`)

Tulis-ulang manual dari `ai-01` s.d. `ai-04` dengan isi yang sama, tetapi
permukaannya diubah secara agresif untuk menghindari pola yang diukur
heuristik: sinonim penghubung, panjang kalimat sangat bervariasi (termasuk
fragmen pendek), paragraf direstrukturisasi, dan disisipi rincian konkret
(nama tempat, angka, pengamatan orang pertama). Kategori ini mensimulasikan
kasus tersulit: teks AI yang sudah diedit kuat menyerupai tulisan manusia.

### human-personal (`hp-01` s.d. `hp-04`)

Teks reflektif/naratif (tinggal di kos, KKN, ojek daring sambil kuliah,
begadang skripsi) yang ditulis untuk benchmark ini dengan suara personal
yang sengaja tidak dipoles: ritme tidak teratur, rincian sangat spesifik,
sesekali fragmen kalimat. **Keterbatasan yang diakui:** ini adalah sampel
*gaya-manusia simulasi*, bukan tulisan mahasiswa asli yang dikumpulkan dari
lapangan — penulisnya tahu persis sinyal apa yang diukur mesin, jadi
kategori ini cenderung optimistis.

## Keterbatasan kumpulan uji ini

- **n kecil** (18 teks; 4–5 per kategori). Semua angka di `results.md`
  adalah indikasi awal, bukan estimasi akurasi yang bisa digeneralisasi.
- **Satu penulis** untuk kategori `ai-*`, `ap-*`, dan `hp-*` — gaya satu
  model bahasa dan satu gaya parafrase; keluaran LLM lain (dan suntingan
  mahasiswa sungguhan) bisa berperilaku berbeda.
- Wikipedia adalah prosa ensiklopedis suntingan banyak orang, bukan tugas
  mahasiswa; ia mewakili ujung paling formal dari tulisan manusia.
- Belum ada teks campuran manusia+AI, teks terjemahan mesin, atau teks dari
  mata kuliah eksakta dengan banyak istilah teknis berulang.

Perluasan yang disarankan untuk Tahap 2: kumpulkan tulisan mahasiswa asli
(dengan izin), keluaran beberapa LLM berbeda tanpa instruksi gaya, dan
parafrase ringan (bukan tulis-ulang total), lalu ukur ulang sebelum
menyentuh bobot atau ambang mesin.
