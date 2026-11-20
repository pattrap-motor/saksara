# Phase 5 — Benchmark Center: Audit Dataset, Metode Evaluasi & Rencana Halaman

Branch: `saksara-phase5-benchmark-center` (dari ujung Phase 4, `885c53a`).
Prinsip: halaman `#/benchmark` hanya menampilkan angka yang benar-benar dihitung
dari data valid dengan provenans yang tercantum. Tidak ada metrik generalisasi
tanpa pemisahan data yang terbukti; status "belum tersedia" lebih baik daripada
angka karangan.

## 1. Audit dataset (dijalankan & diverifikasi 20 Nov 2026 — `audit-dataset.cjs`)

### Inventaris

| Set | n | Manusia | AI | Peran |
|---|---:|---:|---:|---|
| Benchmark regresi (benchmark/samples) | 18 | 9 (5 formal + 4 personal) | 9 (5 AI formal + 4 parafrase AI) | Gerbang regresi Phase 1 — BUKAN set uji representatif |
| VeritasAI-ID v0 train | 18.053 | 15.639 | 2.414 | Latih (Saksara Core) — tidak dievaluasi di halaman |
| VeritasAI-ID v0 dev | 2.257 | 1.996 | 261 | Pemilihan model Core — tidak dievaluasi di halaman |
| VeritasAI-ID v0 test | 2.257 | 1.933 | 324 | **Dievaluasi** (heuristik) |
| VeritasAI-ID v0 stress formal | 1.000 | 1.000 | 0 | **Dievaluasi** (FPR manusia formal) |
| COLING-2025 external test | 889 | 459 | 430 | **Dievaluasi** (generator tak terlihat: GPT-4o) |

Sumber v0: M4-id, Liputan6, Wikipedia ID, id_newspapers_2018 (berita +
ensiklopedis saja; **tidak ada domain esai/tugas mahasiswa**). Seluruh AI v0 =
gpt-3.5-turbo; AI eksternal = GPT-4o. Lisensi campuran, komponen M4 =
CC BY-NC-SA-4.0 (NonCommercial) — halaman hanya menampilkan agregat, tidak
menerbitkan ulang teks dataset.

### Verifikasi independen atas klaim DATASET_CARD (semua terbukti)

- Jumlah & distribusi label per berkas: **persis** seperti kartu dataset.
- Duplikasi eksak (md5 ternormalisasi): **0** di dalam setiap berkas dan
  **0** lintas split.
- Pelanggaran group-split (cluster_id yang sama di >1 split): **0** dari
  19.670 cluster unik pada train/dev/test.
- Dekontaminasi terhadap 18 sampel benchmark (tumpang-tindih 13-gram): **0**
  dokumen di semua berkas — set regresi dan set evaluasi v0 benar-benar terpisah.
- Ketidakseimbangan kelas v0: 87 : 13 (manusia : AI) — akurasi mentah tidak
  cukup; metrik per kelas wajib ditampilkan.

### Keterbatasan yang mengikat interpretasi

1. 18 sampel regresi dipilih manual untuk gerbang rilis — kecil, tidak acak,
   tidak representatif. Angka atasnya adalah *uji kewarasan*, bukan generalisasi.
2. v0 berdomain berita/ensiklopedis (50–2.000 kata); genre utama produk adalah
   esai/tugas. Hasil v0 tidak melisensikan klaim atas esai, dan sebaliknya.
3. AI v0 satu generator (GPT-3.5, era 2023); set eksternal GPT-4o adalah
   satu-satunya jendela lintas-generator.
4. Ambang heuristik (0,35/0,65) dikalibrasi pada contoh bawaan situs; v0 tidak
   dipakai untuk tuning ambang, tetapi pemisahan "tidak pernah dilihat selama
   pengembangan" tidak dapat dibuktikan sempurna — angka v0 adalah indikasi
   terukur, bukan jaminan.

## 2. Evaluasi yang dijalankan

### A. Ensemble Heuristik v3 atas v0 (`evaluate-v0.cjs`, analyze() persis produksi)

Hasil utama pada ambang produksi 0,35 (kelas positif = AI):

