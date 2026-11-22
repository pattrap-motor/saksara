/* Phase 8.1 — Node tests for the Writing Intelligence core (extracted from index.html). */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

const coreRaw = html.split("WI-CORE-START")[1].split("/* WI-CORE-END */")[0];
const core = coreRaw.slice(coreRaw.indexOf("*/") + 2);

const sandbox = {};
new Function("sandbox", core +
  "\nsandbox.wiAnalyze = wiAnalyze; sandbox.wiApply = wiApply; sandbox.WI_MAX_CHARS = WI_MAX_CHARS; sandbox.wiSentences = wiSentences;")(sandbox);
const wiAnalyze = sandbox.wiAnalyze, wiApply = sandbox.wiApply, wiSentences = sandbox.wiSentences;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}
function kinds(r) { return r.suggestions.map(s => s.kind); }
function joinRes(r, paras) {
  const ps = paras || r.paragraphs;
  let out = "";
  ps.forEach((p, i) => { out += p; if (i < r.separators.length) out += r.separators[i]; });
  return out;
}
function invariantsHold(r) {
  const by = {};
  for (const s of r.suggestions) {
    if (r.paragraphs[s.pIdx].slice(s.start, s.end) !== s.original) return "original mismatch: " + s.id;
    (by[s.pIdx] = by[s.pIdx] || []).push(s);
  }
  for (const k in by) {
    const a = by[k].slice().sort((x, y) => x.start - y.start);
    for (let i = 1; i < a.length; i++) if (a[i].start < a[i - 1].end) return "overlap in paragraph " + k;
  }
  return true;
}

console.log("1) Input kosong / hanya spasi");
check("empty string -> 0 suggestions", wiAnalyze("").suggestions.length === 0);
check("whitespace only -> 0 suggestions", wiAnalyze("   \n\n  ").suggestions.length === 0);
check("null -> 0 suggestions", wiAnalyze(null).suggestions.length === 0);

console.log("2) Tiap aturan memicu pada contoh positif");
const rep = wiAnalyze("Saya pergi ke ke pasar.");
check("repeated-word fires", rep.suggestions.length === 1 && rep.suggestions[0].kind === "repeated-word", kinds(rep));
check("repeated-word span/replacement", rep.suggestions[0].original === "ke ke" && rep.suggestions[0].replacement === "ke", rep.suggestions[0]);
const dsp = wiAnalyze("Ini adalah  kalimat.");
check("double-space (multi) fires", dsp.suggestions.length === 1 && dsp.suggestions[0].kind === "double-space" && dsp.suggestions[0].replacement === " ", kinds(dsp));
const sbp = wiAnalyze("Ini kalimat .");
check("space-before-punctuation fires", sbp.suggestions.length === 1 && sbp.suggestions[0].kind === "double-space" && sbp.suggestions[0].original === " ." && sbp.suggestions[0].replacement === ".", sbp.suggestions);
const mis = wiAnalyze("Dia sehat.Selanjutnya dia pergi.");
check("missing-space fires", mis.suggestions.length === 1 && mis.suggestions[0].kind === "missing-space-after-punctuation" && mis.suggestions[0].replacement === ". ", kinds(mis));
const cap = wiAnalyze("dia pergi ke pasar. lalu pulang.");
check("sentence-capital fires at paragraph start + after '. '", cap.suggestions.length === 2 && cap.suggestions.every(s => s.kind === "sentence-capital"), kinds(cap));

console.log("3) Teks bersih -> tidak ada saran");
const clean = wiAnalyze("Dia pergi ke pasar. Lalu, dia pulang ke rumah dan beristirahat.");
check("clean text -> 0 suggestions", clean.suggestions.length === 0, kinds(clean));
const boundary = wiAnalyze("Dia masuk rumah. Rumah itu besar.");
check("same word across sentence boundary -> no repeated-word", !kinds(boundary).includes("repeated-word"), kinds(boundary));

console.log("4) Penjaga: desimal, singkatan, domain, daftar");
check("decimal 3.14 -> no missing-space", !kinds(wiAnalyze("Nilai pi adalah 3.14 dan tetap. Selanjutnya kita bahas.")).includes("missing-space-after-punctuation"));
check("abbreviation dll. -> no capital on next word", !kinds(wiAnalyze("Kami membeli buku, pensil, dll. lalu pulang.")).includes("sentence-capital"));
check("abbreviation dll. -> no missing-space", !kinds(wiAnalyze("Daftar isi: buku, dll.Semua ada.")).includes("missing-space-after-punctuation"));
check("domain -> no missing-space", !kinds(wiAnalyze("Kunjungi saksara.vercel.app untuk info. Lalu coba lagi.")).includes("missing-space-after-punctuation"));
check("dotted token (laporan.v2.Final) -> no missing-space", !kinds(wiAnalyze("File bernama laporan.v2.Final tersedia.")).includes("missing-space-after-punctuation"));
check("list paragraph -> no capital", !kinds(wiAnalyze("- item pertama\n- item kedua")).includes("sentence-capital"));
check("URL paragraph -> no capital", !kinds(wiAnalyze("lihat https://saksara.vercel.app sekarang.")).includes("sentence-capital"));
check("numbered sentence end -> no capital (digit guard)", !kinds(wiAnalyze("Ada 3. kemudian kami pulang.")).includes("sentence-capital"));

console.log("5) Toleransi tanda baca pada kata berulang");
const commaRep = wiAnalyze("Belajar, belajar itu penting.");
check("repeated across comma fires", commaRep.suggestions.length === 1 && commaRep.suggestions[0].kind === "repeated-word", kinds(commaRep));
check("apply comma-repeat", joinRes(commaRep, wiApply(commaRep.paragraphs, commaRep.suggestions, commaRep.suggestions.map(s => s.id))) === "Belajar itu penting.");

console.log("6) Saran tidak pernah tumpang tindih");
const messy = wiAnalyze("pergi  pergi ke pasar.Hari ini cerah .");
check("invariants on messy text", invariantsHold(messy) === true, invariantsHold(messy));
check("overlap resolved: 'kata  kata' keeps repeated-word only", (() => { const r = wiAnalyze("kata  kata"); return r.suggestions.length === 1 && r.suggestions[0].kind === "repeated-word"; })());
check("invariants on multi-paragraph text", invariantsHold(wiAnalyze("dia pergi.\n\nke ke pasar  ramai .")) === true);

