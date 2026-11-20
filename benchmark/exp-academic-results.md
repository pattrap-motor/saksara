# Eksperimen Saksara — Pengulangan Sadar-Istilah & Kutipan Bersitasi

Branch: `saksara-exp-academic-repetition` (dari main `f1b28ef`, produksi v0.15.0-beta)
Tanggal: 21 November 2026. Status: **EKSPERIMEN SELESAI — semua gerbang LULUS. Menunggu keputusan pemilik; belum di-merge, belum di-deploy.**

## Masalah (laporan pemilik, 21 Nov 2026 ±02:01 WIB)

1. Kalimat dari naskah penelitian (kasus inkubator telur berbasis Arduino) dinilai SEDANG (36%) padahal pengulangan yang terdeteksi adalah istilah penelitiannya sendiri — mesin belum membedakan pengulangan *terminologi* dari pengulangan *templat*.
2. Kutipan yang memakai sitasi tetap ikut dinilai oleh detektor.

## Diagnosis terukur (mesin produksi f1b28ef)

Rekonstruksi naskah setara (474 kata: judul + abstrak + pendahuluan + metode + kesimpulan, satu kutipan bersitasi) — berkas `benchmark/exp-academic-corpus/inkubator.txt`:

- Skor dokumen **0,4753 (SEDANG)**; sinyal pengulangan **1,000 (jenuh)** dari 5 pola 4 kata, semuanya istilah: "sistem inkubator telur berbasis" (8×), "inkubator telur berbasis arduino" (8×), "telur berbasis arduino yang" (3×), "monitoring suhu dan kelembapan" (7×).
- Kalimat sasaran (kalimat tujuan penelitian): **0,4055** dengan repSent = 1,0 — persis mekanisme pada tangkapan layar pemilik.
- Penyebab: `repetitionSignal` (bobot 0,22) dan bukti per kalimat menghitung semua rangkaian 4 kata yang berulang ≥3× tanpa membedakan kata isi topik dari frasa templat; tahap dorongan `0,22 × min(densityScore, rep)` ikut menguatkan.

## Perbaikan yang diuji

1. **Pengulangan sadar-istilah** (di dalam `analyze()`, blok `EXP`): istilah topik = kata isi (bukan kata fungsi) yang muncul ≥ max(4, 1% jumlah kata) kali, ditambah kata isi dari paragraf pertama yang pendek (judul). Rangkaian 4 kata yang ≥3 dari 4 katanya adalah istilah topik dihitung seberat `termWeight` dari sinyal pengulangan dan tidak lagi ditampilkan sebagai bukti "pola berulang" per kalimat.
2. **Penjaga pengulangan panjang** (`longGuard`): rangkaian yang berada di dalam rangkaian 7 kata yang juga berulang ≥3× adalah penyalinan templat, BUKAN terminologi — tetap dihitung penuh. Penjaga ini yang membedakan abstrak skripsi (istilah diulang di dalam kalimat yang berubah-ubah) dari esai AI yang mengulang frasa topiknya sebagai klausa utuh yang sama persis.
3. **Kutipan bersitasi dikeluarkan** (`stripQuotedCitations`, praproses selalu-aktif sejajar stripListSections/stripStructuralHeadings): kutipan langsung ≥8 kata yang melekat pada sitasi berperan tahun 4 digit — pola "(Nama, Tahun) "kutipan"" maupun ""kutipan" (Nama, Tahun)" — dikeluarkan dari teks yang dinilai dan diumumkan di banner hasil + catatan PDF, tidak pernah diam-diam.

## Hasil (konfigurasi pemenang: termMin 3, termWeight 0, longGuard aktif, + strip kutipan)

| Korpus | Sebelum | Sesudah | Keterangan |
|---|---|---|---|
| Inkubator (dokumen) | 0,4753 SEDANG | **0,2825 RENDAH** | Δ −0,193; rep 1,000 → 0 |
| Inkubator (kalimat sasaran) | 0,4055 | **0,1951** | repSent 1,0 → 0 |
| AI-topik adversarial* | 0,7967 TINGGI | **0,7967 TINGGI** | identik bit |
| Kalibrasi 4 sampel | golden | **identik bit** | pita tidak berubah |
| Benchmark 18 sampel | golden | **identik bit** | FP manusia 0/9; AI formal lolos 0/5 |

\*Esai AI yang mengulang frasa topiknya persis seperti terminologi (`benchmark/exp-academic-corpus/ai-topik.txt`) — uji lubang keamanan perbaikan ini.

Ablasi: filter istilah menyumbang hampir seluruh perbaikan (dokumen 0,4753 → 0,2928); strip kutipan menambah −0,010 (0,2928 → 0,2825; 29 kata kutipan terbuang) dan yang lebih penting mengeluarkan materi kutipan dari penilaian sama sekali. Tanpa `longGuard`, varian yang sama menjatuhkan AI-topik ke 0,559 (satu pita) — penjaga ini wajib, bukan pelengkap.

## Gerbang kualitas

- **G-A efikasi** (dokumen inkubator turun ≥0,10 DAN kalimat sasaran <0,35): **LULUS** (−0,193; 0,1951).
- **G-B integritas benchmark** (18 skor identik, FP 0/9, AI lolos 0/5): **LULUS**.
- **G-C kalibrasi** (4 skor identik, pita tidak berubah): **LULUS**.
- **G-D adversarial** (AI-topik tidak turun >0,10 dan tidak di bawah 0,35): **LULUS** (Δ 0,000).
- **Regression Gate pada berkas varian: PASS** — baseline Phase 0 tidak berubah, sehingga perbaikan ini dapat dirilis tanpa mengubah baseline.
- Suite lain pada berkas varian: wf 25/25 · cmp 30/30 · eval 38/38 · prod 21/21 · feature-harness PASS.
- Kinerja: ±100 ribu kata 515 ms vs 452 ms produksi (+±14%, tidak terasa).

## Batasan yang jujur

- Korpus akademik positif baru satu dokumen rekonstruksi (kasus pemilik) + benchmark yang ada; generalisasi ke semua gaya skripsi belum terbukti. Bahan donasi teks akademik dari grup dosen adalah validasi lanjutan yang ideal.
- Strip kutipan hanya menangkap kutipan bertanda kutip dengan sitasi berperan tahun; kutipan parafrase dan kutipan tanpa sitasi tidak tersentuh (memang di luar klaim perbaikan ini).
- Konfigurasi eksperimen masih memakai saklar `EXP_CFG` di dalam kode; untuk rilis produksi saklar dibekukan ke konfigurasi pemenang.

## Rekomendasi

Rilis ke produksi sebagai perbaikan terukur: semua gerbang lulus, baseline tidak berubah, dan satu-satunya korpus yang berubah skor adalah pola kasus yang dilaporkan pemilik. Keputusan akhir di tangan pemilik.