| Set | n | Akurasi | Precision | Recall | F1 | FPR | FNR |
|---|---:|---:|---:|---:|---:|---:|---:|
| test (GPT-3.5) | 2.257 | 0,888 | 0,781 | 0,309 | 0,442 | 0,014 | 0,691 |
| stress formal | 1.000 | 0,981 | — | — | — | 0,019 | — |
| external (GPT-4o) | 889 | 0,519 | 0,542 | 0,030 | 0,057 | 0,024 | 0,970 |

Pada ambang 0,65 (pita TINGGI): TP = 0 pada test maupun external — tidak ada
dokumen AI v0 yang mencapai pita indikasi tinggi. Rata-rata skor: test manusia
0,190 vs AI 0,320; external manusia 0,203 vs AI 0,285. Bacaan jujurnya: Lapis 1
sangat konservatif — jarang menuduh manusia (FPR 1,4–2,4% pada 3.392 dokumen
manusia) tetapi lemah menangkap AI berdomain berita, dan nyaris tidak menangkap
GPT-4o. Inilah alasan arsitektur dua lapis dan bahasa "indikasi, bukan bukti".

Rincian per kategori (metadata tersedia): per domain (berita FPR 0,48%;
ensiklopedis FPR 3,18% — semua AI ada di berita/M4), per sumber, per kantong
panjang (<300 / 300–800 / >800 kata). Recall pada kategori tanpa dokumen AI
ditampilkan sebagai tidak terdefinisi, bukan nol.

### B. Set regresi 18 sampel — dihitung LIVE di halaman

Halaman menyematkan 18 teks sampel (fikstur milik proyek sendiri) dan
menjalankan `analyze()` produksi saat halaman dibuka: skor per sampel (harus
sama persis dengan baseline Phase 0 — konsistensi terbukti di halaman itu
sendiri), confusion matrix + metrik pada 0,35, dan rincian per kategori
sampel (formal/personal/parafrase).

### C. Classifier & gabungan pada set regresi (bila terhitung)

Skor classifier per sampel dihitung offline satu kali dengan pipeline yang
sama persis seperti produksi (chunk ±1.200 karakter per paragraf, rata-rata
probabilitas AI; model `saksara/ai-text-detector-onnx`, id2label 1 = ChatGPT),
lalu disematkan sebagai data statis berprovenans (tanggal + metode). Halaman
menghitung metrik classifier (ambang ilustratif 0,5 — produksi tidak memakai
classifier sendirian) dan gabungan (rumus blend produksi, ambang 0,35) dari
skor heuristik live + skor classifier statis tersebut. Bila perhitungan
offline gagal, panel ini berstatus **belum tersedia** dengan alasannya.

## 3. Definisi metrik (dicetak di halaman)

Kelas positif = "terindikasi AI" (skor ≥ ambang); negatif = manusia.
TP/FP/TN/FN; Accuracy = (TP+TN)/n; Precision = TP/(TP+FP); Recall =
TP/(TP+FN); F1 = harmonik precision–recall; FPR = FP/(FP+TN); FNR =
FN/(FN+TP); Specificity = TN/(TN+FP). Pembagi nol → metrik ditampilkan
"tidak terdefinisi" (bukan 0). Macro-average = rata-rata metrik dua kelas;
weighted-average = rata-rata berbobot dukungan kelas. Keduanya dihitung
untuk set regresi live; agregat v0 menampilkan metrik kelas positif +
specificity karena distribusinya timpang.

## 4. Isi halaman `#/benchmark`

Ringkasan status evaluasi · inventaris & audit dataset (tabel + hasil
verifikasi) · evaluasi live set regresi (confusion matrix, metrik, tabel per
sampel, per kategori) · hasil v0 (kartu per set + rincian kategori + provenans
skrip/tanggal) · panel classifier & gabungan (atau status belum tersedia) ·
distribusi kelas (batang CSS) · metodologi & keterbatasan · ekspor CSV/JSON
lokal dari angka yang ditampilkan. Tanggal evaluasi & versi mesin tercantum.
Tidak ada teks dataset v0 yang ditampilkan; tidak ada data pengguna; tidak
ada API berbayar; seluruh perhitungan live berjalan di peramban.