console.log("7) wiApply: terima semua / sebagian / tidak sama sekali");
const src = "Saya ke ke pasar. lalu pulang.";
const r7 = wiAnalyze(src);
const all = wiApply(r7.paragraphs, r7.suggestions, r7.suggestions.map(s => s.id));
check("apply all -> revised text", joinRes(r7, all) === "Saya ke pasar. Lalu pulang.", joinRes(r7, all));
const capOnly = r7.suggestions.find(s => s.kind === "sentence-capital");
const partial = wiApply(r7.paragraphs, r7.suggestions, [capOnly.id]);
check("apply subset -> unaccepted untouched", joinRes(r7, partial) === "Saya ke ke pasar. Lalu pulang.", joinRes(r7, partial));
const none = wiApply(r7.paragraphs, r7.suggestions, []);
check("apply none -> original unchanged", JSON.stringify(none) === JSON.stringify(r7.paragraphs));
check("apply does not mutate input", r7.paragraphs[0] === src);

console.log("8) Struktur paragraf dipertahankan");
const multi = "Satu.\n\nDua dua.\n\n\nTiga.";
const r8 = wiAnalyze(multi);
check("3 paragraphs, separators kept", r8.paragraphs.length === 3 && JSON.stringify(r8.separators) === JSON.stringify(["\n\n", "\n\n\n"]), r8.separators);
const r8all = joinRes(r8, wiApply(r8.paragraphs, r8.suggestions, r8.suggestions.map(s => s.id)));
check("revised keeps exact separators", r8all === "Satu.\n\nDua.\n\n\nTiga.", r8all);
check("blank-line count identical", (r8all.match(/\n\n/g) || []).length === (multi.match(/\n\n/g) || []).length);
const crlf = wiAnalyze("Satu baris.\r\n\r\nDua dua.");
check("CRLF normalized -> 2 paragraphs + repeat in pIdx 1", crlf.paragraphs.length === 2 && crlf.suggestions.some(s => s.pIdx === 1 && s.kind === "repeated-word"), kinds(crlf));

console.log("9) Unicode aman (emoji + diakritik, offset kode-unit)");
const uni = "Hari ini cerah ☀️ dan dan menyenangkan.";
const r9 = wiAnalyze(uni);
check("repeat after emoji fires", r9.suggestions.some(s => s.kind === "repeated-word"), kinds(r9));
check("unicode round-trip exact", joinRes(r9, wiApply(r9.paragraphs, r9.suggestions, r9.suggestions.map(s => s.id))) === "Hari ini cerah ☀️ dan menyenangkan.");
const dia = wiAnalyze("Dia di kafé. kafé itu ramai.");
check("diacritic word capital applies", joinRes(dia, wiApply(dia.paragraphs, dia.suggestions, dia.suggestions.map(s => s.id))) === "Dia di kafé. Kafé itu ramai.");

console.log("10) Batas 50.000 karakter di inti");
check("over-limit input truncated + flagged", (() => { const r = wiAnalyze("a".repeat(50001)); return r.truncated === true && r.paragraphs.join("").length === 50000; })());
check("exactly-at-limit not truncated", wiAnalyze("a".repeat(50000)).truncated === false);

/* ================= Phase 8.2 — Grammar & Spelling Checker ================= */
const NEW_KINDS = ["kata-tidak-baku", "kata-depan", "imbuhan", "tanda-baca", "huruf-kapital", "kata-ulang", "pemisahan-kata", "ejaan-mekanis"];
function newKinds(r) { return r.suggestions.filter(s => NEW_KINDS.includes(s.kind)); }

console.log("11) Phase 8.2 — kata tidak baku");
const baku = wiAnalyze("Ia pergi ke apotik untuk membeli obat.");
check("baku: apotik fires (pasti)", baku.suggestions.length === 1 && baku.suggestions[0].kind === "kata-tidak-baku" && baku.suggestions[0].replacement === "apotek" && baku.suggestions[0].certainty === "pasti", kinds(baku));
check("baku: apply", joinRes(baku, wiApply(baku.paragraphs, baku.suggestions, baku.suggestions.map(s => s.id))) === "Ia pergi ke apotek untuk membeli obat.");
const bakuCap = wiAnalyze("Praktek dokter itu sangat baik.");
check("baku: capitalized at sentence start fires + case kept", bakuCap.suggestions.some(s => s.kind === "kata-tidak-baku" && s.replacement === "Praktik"), kinds(bakuCap));
check("baku: capitalized mid-sentence skipped (proper noun)", newKinds(wiAnalyze("Toko Praktek Jaya menjual alat kesehatan.")).length === 0, kinds(wiAnalyze("Toko Praktek Jaya menjual alat kesehatan.")));
check("baku: ALL-CAPS skipped", newKinds(wiAnalyze("APOTIK buka setiap hari.")).length === 0);
check("baku: proper-name phrase at start skipped", newKinds(wiAnalyze("Apotik Sejahtera adalah mitra kami.")).length === 0);
const bakuSaran = wiAnalyze("Dia memang pinter menggambar sejak kecil.");
check("baku: colloquial pair is certainty saran", bakuSaran.suggestions.some(s => s.kind === "kata-tidak-baku" && s.certainty === "saran" && s.replacement === "pintar"), kinds(bakuSaran));

console.log("12) Phase 8.2 — kata depan di/ke (ditulis terpisah)");
const dep1 = wiAnalyze("Kamu mau pergi kemana sore ini?");
check("depan tetap: kemana -> ke mana", dep1.suggestions.length === 1 && dep1.suggestions[0].kind === "kata-depan" && dep1.suggestions[0].replacement === "ke mana", kinds(dep1));
const dep2 = wiAnalyze("Dimana kamu tinggal sekarang?");
check("depan tetap: Dimana at start -> Di mana", dep2.suggestions.some(s => s.kind === "kata-depan" && s.replacement === "Di mana"), kinds(dep2));
check("depan tempat: dirumah -> di rumah", wiAnalyze("Dia tinggal dirumah neneknya.").suggestions.some(s => s.kind === "kata-depan" && s.original === "dirumah" && s.replacement === "di rumah"));
check("depan tempat: kekantor -> ke kantor", wiAnalyze("Mereka pergi kekantor bersama.").suggestions.some(s => s.kind === "kata-depan" && s.replacement === "ke kantor"));
check("depan: 'keluar' (kata kerja) tidak ditandai", newKinds(wiAnalyze("Ia keluar dari ruangan itu.")).length === 0);
check("depan: 'kelas' tidak ditandai", newKinds(wiAnalyze("Siswa masuk ke kelas pagi ini.")).length === 0);

