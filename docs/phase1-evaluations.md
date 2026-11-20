# Evaluasi Phase 1 — Batch, Endpoint Serverless, Memori Classifier, WebGPU/WASM

Tanggal: 20 November 2026 · Ruang lingkup: evaluasi saja — **tidak ada
perubahan perilaku** pada fase ini selain identitas & gerbang regresi.
Tidak ada API berbayar yang ditambahkan.

## 1. Batas batch (jumlah & ukuran)

**Keadaan sekarang** (dari kode `processBatch` / `scoreBatchText`):
- Per berkas: ≤ 20 MB (`MAX_FILE_BYTES`), teks dianalisis ≤ 100.000 kata
  pertama (`MAX_ANALYZE_WORDS`) — sama seperti mode tunggal.
- Jumlah berkas: **tanpa batas eksplisit**; antrean diproses berurutan,
  satu berkas pada satu waktu, sehingga memori tetap rendah (satu teks
  berkas + metadata baris hasil). Galat per berkas tidak menghentikan antrean.
- Bila classifier aktif, setiap berkas dinilai dengan gerbang yang sama
  seperti mode tunggal (konsisten — terverifikasi di `scoreBatchText`).

**Penilaian:** kebenaran hasil aman; risiko hanya waktu tunggu pengguna
yang memilih ratusan berkas (di HP, ratusan × penilaian classifier bisa
berjam-jam dan menguras baterai).

**Rekomendasi (ditunda ke fase berikutnya, butuh keputusan teks UI):**
batas 50 berkas per antrean dengan pesan yang jujur + estimasi kasar.
Implementasi = penjaga kecil di `processBatch`, tidak menyentuh skor.

## 2. Endpoint serverless (`api/`)

| Endpoint | Yang diterima | Validasi | Yang ditulis |
|---|---|---|---|
| `simpan-hasil.js` | Skema hasil 16 kolom (tanpa teks) | Bentuk payload dari klien resmi; kunci OAuth hanya di env Vercel | Tab `Hasil` |
| `kalibrasi.js` | Statistik skor saja | **Kolom teks apa pun → 400** (`FORBIDDEN_FIELDS`), semua skor divalidasi 0–1, `signals` wajib objek 7 kunci | Tab `Kalibrasi` |
| `donasi.js` | Teks + label + persetujuan | Label wajib, centang persetujuan wajib, panjang 200–45.000 karakter | Tab `Donasi` |

**Penilaian:** ketiganya publik tanpa autentikasi — memang begitu desain
situs statis tanpa akun. Rahasia (refresh token Google) tidak pernah keluar
dari server. Risiko sisa yang diterima secara sadar: **baris spam** pada
Sheet pemilik (dampak rendah, terlihat, dapat dihapus; tidak ada biaya).
Opsi mitigasi tanpa API berbayar bila suatu hari diperlukan: aturan
rate-limit/firewall di dashboard Vercel (keputusan pemilik, di luar kode).
**Tidak ada perubahan yang diusulkan pada fase ini.**

## 3. Penggunaan memori classifier

- Unduhan: 278.852.521 byte (6 berkas) disimpan di **Cache API** (disk),
  hanya atas persetujuan pengguna; dapat dihapus dari panel yang sama.
- Saat aktif: buffer grafik + 5 shard (±279 MB) ditahan di RAM (`clfBuffers`)
  agar sesi dapat dibuat ulang sebagai WASM bila WebGPU gagal — ini biaya
  memori yang disengaja demi ketahanan. Ditambah overhead sesi ORT dan
  tensor per jendela (jendela ±1.200 karakter, satu per satu — kecil).
- Perangkat lemah: batas segmen turun ke 30 (dari 100) berdasarkan
  `pointer: coarse` / inti CPU ≤ 4 / `deviceMemory` ≤ 4.
- Degradasi anggun: bila sesi gagal dibuat (RAM tidak cukup, peramban lama),
  panel classifier berstatus galat dan **heuristik tetap bekerja penuh** —
  tidak ada keadaan di mana situs kehilangan fungsi utamanya.

**Penilaian:** wajar untuk model ±280 MB di peramban. Risiko sisa: HP RAM
2 GB dapat gagal memuat sesi; perilaku cadangannya sudah benar (galat
terbuka, bukan diam-diam).

## 4. WebGPU dan fallback CPU/WASM

- Urutan penyedia: **WebGPU dicoba lebih dulu**, cadangan **WASM**
  (onnxruntime-web 1.31.1). Bila inferensi WebGPU gagal di tengah penilaian,
  sesi dibuat ulang sebagai WASM **satu kali** dan penilaian dilanjutkan.
- WASM berutas majemuk aktif berkat header COOP/COEP di `vercel.json`
  (`crossOriginIsolated`), jumlah utas ≤ 4.
- **Status verifikasi:** jalur WASM terverifikasi ekstensif (skor acuan
  0,8069 / 0,0280 pada teks uji; seluruh verifikasi rilis memakai jalur ini).
  Jalur **WebGPU belum terverifikasi di peramban GPU nyata** (B-06 tetap
  terbuka) — lingkungan uji yang tersedia tidak menyediakan GPU. Skor dari
  model yang sama pada dua penyedia dapat berbeda pada tingkat presisi
  floating-point kecil; gerbang penguat (classifier hanya menaikkan, ×0,5)
  membuat perbedaan sekecil itu tidak mengubah pita vonis pada kasus batas
  yang wajar, tetapi klaim "identik" tidak dibuat di sini.
- **Rekomendasi:** satu sesi uji di perangkat ber-GPU (Chrome desktop/Android
  terbaru) untuk menutup B-06; tanpa perubahan kode.

## Ringkasan keputusan Phase 1 untuk item evaluasi

- Batch: aman; usulan batas 50 berkas **ditunda** (menunggu fase UI).
- Endpoint: tidak ada perubahan; risiko spam dicatat & diterima.
- Memori classifier: wajar; degradasi anggun terverifikasi dari kode.
- WebGPU: fallback kuat; verifikasi perangkat nyata **tertunda** (B-06).
