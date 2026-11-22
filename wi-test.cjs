/* Phase 8.1 — Node tests for the Writing Intelligence core (extracted from index.html). */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

const coreRaw = html.split("WI-CORE-START")[1].split("/* WI-CORE-END */")[0];
const core = coreRaw.slice(coreRaw.indexOf("*/") + 2);

const sandbox = {};
new Function("sandbox", core +
  "\nsandbox.wiAnalyze = wiAnalyze; sandbox.wiApply = wiApply; sandbox.WI_MAX_CHARS = WI_MAX_CHARS;")(sandbox);
const wiAnalyze = sandbox.wiAnalyze, wiApply = sandbox.wiApply;

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

console.log("\nWI TESTS:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