console.log("13) Phase 8.2 — imbuhan di-/ke- (serangkai) dan partikel -pun");
const imb1 = wiAnalyze("Buku itu di baca oleh siswa.");
check("imbuhan: 'di baca' -> dibaca (pasti)", imb1.suggestions.some(s => s.kind === "imbuhan" && s.original === "di baca" && s.replacement === "dibaca" && s.certainty === "pasti"), kinds(imb1));
check("imbuhan: apply join", joinRes(imb1, wiApply(imb1.paragraphs, imb1.suggestions, imb1.suggestions.map(s => s.id))) === "Buku itu dibaca oleh siswa.");
check("imbuhan: sentence-start 'Di tulis' -> Ditulis", wiAnalyze("Di tulis dengan rapi dan jelas.").suggestions.some(s => s.kind === "imbuhan" && s.replacement === "Ditulis"));
check("imbuhan: 'ke dua' -> kedua (saran)", wiAnalyze("Ia finis ke dua pada lomba itu.").suggestions.some(s => s.kind === "imbuhan" && s.replacement === "kedua" && s.certainty === "saran"));
check("imbuhan: 'ke dua belas' dilewati", !kinds(wiAnalyze("Ia meraih peringkat ke dua belas.")).includes("imbuhan"));
check("imbuhan: Apapun -> Apa pun", wiAnalyze("Apapun yang terjadi, kita tetap tenang.").suggestions.some(s => s.kind === "imbuhan" && s.replacement === "Apa pun"));
check("imbuhan: walaupun/meskipun/sekalipun tidak pernah ditandai", newKinds(wiAnalyze("Walaupun hujan, meskipun lelah, sekalipun jauh, ia tetap berangkat.")).length === 0);
check("imbuhan: 'di meja' (bukan verba) tidak ditandai", newKinds(wiAnalyze("Buku itu ada di meja dekat jendela.")).length === 0);

console.log("14) Phase 8.2 — tanda baca");
const tb1 = wiAnalyze("Kami membeli buku,pensil dan kertas.");
check("tanda-baca: koma tanpa spasi", tb1.suggestions.some(s => s.kind === "tanda-baca" && s.original === "," && s.replacement === ", "), kinds(tb1));
check("tanda-baca: apply koma", joinRes(tb1, wiApply(tb1.paragraphs, tb1.suggestions, tb1.suggestions.map(s => s.id))) === "Kami membeli buku, pensil dan kertas.");
check("tanda-baca: koma ganda -> satu koma (pasti)", wiAnalyze("Satu,, dua, tiga.").suggestions.some(s => s.kind === "tanda-baca" && s.original === ",," && s.replacement === "," && s.certainty === "pasti"));
const tb3 = wiAnalyze("Benarkah?? Saya tidak percaya!!");
check("tanda-baca: '??' dan '!!' -> tunggal (saran)", tb3.suggestions.filter(s => s.kind === "tanda-baca").length === 2 && tb3.suggestions.filter(s => s.kind === "tanda-baca").every(s => s.certainty === "saran"), kinds(tb3));
check("tanda-baca: '..' -> elipsis (saran)", wiAnalyze("Ia berpikir.. lalu menjawab pelan.").suggestions.some(s => s.kind === "tanda-baca" && s.original === ".." && s.replacement === "…"));
check("tanda-baca: '...' tidak ditandai", !wiAnalyze("Ia berpikir... lalu menjawab.").suggestions.some(s => s.kind === "tanda-baca"));

console.log("15) Phase 8.2 — huruf kapital 'Saya'");
check("kapital: 'Saya' tengah kalimat -> saran 'saya'", wiAnalyze("Dokumen ini Saya buat sendiri kemarin.").suggestions.some(s => s.kind === "huruf-kapital" && s.replacement === "saya" && s.certainty === "saran"));
check("kapital: 'Saya' awal kalimat tidak ditandai", !kinds(wiAnalyze("Saya pergi ke pasar pagi ini.")).includes("huruf-kapital"));
check("kapital: judul pendek tidak ditandai", !kinds(wiAnalyze("Laporan Kegiatan Saya")).includes("huruf-kapital"));

console.log("16) Phase 8.2 — kata ulang");
const ku1 = wiAnalyze("Anak anak bermain di halaman rumah.");
check("kata-ulang: 'anak anak' -> anak-anak (bukan penghapusan)", ku1.suggestions.some(s => s.kind === "kata-ulang" && s.replacement === "Anak-anak") && !kinds(ku1).includes("repeated-word"), kinds(ku1));
check("kata-ulang: apply", joinRes(ku1, wiApply(ku1.paragraphs, ku1.suggestions, ku1.suggestions.map(s => s.id))) === "Anak-anak bermain di halaman rumah.");
check("kata-ulang: 'buku - buku' -> buku-buku (pasti)", wiAnalyze("Ia membaca buku - buku lama di perpustakaan.").suggestions.some(s => s.kind === "kata-ulang" && s.replacement === "buku-buku" && s.certainty === "pasti"));
check("kata-ulang: 'buku2' -> buku-buku (saran)", wiAnalyze("Adik membawa buku2 gambar ke sekolah.").suggestions.some(s => s.kind === "kata-ulang" && s.original === "buku2" && s.replacement === "buku-buku" && s.certainty === "saran"));
check("kata-ulang: pengulangan biasa tetap dihapus (ini ini)", (() => { const r = wiAnalyze("Hal ini ini penting."); return r.suggestions.some(s => s.kind === "repeated-word") && !kinds(r).includes("kata-ulang"); })());

console.log("17) Phase 8.2 — pemisahan kata & ejaan mekanis");
check("pemisahan: Terimakasih -> Terima kasih (pasti)", wiAnalyze("Terimakasih atas bantuan Anda.").suggestions.some(s => s.kind === "pemisahan-kata" && s.replacement === "Terima kasih" && s.certainty === "pasti"));
check("pemisahan: 'apa bila' -> apabila (saran)", wiAnalyze("Saya akan datang apa bila waktu memungkinkan.").suggestions.some(s => s.kind === "pemisahan-kata" && s.replacement === "apabila" && s.certainty === "saran"));
check("pemisahan: 'mudah-mudahan' & 'terima kasih' tidak ditandai", newKinds(wiAnalyze("Mudah-mudahan ia lekas sembuh, dan terima kasih atas doanya.")).length === 0);
check("ejaan: 'bagusss' -> bagus (saran)", wiAnalyze("Tulisannya bagusss dan rapi.").suggestions.some(s => s.kind === "ejaan-mekanis" && s.original === "bagusss" && s.replacement === "bagus" && s.certainty === "saran"));
check("ejaan: kata normal tidak ditandai", newKinds(wiAnalyze("Mereka berkoordinasi dengan baik dan tertib.")).length === 0);

