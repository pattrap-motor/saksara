# Rencana UI Phase 2 — Dashboard SaaS Modern (Saksara)

Tanggal: 20 November 2026 · Branch: `saksara-phase2-dashboard` (dari `saksara-phase1-stabilization`)
Prinsip: **mesin tidak berubah** — Ensemble Heuristik v3, 7 sinyal, bobot, kalibrasi,
ambang, model classifier, gerbang 0,35, Sinyal Waspada, dan endpoint serverless utuh.
Gerbang regresi Phase 1 adalah buktinya: keluaran mesin harus identik dengan baseline.

## Audit ringkas (keadaan v0.9.14-beta)

- **Arsitektur:** satu `index.html`; SPA hash-router — 4 view (`home`, `cara-kerja`,
  `metode`, `posisi`) ditandai `data-view`; router memetakan `#/…` + jangkar legacy
  (`#analisis`, `#batch`, `#clf-panel`, `#benchmark`, …) ke view+jangkar. Semua id dan
  handler analisis sudah stabil dan teruji — **layak dipertahankan, tanpa framework baru**.
- **View home saat ini** menumpuk hero + panel analisis + laporan + batch dalam satu
  halaman panjang; tidak ada halaman "detector" tersendiri dan tidak ada ringkasan
  beranda selain strip statistik benchmark (yang jujur dan dipertahankan).
- **Sudah tersedia** (tidak perlu dibangun ulang): status loading tombol Analisis
  ("Menganalisis…" + disabled), tombol Bersihkan (reset), Salin Ringkasan, laporan PDF,
  filter kalimat, panel classifier, disclaimer kejujuran.
- **Navigasi:** topbar (mobile: menu baris kedua yang dapat digeser). Belum ada sidebar.

## Perubahan yang dilakukan

1. **Shell aplikasi:** sidebar desktop (≥1024px) — merek, 5 tautan rute (Beranda,
   Detector, Cara Kerja, Metode, Posisi & Batasan), tombol Mulai Analisis, kotak status
   versi. Di bawah 1024px sidebar hilang dan topbar yang ada tetap menjadi navigasi
   mobile (ditambah tautan Detector). Status aktif mengikuti `data-route` yang sudah
   dipakai router — tanpa logika navigasi baru.
2. **View baru `detector`:** section Analisis, Laporan, dan Batch dipindah dari `home`
   ke `detector` (atribut `data-view` saja). Router: rute `#/detector` + judul; jangkar
   legacy `#analisis/#report/#batch/#clf-panel/#panel-analisis` diarahkan ke view
   detector — **semua tautan lama tetap berfungsi**. Di panel analisis ditambah satu
   baris disclaimer: skor adalah indikasi statistik, bukan bukti mutlak kepengarangan.
3. **Dashboard (view home):** hero + strip statistik dipertahankan; ditambah:
   - **Kartu akses cepat** (Detector, Batch, Cara Kerja, Metode & Benchmark, Posisi &
     Batasan, Panel Classifier).
   - **Panel "Aktivitas sesi ini"** — data NYATA sesi berjalan saja: jumlah analisis,
     analisis terakhir (skor, pita, jumlah kata, jam), batch terakhir, status classifier
     dan cache model. **Empty state** informatif bila belum ada analisis. Tidak ada
     statistik palsu; tidak ada yang disimpan (memori tab saja, sejalan janji privasi).
   - **Panel status perangkat** (mesin siap lokal, status classifier/cache dari state
     aplikasi yang sebenarnya).
   - **Ringkasan fitur** — 6 kartu ringkas dengan tautan ke halaman terkait.
4. **Pengait (hook) minimal di naskah yang ada** (3 baris pemanggil, tanpa mengubah
   logika): selesai laporan → catat aktivitas; selesai classifier → segarkan skor
   tercatat dari tampilan; selesai batch → catat aktivitas batch. Fungsi dashboard
   ditambahkan sebagai satu blok baru sebelum router.
5. **CSS:** satu blok tambahan di akhir `<style>` (awalan kelas `side-`, `dash-`,
   `qa-`, `feat-`) memakai variabel tema yang ada (Langit Cerah, mode gelap otomatis),
   radius & bayangan dari token yang ada, `:focus-visible` yang jelas. Textarea
   detector sedikit lebih tinggi (280px desktop).
6. **Versi:** v0.10.0-beta + entri Catatan Rilis baru (teks footer & dialog saja).

## Yang TIDAK berubah

Seluruh naskah mesin (irisan `PHRASES_OLD` … penanda `$` tidak disentuh), semua id
elemen yang ada, kontrak Sheet/telemetri/donasi, `sw.js`, `vercel.json`, `api/*`,
dan perilaku setiap tombol yang ada. Tidak ada dependensi baru.

## Verifikasi

Gerbang regresi + benchmark + feature-harness setelah setiap tahap; uji fungsi di
preview (detector 77%/9%, unggah berkas uji, navigasi semua view, tombol-tombol,
konsol bersih); tangkapan layar desktop & mobile untuk laporan.