console.log("18) Phase 8.2 — mekanisme abaikan kata (ignoreWords)");
const igText = "Ia pergi ke apotik dan praktek itu ditutup.";
const ig1 = wiAnalyze(igText, { ignoreWords: ["praktek"] });
check("ignore: kata terabaikan hilang, kata lain tetap", !ig1.suggestions.some(s => s.original.toLowerCase() === "praktek") && ig1.suggestions.some(s => s.kind === "kata-tidak-baku" && s.original === "apotik"), kinds(ig1));
check("ignore: Set didukung", newKinds(wiAnalyze(igText, { ignoreWords: new Set(["apotik", "praktek"]) })).length === 0);
const ig3 = wiAnalyze("ke ke apotik", { ignoreWords: ["apotik"] });
check("ignore: aturan lain tidak terpengaruh", kinds(ig3).includes("repeated-word") && !kinds(ig3).includes("kata-tidak-baku"), kinds(ig3));
check("ignore: tanpa opts perilaku tetap", wiAnalyze(igText).suggestions.some(s => s.kind === "kata-tidak-baku" && s.original === "praktek"));
check("ignore: opts kosong aman", wiAnalyze("Ia ke apotik.", {}).suggestions.some(s => s.kind === "kata-tidak-baku"));

console.log("19) Phase 8.2 — rangkaian false positive (nol saran dari aturan 8.2)");
const FP = [
  "Apotik Sejahtera adalah mitra kami di Jakarta.",
  "Kunjungi saksara.vercel.app untuk info.",
  "Nilai 3,5 persen dan 1.000 unit terjual.",
  "Ia menulis \"praktek\" dalam kutipannya.",
  "Walaupun hujan, meskipun lelah, sekalipun jauh.",
  "Tim NASA dan PBB bertemu Dr. Hadi, M.Sc. di aula.",
  "The quick brown fox jumps over the lazy dog.",
  "Mudah-mudahan ia lekas sembuh.",
  "H2O dan CO2 adalah rumus kimia.",
  "Penelitian ini dilakukan untuk mengetahui pengaruh metode pembelajaran terhadap hasil belajar siswa. Data dikumpulkan melalui observasi dan wawancara, kemudian dianalisis secara deskriptif. Hasil penelitian menunjukkan bahwa metode tersebut efektif meningkatkan pemahaman siswa."
];
FP.forEach(function(t, i) { const r = wiAnalyze(t); check("FP[" + i + "] nol saran 8.2", newKinds(r).length === 0, kinds(r)); });

console.log("20) Phase 8.2 — Unicode + invarian pada teks campuran");
const mix = wiAnalyze("Hari ini cerah ☀️ dan ia pergi ke apotik dekat kafé.");
check("unicode: baku tepat offset setelah emoji", invariantsHold(mix) === true && mix.suggestions.some(s => s.kind === "kata-tidak-baku" && s.original === "apotik"), invariantsHold(mix));
check("unicode: apply eksak dengan diakritik", joinRes(mix, wiApply(mix.paragraphs, mix.suggestions, mix.suggestions.map(s => s.id))) === "Hari ini cerah ☀️ dan ia pergi ke apotek dekat kafé.");
check("invarian teks ramai 8.2", invariantsHold(wiAnalyze("dirumah,ia di baca buku2 tentang praktek.. bagusss sekali")) === true, invariantsHold(wiAnalyze("dirumah,ia di baca buku2 tentang praktek.. bagusss sekali")));

/* ================= Phase 8.3 — Sentence Improvement ================= */
const KINDS83 = ["kalimat-mubazir", "kalimat-pengulangan-frasa", "kalimat-kompleks", "kalimat-panjang", "transisi-awalan"];
function k83(r) { return r.suggestions.filter(s => KINDS83.includes(s.kind)); }
function advisories(r) { return r.suggestions.filter(s => s.advisory); }
function invariants83(r) {
  for (const s of r.suggestions) {
    if (r.paragraphs[s.pIdx].slice(s.start, s.end) !== s.original) return "original mismatch: " + s.id;
  }
  const by = {};
  for (const s of r.suggestions) {
    if (s.advisory) continue;
    (by[s.pIdx] = by[s.pIdx] || []).push(s);
  }
  for (const k in by) {
    const a = by[k].slice().sort((x, y) => x.start - y.start);
    for (let i = 1; i < a.length; i++) if (a[i].start < a[i - 1].end) return "overlap (non-advisory) in paragraph " + k;
  }
  return true;
}

console.log("21) Phase 8.3 — segmentasi kalimat (wiSentences)");
check("seg: singkatan gelar + desimal -> 1 kalimat", wiSentences("Dr. Hadi, M.Sc. meneliti hal. 5 pada pukul 3.5 di aula.").length === 1, wiSentences("Dr. Hadi, M.Sc. meneliti hal. 5 pada pukul 3.5 di aula.").length);
check("seg: sitasi kurung tidak memisah, titik sesudahnya memisah", wiSentences("Hasilnya signifikan (Rahman, 2020). Penelitian lanjut diperlukan.").length === 2);
check("seg: titik di dalam kurung tidak memisah", wiSentences("Data awal (lihat Bab 3. Rincian menyusul) dipakai apa adanya.").length === 1);
check("seg: URL/domain tidak memisah", wiSentences("Kunjungi saksara.vercel.app untuk info. Lalu coba lagi.").length === 2);
check("seg: titik akhir di dalam kutip menutup kalimat", wiSentences("Ia berkata, \"Saya pergi.\" Kemudian ia pulang.").length === 2);
check("seg: tiga kalimat sederhana", wiSentences("Satu kalimat. Dua kalimat! Tiga kalimat?").length === 3);

console.log("22) Phase 8.3 — kata mubazir (pasti)");
const mb1 = wiAnalyze("Hal itu disebabkan karena hujan deras.");
check("mubazir: 'disebabkan karena' -> 'disebabkan oleh' (pasti)", mb1.suggestions.some(s => s.kind === "kalimat-mubazir" && s.original === "disebabkan karena" && s.replacement === "disebabkan oleh" && s.certainty === "pasti"), kinds(mb1));
check("mubazir: apply disebabkan", joinRes(mb1, wiApply(mb1.paragraphs, mb1.suggestions, mb1.suggestions.map(s => s.id))) === "Hal itu disebabkan oleh hujan deras.");
check("mubazir: 'agar supaya' -> 'agar'", wiAnalyze("Ia belajar agar supaya lulus ujian.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.replacement === "agar" && s.certainty === "pasti"));
const mb3 = wiAnalyze("Demi untuk kebaikan bersama, kami setuju.");
check("mubazir: 'Demi untuk' -> 'Untuk' (kapital dipertahankan)", mb3.suggestions.some(s => s.kind === "kalimat-mubazir" && s.replacement === "Untuk" && s.certainty === "pasti"), kinds(mb3));
check("mubazir: 'adalah merupakan' -> 'merupakan'", wiAnalyze("Metode ini adalah merupakan cara baru.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.original === "adalah merupakan" && s.replacement === "merupakan"));
check("mubazir: 'yaitu adalah' -> 'yaitu'", wiAnalyze("Fokusnya yaitu adalah peningkatan mutu.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.replacement === "yaitu" && s.certainty === "pasti"));

console.log("23) Phase 8.3 — nominalisasi & pleonasme arah (gaya)");
const nm1 = wiAnalyze("Peneliti melakukan penelitian di laboratorium.");
check("nominalisasi: 'melakukan penelitian' -> 'meneliti' (gaya)", nm1.suggestions.some(s => s.kind === "kalimat-mubazir" && s.original === "melakukan penelitian" && s.replacement === "meneliti" && s.certainty === "gaya"), kinds(nm1));
check("nominalisasi: apply", joinRes(nm1, wiApply(nm1.paragraphs, nm1.suggestions, nm1.suggestions.map(s => s.id))) === "Peneliti meneliti di laboratorium.");
check("nominalisasi: awal kalimat 'Melakukan pengamatan' -> 'Mengamati'", wiAnalyze("Melakukan pengamatan adalah tugas utamanya.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.replacement === "Mengamati"));
check("nominalisasi: objek sesudahnya utuh ('melakukan pengumpulan data' -> 'mengumpulkan data')", (() => { const r = wiAnalyze("Tim melakukan pengumpulan data lapangan."); const a = wiApply(r.paragraphs, r.suggestions, r.suggestions.map(s => s.id)); return joinRes(r, a) === "Tim mengumpulkan data lapangan."; })());
check("pleonasme: 'naik ke atas' -> 'naik' (gaya)", wiAnalyze("Ia naik ke atas panggung dengan hati-hati.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.original === "naik ke atas" && s.replacement === "naik" && s.certainty === "gaya"));
check("pleonasme: 'turun ke bawah' -> 'turun' (gaya)", wiAnalyze("Air turun ke bawah dengan deras.").suggestions.some(s => s.kind === "kalimat-mubazir" && s.replacement === "turun" && s.certainty === "gaya"));

console.log("24) Phase 8.3 — penjaga mubazir: kutip & sitasi");
check("mubazir: di dalam kutip tidak memicu", !kinds(wiAnalyze("Ia menulis \"disebabkan karena\" dalam contoh kalimatnya.")).includes("kalimat-mubazir"));
check("mubazir: di dalam kurung sitasi tidak memicu", !kinds(wiAnalyze("Hasil (disebabkan karena keterbatasan, 2020) dicatat apa adanya.")).includes("kalimat-mubazir"));
check("mubazir: 'melakukan penelitian' di dalam kutip tidak memicu", !kinds(wiAnalyze("Ia berkata, \"Kami melakukan penelitian ini dengan serius.\"")).includes("kalimat-mubazir"));

console.log("25) Phase 8.3 — kalimat panjang (penasihat)");
const LONG = "Penelitian ini bertujuan untuk mengetahui pengaruh penggunaan media pembelajaran interaktif berbasis teknologi informasi terhadap peningkatan hasil belajar siswa pada mata pelajaran matematika di sekolah menengah atas negeri yang berada di wilayah perkotaan dengan mempertimbangkan berbagai faktor pendukung dan penghambat yang muncul selama proses pembelajaran berlangsung setiap semester.";
const lp = wiAnalyze(LONG);
check("panjang: kalimat akademik >40 kata -> tepat 1 penasihat kalimat-panjang", advisories(lp).length === 1 && advisories(lp)[0].kind === "kalimat-panjang", kinds(lp));
check("panjang: penasihat bersifat advisory, replacement null, certainty potensial", advisories(lp).length === 1 && advisories(lp)[0].advisory === true && advisories(lp)[0].replacement === null && advisories(lp)[0].certainty === "potensial");
check("panjang: kalimat panjang yang sah tidak dilabeli kompleks", !kinds(lp).includes("kalimat-kompleks"), kinds(lp));
const RUNON = "Siswa yang terpilih mengikuti kegiatan pelatihan kepemimpinan dasar selama tiga hari berturut turut di gedung serbaguna sekolah bersama para guru pembimbing dan narasumber dari berbagai instansi terkait untuk meningkatkan keterampilan organisasi serta kedisiplinan mereka.";
check("panjang: >30 kata tanpa koma -> penasihat run-on", wiAnalyze(RUNON).suggestions.some(s => s.kind === "kalimat-panjang" && s.advisory === true));
check("panjang: kalimat normal 15 kata -> tidak ada penasihat", advisories(wiAnalyze("Penelitian ini dilakukan di sekolah dasar negeri selama dua minggu penuh pada bulan lalu.")).length === 0);

console.log("26) Phase 8.3 — kalimat kompleks (penasihat) & penjaga enumerasi");
const KX = "Hasil penelitian menunjukkan bahwa metode yang digunakan ketika siswa belajar secara berkelompok dapat meningkatkan pemahaman karena mereka saling membantu.";
check("kompleks: >=3 penanda klausa -> penasihat potensial", wiAnalyze(KX).suggestions.some(s => s.kind === "kalimat-kompleks" && s.advisory === true && s.certainty === "potensial"), kinds(wiAnalyze(KX)));
check("kompleks: enumerasi koma pendek -> TIDAK ada penasihat kompleks", !kinds(wiAnalyze("Siswa membawa buku, pena, penggaris, penghapus, dan tas ke sekolah.")).includes("kalimat-kompleks"));
check("kompleks: kalimat sederhana -> tidak ada penasihat", advisories(wiAnalyze("Guru menjelaskan pelajaran dengan suara yang jelas.")).length === 0);

console.log("27) Phase 8.3 — pengulangan frasa (penasihat)");
const FR1 = wiAnalyze("Hasil penelitian ini menunjukkan bahwa hasil penelitian ini memberikan gambaran awal.");
check("frasa: gram isi berulang dalam 1 kalimat -> penasihat", FR1.suggestions.some(s => s.kind === "kalimat-pengulangan-frasa" && s.advisory === true && s.certainty === "potensial"), kinds(FR1));
check("frasa: penjelasan menyebut frasa yang berulang", FR1.suggestions.some(s => s.kind === "kalimat-pengulangan-frasa" && s.explanation.includes("hasil penelitian ini")));
const FR2 = wiAnalyze("Data dikumpulkan melalui observasi lapangan selama dua minggu penuh. Observasi lapangan selama dua minggu penuh itu kemudian dianalisis.");
check("frasa: gram-4 sama pada kalimat berurutan -> penasihat di kalimat kedua", FR2.suggestions.some(s => s.kind === "kalimat-pengulangan-frasa" && s.start >= FR2.paragraphs[0].indexOf("Observasi")), kinds(FR2));
check("frasa: kata ulang (anak anak) tidak memicu penasihat frasa", !kinds(wiAnalyze("Anak anak bermain dan anak anak tertawa riang.")).includes("kalimat-pengulangan-frasa"));

console.log("28) Phase 8.3 — transisi awalan (penasihat gaya)");
const TR1 = wiAnalyze("Kemudian, siswa masuk kelas. Kemudian, guru membuka pelajaran. Kemudian, semua siswa mencatat.");
check("transisi: 3 awalan sama -> tepat 1 penasihat gaya", advisories(TR1).length === 1 && advisories(TR1)[0].kind === "transisi-awalan" && advisories(TR1)[0].certainty === "gaya", kinds(TR1));
check("transisi: penasihat menempel pada kemunculan ketiga", advisories(TR1).length === 1 && TR1.paragraphs[0].slice(advisories(TR1)[0].start, advisories(TR1)[0].end).indexOf("semua siswa") >= 0);
check("transisi: awalan bervariasi -> tidak ada penasihat", advisories(wiAnalyze("Pertama, siswa masuk kelas. Selanjutnya guru membuka pelajaran. Terakhir, semua siswa mencatat.")).length === 0);

console.log("29) Phase 8.3 — prioritas satu penasihat per kalimat");
const MULTI = "Hasil penelitian ini menunjukkan bahwa hasil penelitian ini penting karena data yang dikumpulkan dari lapangan yang luas memberikan gambaran yang jelas tentang kondisi yang sebenarnya terjadi pada masyarakat yang tinggal di wilayah yang diteliti selama periode yang sangat panjang dan melelahkan sekali.";
const mr = wiAnalyze(MULTI);
check("prioritas: kalimat multi-masalah -> tepat 1 penasihat", advisories(mr).length === 1, kinds(mr));
check("prioritas: pengulangan frasa menang atas panjang/kompleks", advisories(mr).length === 1 && advisories(mr)[0].kind === "kalimat-pengulangan-frasa", kinds(mr));

console.log("30) Phase 8.3 — interaksi dengan 8.1/8.2 & keamanan wiApply");
const IX = wiAnalyze("Praktek itu disebabkan karena kelalaian petugas.");
check("interaksi: baku (8.2) + mubazir (8.3) sama-sama muncul", kinds(IX).includes("kata-tidak-baku") && kinds(IX).includes("kalimat-mubazir"), kinds(IX));
check("interaksi: apply keduanya", joinRes(IX, wiApply(IX.paragraphs, IX.suggestions, IX.suggestions.map(s => s.id))) === "Praktik itu disebabkan oleh kelalaian petugas.", joinRes(IX, wiApply(IX.paragraphs, IX.suggestions, IX.suggestions.map(s => s.id))));
const LONGBAKU = "Penelitian ini bertujuan untuk mengetahui pengaruh penggunaan media pembelajaran interaktif berbasis teknologi informasi terhadap peningkatan hasil belajar siswa pada mata pelajaran matematika di sekolah menengah atas negeri yang berada di wilayah perkotaan dengan apotik sebagai lokasi pembanding tambahan selama proses pembelajaran berlangsung setiap semester.";
const lb = wiAnalyze(LONGBAKU);
check("interaksi: penasihat tidak menghalangi saran kata di kalimat yang sama", advisories(lb).length === 1 && lb.suggestions.some(s => s.kind === "kata-tidak-baku"), kinds(lb));
check("interaksi: wiApply mengabaikan id penasihat (teks utuh)", joinRes(lb, wiApply(lb.paragraphs, lb.suggestions, advisories(lb).map(s => s.id))) === LONGBAKU);
check("interaksi: apply saran kata di kalimat berpenasihat", (() => { const b = lb.suggestions.find(s => s.kind === "kata-tidak-baku"); const out = joinRes(lb, wiApply(lb.paragraphs, lb.suggestions, [b.id])); return out.includes("apotek") && !out.includes("apotik"); })());
check("invarian 8.3 pada teks campuran", invariants83(wiAnalyze("Praktek itu disebabkan karena anak anak bermain di apotik.. bagusss")) === true, invariants83(wiAnalyze("Praktek itu disebabkan karena anak anak bermain di apotik.. bagusss")));

console.log("31) Phase 8.3 — Unicode & pelestarian sitasi/angka/kutip");
const UNI83 = "Hari ini cerah ☀️ dan ia belajar agar supaya lulus ujian di kafé.";
const u83 = wiAnalyze(UNI83);
check("unicode 8.3: mubazir tepat offset sesudah emoji", invariants83(u83) === true && u83.suggestions.some(s => s.kind === "kalimat-mubazir"), invariants83(u83));
check("unicode 8.3: apply eksak", joinRes(u83, wiApply(u83.paragraphs, u83.suggestions, u83.suggestions.map(s => s.id))) === "Hari ini cerah ☀️ dan ia belajar agar lulus ujian di kafé.");
const PRES = wiAnalyze("Sebanyak 35 sampel itu disebabkan karena praktek lama yang buruk.");
check("pelestarian: angka & sitasi utuh sesudah apply", joinRes(PRES, wiApply(PRES.paragraphs, PRES.suggestions, PRES.suggestions.map(s => s.id))) === "Sebanyak 35 sampel itu disebabkan oleh praktik lama yang buruk.", joinRes(PRES, wiApply(PRES.paragraphs, PRES.suggestions, PRES.suggestions.map(s => s.id))));
const PRES2 = wiAnalyze("Hasil (Rahman, 2020) melibatkan 35 siswa. Ia berkata, \"Kami melakukan penelitian dengan sangat serius.\"");
check("pelestarian: teks bersitasi + kutip tanpa saran pengubah", PRES2.suggestions.filter(s => !s.advisory).length === 0 && joinRes(PRES2, wiApply(PRES2.paragraphs, PRES2.suggestions, PRES2.suggestions.map(s => s.id))) === "Hasil (Rahman, 2020) melibatkan 35 siswa. Ia berkata, \"Kami melakukan penelitian dengan sangat serius.\"", kinds(PRES2));

console.log("32) Phase 8.3.1 — regresi false positive hasil audit probe");
check("8.3.1 P1: 'sungguh-sungguh' bertanda hubung -> nol saran", wiAnalyze("Ia berkata dengan sungguh-sungguh bahwa ia akan datang tepat waktu.").suggestions.length === 0, kinds(wiAnalyze("Ia berkata dengan sungguh-sungguh bahwa ia akan datang tepat waktu.")));
check("8.3.1 P2: 'Anak-anak' sudah bertanda hubung -> nol saran", wiAnalyze("Anak-anak bermain di halaman rumah mereka.").suggestions.length === 0, kinds(wiAnalyze("Anak-anak bermain di halaman rumah mereka.")));
check("8.3.1 P3: 'Buku-buku' sudah bertanda hubung -> nol saran", wiAnalyze("Buku-buku itu tersusun rapi di rak perpustakaan.").suggestions.length === 0, kinds(wiAnalyze("Buku-buku itu tersusun rapi di rak perpustakaan.")));
check("8.3.1 P4: tiga kata ulang sah -> nol saran", wiAnalyze("Ia mengerjakannya dengan sungguh-sungguh, benar-benar tekun, dan hati-hati.").suggestions.length === 0, kinds(wiAnalyze("Ia mengerjakannya dengan sungguh-sungguh, benar-benar tekun, dan hati-hati.")));
check("8.3.1 P6: singkatan gugus 's.d.' -> nol saran", wiAnalyze("Kegiatan berlangsung s.d. selesai pada pkl. 09.00 di aula utama.").suggestions.length === 0, kinds(wiAnalyze("Kegiatan berlangsung s.d. selesai pada pkl. 09.00 di aula utama.")));
check("8.3.1 P7: singkatan 'dkk.' -> nol saran", wiAnalyze("Penelitian dilakukan oleh Rahman dkk. pada tahun 2024 di kampus.").suggestions.length === 0, kinds(wiAnalyze("Penelitian dilakukan oleh Rahman dkk. pada tahun 2024 di kampus.")));
check("8.3.1 P8: singkatan 'Tbk.' -> nol saran", wiAnalyze("Tim berkunjung ke PT Sumber Abadi, Tbk. yang berlokasi di Jakarta.").suggestions.length === 0, kinds(wiAnalyze("Tim berkunjung ke PT Sumber Abadi, Tbk. yang berlokasi di Jakarta.")));
check("8.3.1 P9: kalimat Inggris 'team' -> nol saran", wiAnalyze("The team conducted a detailed analysis of the formal system.").suggestions.length === 0, kinds(wiAnalyze("The team conducted a detailed analysis of the formal system.")));
check("8.3.1 P9b: kalimat Inggris 'dollar' -> nol saran", wiAnalyze("The dollar exchange rate and the museum ticket price rose sharply.").suggestions.length === 0, kinds(wiAnalyze("The dollar exchange rate and the museum ticket price rose sharply.")));
check("8.3.1 P10: kata dalam kutip tunggal -> nol saran", wiAnalyze("Istilah 'praktek' dibahas dalam seminar kebahasaan itu.").suggestions.length === 0, kinds(wiAnalyze("Istilah 'praktek' dibahas dalam seminar kebahasaan itu.")));
check("8.3.1 P10b: kata dalam kutip tunggal keriting -> nol saran", wiAnalyze("Istilah ‘praktek’ dibahas dalam seminar itu.").suggestions.length === 0, kinds(wiAnalyze("Istilah ‘praktek’ dibahas dalam seminar itu.")));
check("8.3.1 C1: tepat 2 saran (baku + kata-depan), tanpa repeated-word", (() => { const r = wiAnalyze("Praktek dilakukan dirumah dengan sungguh-sungguh."); return r.suggestions.length === 2 && kinds(r).join(",") === "kata-tidak-baku,kata-depan" && invariants83(r) === true; })(), kinds(wiAnalyze("Praktek dilakukan dirumah dengan sungguh-sungguh.")));
check("8.3.1 C2: tepat 2 kalimat-mubazir, tanpa duplikat", (() => { const r = wiAnalyze("Hal ini adalah merupakan kesalahan yang disebabkan karena kelalaian."); return r.suggestions.length === 2 && r.suggestions.every(s => s.kind === "kalimat-mubazir") && invariants83(r) === true; })(), kinds(wiAnalyze("Hal ini adalah merupakan kesalahan yang disebabkan karena kelalaian.")));
check("8.3.1 C3: 3 saran tak tumpang tindih & tak bertentangan", (() => { const r = wiAnalyze("Penelitian ini ini dilakukan di lakukan dengan metode praktek."); return r.suggestions.length === 3 && kinds(r).join(",") === "repeated-word,imbuhan,kata-tidak-baku" && invariants83(r) === true; })(), kinds(wiAnalyze("Penelitian ini ini dilakukan di lakukan dengan metode praktek.")));
check("8.3.1 kutip: kata berulang di dalam kutip tidak ditandai", wiAnalyze("Guru menulis \"kata kata\" di papan tulis.").suggestions.length === 0, kinds(wiAnalyze("Guru menulis \"kata kata\" di papan tulis.")));
check("8.3.1 kunci: 'pelan - pelan' tetap ditandai kata-ulang", (() => { const r = wiAnalyze("Ia berjalan pelan - pelan menuju gerbang."); return r.suggestions.length === 1 && r.suggestions[0].kind === "kata-ulang" && r.suggestions[0].replacement === "pelan-pelan"; })(), kinds(wiAnalyze("Ia berjalan pelan - pelan menuju gerbang.")));
check("8.3.1 gugus 'a.n.' -> nol saran", wiAnalyze("Surat itu ditujukan a.n. pimpinan lembaga untuk ditindaklanjuti segera.").suggestions.length === 0, kinds(wiAnalyze("Surat itu ditujukan a.n. pimpinan lembaga untuk ditindaklanjuti segera.")));
check("8.3.1 kunci: awal kalimat asli tetap ditandai kapital", (() => { const r = wiAnalyze("Pertemuan selesai. besok kami berkumpul lagi."); return r.suggestions.length === 1 && r.suggestions[0].kind === "sentence-capital"; })(), kinds(wiAnalyze("Pertemuan selesai. besok kami berkumpul lagi.")));
check("8.3.1 apostrof 'Jum'at' -> nol saran", wiAnalyze("Jum'at adalah hari yang istimewa bagi umat.").suggestions.length === 0, kinds(wiAnalyze("Jum'at adalah hari yang istimewa bagi umat.")));
check("8.3.1 FN: efektifitas + produktifitas tertangkap", (() => { const r = wiAnalyze("Efektifitas dan produktifitas kerja tim itu dinilai dari hasil nyata."); return r.suggestions.length === 2 && r.suggestions.every(s => s.kind === "kata-tidak-baku"); })(), kinds(wiAnalyze("Efektifitas dan produktifitas kerja tim itu dinilai dari hasil nyata.")));
check("8.3.1 FN: obyektif + subyektif + kwalitatif + kwantitatif tertangkap", (() => { const r = wiAnalyze("Penilaian dilakukan secara obyektif dan subyektif dengan pendekatan kwalitatif dan kwantitatif."); return r.suggestions.length === 4 && r.suggestions.every(s => s.kind === "kata-tidak-baku"); })(), kinds(wiAnalyze("Penilaian dilakukan secara obyektif dan subyektif dengan pendekatan kwalitatif dan kwantitatif.")));
check("8.3.1 FN F4: 'obyektif' tertangkap (dianalisa dicatat belum)", (() => { const r = wiAnalyze("Hasilnya dianalisa secara obyektif oleh penilai independen."); return r.suggestions.length === 1 && r.suggestions[0].original === "obyektif"; })(), kinds(wiAnalyze("Hasilnya dianalisa secara obyektif oleh penilai independen.")));
check("8.3.1 kunci F1: 'Aktifitas' tetap tertangkap", (() => { const r = wiAnalyze("Aktifitas belajar siswa meningkat setelah perlakuan diberikan."); return r.suggestions.length === 1 && r.suggestions[0].kind === "kata-tidak-baku"; })(), kinds(wiAnalyze("Aktifitas belajar siswa meningkat setelah perlakuan diberikan.")));
check("8.3.1 F2: kreatifitas + efektifitas tepat 2 saran", (() => { const r = wiAnalyze("Kreatifitas dan efektifitas program itu dinilai baik oleh tim penilai."); return r.suggestions.length === 2 && r.suggestions.every(s => s.kind === "kata-tidak-baku"); })(), kinds(wiAnalyze("Kreatifitas dan efektifitas program itu dinilai baik oleh tim penilai.")));
check("8.3.1 kunci F3: 'diruang' tetap tertangkap", (() => { const r = wiAnalyze("Pengukuran dilakukan diruang laboratorium oleh mahasiswa."); return r.suggestions.length === 1 && r.suggestions[0].kind === "kata-depan" && r.suggestions[0].replacement === "di ruang"; })(), kinds(wiAnalyze("Pengukuran dilakukan diruang laboratorium oleh mahasiswa.")));

console.log("33) Phase 8.3.1 — korpus regresi");
check("korpus formal: paragraf bersih + sitasi -> nol saran", (() => { const r = wiAnalyze("Penelitian ini mengkaji kinerja inkubator telur berbasis Arduino untuk peternak skala kecil di Kabupaten Kuningan. Sensor suhu membaca kondisi ruang penetasan setiap lima detik, lalu mikrokontroler menyesuaikan pemanas agar suhu tetap stabil. Hasil pengujian menunjukkan tingkat keberhasilan penetasan mencapai delapan puluh persen (Rahman, 2020). Temuan ini memberi dasar bagi pengembangan alat yang lebih murah dan mudah dirawat oleh peternak."); return r.suggestions.length === 0 && invariants83(r) === true; })(), kinds(wiAnalyze("Penelitian ini mengkaji kinerja inkubator telur berbasis Arduino untuk peternak skala kecil di Kabupaten Kuningan. Sensor suhu membaca kondisi ruang penetasan setiap lima detik, lalu mikrokontroler menyesuaikan pemanas agar suhu tetap stabil. Hasil pengujian menunjukkan tingkat keberhasilan penetasan mencapai delapan puluh persen (Rahman, 2020). Temuan ini memberi dasar bagi pengembangan alat yang lebih murah dan mudah dirawat oleh peternak.")));
check("korpus akademik: nominalisasi -> tepat 1 kalimat-mubazir", (() => { const r = wiAnalyze("Peneliti melakukan pengukuran suhu udara di dalam inkubator setiap jam selama masa penetasan berlangsung."); return r.suggestions.length === 1 && r.suggestions[0].kind === "kalimat-mubazir"; })(), kinds(wiAnalyze("Peneliti melakukan pengukuran suhu udara di dalam inkubator setiap jam selama masa penetasan berlangsung.")));
check("korpus sehari-hari: hanya 2 saran cakapan (saran)", (() => { const r = wiAnalyze("Kemarin dia ketawa terus karna mendengar lelucon itu dari temannya."); return r.suggestions.length === 2 && r.suggestions.every(s => s.kind === "kata-tidak-baku" && s.certainty === "saran"); })(), kinds(wiAnalyze("Kemarin dia ketawa terus karna mendengar lelucon itu dari temannya.")));
check("korpus paragraf panjang: tepat 1 penasihat kalimat-panjang", (() => { const r = wiAnalyze("Penelitian ini bertujuan untuk menganalisis pengaruh penggunaan media pembelajaran interaktif berbasis teknologi informasi terhadap peningkatan hasil belajar siswa pada mata pelajaran matematika di sekolah menengah atas yang berada di wilayah perkotaan dengan mempertimbangkan berbagai faktor pendukung dan penghambat yang muncul selama proses pembelajaran berlangsung di kelas."); return r.suggestions.length === 1 && r.suggestions[0].advisory === true && r.suggestions[0].kind === "kalimat-panjang"; })(), kinds(wiAnalyze("Penelitian ini bertujuan untuk menganalisis pengaruh penggunaan media pembelajaran interaktif berbasis teknologi informasi terhadap peningkatan hasil belajar siswa pada mata pelajaran matematika di sekolah menengah atas yang berada di wilayah perkotaan dengan mempertimbangkan berbagai faktor pendukung dan penghambat yang muncul selama proses pembelajaran berlangsung di kelas.")));
check("korpus enumerasi: daftar + ekor kalimat -> nol saran", wiAnalyze("Siswa membawa buku, pena, penggaris, penghapus, dan tas ke sekolah setiap hari.").suggestions.length === 0, kinds(wiAnalyze("Siswa membawa buku, pena, penggaris, penghapus, dan tas ke sekolah setiap hari.")));
check("korpus kutipan langsung: isi kutip tidak ditandai", wiAnalyze("Budi berkata, \"Praktek saya lakukan dirumah saja.\" Semua orang terdiam mendengarnya.").suggestions.length === 0, kinds(wiAnalyze("Budi berkata, \"Praktek saya lakukan dirumah saja.\" Semua orang terdiam mendengarnya.")));
check("korpus teknis: istilah teknis -> nol saran", wiAnalyze("Data disimpan dalam format JSON dan diproses dengan Python 3.12 di server lokal.").suggestions.length === 0, kinds(wiAnalyze("Data disimpan dalam format JSON dan diproses dengan Python 3.12 di server lokal.")));
check("korpus Unicode: emoji + diakritik + 1 kesalahan, offset & apply eksak", (() => { const r = wiAnalyze("Kafé itu menyajikan kopi ☕ yang nikmat, tetapi praktek pembayarannya masih tunai."); return r.suggestions.length === 1 && r.suggestions[0].kind === "kata-tidak-baku" && invariants83(r) === true && joinRes(r, wiApply(r.paragraphs, r.suggestions, r.suggestions.map(s => s.id))) === "Kafé itu menyajikan kopi ☕ yang nikmat, tetapi praktik pembayarannya masih tunai."; })(), kinds(wiAnalyze("Kafé itu menyajikan kopi ☕ yang nikmat, tetapi praktek pembayarannya masih tunai.")));
check("korpus campuran ID-EN: bagian Inggris -> nol saran", wiAnalyze("Penelitian ini meneliti sistem irigasi modern. The team conducted a detailed analysis of the formal system. Hasilnya menunjukkan peningkatan hasil panen yang nyata.").suggestions.length === 0, kinds(wiAnalyze("Penelitian ini meneliti sistem irigasi modern. The team conducted a detailed analysis of the formal system. Hasilnya menunjukkan peningkatan hasil panen yang nyata.")));

console.log("\nWI TESTS:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
