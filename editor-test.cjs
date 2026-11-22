/* D8 Tahap 4 — Node tests for the Writing editor ED-CORE (extracted from index.html).
   Serialisasi diuji pada pohon simpul tiruan dengan antarmuka minimal yang sama
   dengan yang dipakai ED-CORE (nodeType, tagName, childNodes, nodeValue) —
   bentuk pohon meniru hasil nyata Firefox (terukur lewat probe peramban):
   blok kosong <p><br></p>, Shift+Enter di akhir blok <p>teks<br><br></p>,
   artefak &nbsp; di awal blok hasil belah paragraf, dan "<br>" sisa
   sesudah hapus-semua. Gerbang ekuivalensi: wiAnalyze atas hasil
   serialisasi jalur editor harus IDENTIK dengan jalur textarea polos. */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

function grabCore(startMark, endMark) {
  const raw = html.split(startMark)[1].split(endMark)[0];
  return raw.slice(raw.indexOf("*/") + 2);
}
const wiCore = grabCore("WI-CORE-START", "/* WI-CORE-END */");
const edCore = grabCore("ED-CORE-START", "/* ED-CORE-END */");

const sandbox = {};
new Function("sandbox", wiCore + "\n" + edCore +
  "\nsandbox.wiAnalyze = wiAnalyze;" +
  " sandbox.wiEdSplitBlocks = wiEdSplitBlocks; sandbox.wiEdSerialize = wiEdSerialize;" +
  " sandbox.wiEdUnits = wiEdUnits; sandbox.wiEdFilterStyle = wiEdFilterStyle; sandbox.wiEdPxLen = wiEdPxLen;")(sandbox);
const { wiAnalyze, wiEdSplitBlocks, wiEdSerialize, wiEdUnits, wiEdFilterStyle, wiEdPxLen } = sandbox;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}
function eq(name, got, want) { check(name, got === want, { got, want }); }

/* ---------- Pohon tiruan ---------- */
function T(v) { return { nodeType: 3, nodeValue: v, childNodes: [] }; }
function E(tag, kids) { return { nodeType: 1, tagName: tag, childNodes: kids || [] }; }
function ROOT(kids) { return { nodeType: 9, tagName: undefined, childNodes: kids || [] }; }
/* Tiruan persis renderFromBackbone pada lem editor. */
function fakeRender(text) {
  return ROOT(wiEdSplitBlocks(text).map(function (lines) {
    const kids = [];
    lines.forEach(function (line, i) {
      if (i > 0) kids.push(E("BR"));
      if (line === "" && lines.length === 1) { kids.push(E("BR")); return; } /* <p><br></p>, seperti lem */
      kids.push(T(line));
    });
    return E("P", kids);
  }));
}

console.log("1) wiEdSplitBlocks");
check("satu paragraf", JSON.stringify(wiEdSplitBlocks("abc")) === '[["abc"]]', wiEdSplitBlocks("abc"));
check("dua paragraf", JSON.stringify(wiEdSplitBlocks("a\n\nb")) === '[["a"],["b"]]', wiEdSplitBlocks("a\n\nb"));
check("baris intra-paragraf", JSON.stringify(wiEdSplitBlocks("a\nb\n\nc")) === '[["a","b"],["c"]]', wiEdSplitBlocks("a\nb\n\nc"));
check("teks kosong", JSON.stringify(wiEdSplitBlocks("")) === '[[""]]', wiEdSplitBlocks(""));
check("tiga newline dipertahankan sebagai struktur", JSON.stringify(wiEdSplitBlocks("a\n\n\nb")) === '[["a"],["","b"]]', wiEdSplitBlocks("a\n\n\nb"));

console.log("2) Serialisasi: bentuk dasar");
eq("dua paragraf", wiEdSerialize(ROOT([E("P", [T("Satu.")]), E("P", [T("Dua.")])])), "Satu.\n\nDua.");
eq("br intra-paragraf", wiEdSerialize(ROOT([E("P", [T("a"), E("BR"), T("b")])])), "a\nb");
eq("format sebaris hanya teks", wiEdSerialize(ROOT([E("P", [T("Kata "), E("B", [T("tebal")]), T(" dan "), E("SPAN", [T("gaya")]), T(".")])])), "Kata tebal dan gaya.");
eq("judul", wiEdSerialize(ROOT([E("H1", [T("Bab Satu")]), E("P", [T("Isi.")])])), "Bab Satu\n\nIsi.");
eq("div sebagai blok", wiEdSerialize(ROOT([E("DIV", [T("Satu")]), E("DIV", [T("Dua")])])), "Satu\n\nDua");
eq("kutipan berisi paragraf", wiEdSerialize(ROOT([E("BLOCKQUOTE", [E("P", [T("Kutip.")])]), E("P", [T("Lanjut.")])])), "Kutip.\n\nLanjut.");
eq("pre dengan newline", wiEdSerialize(ROOT([E("PRE", [T("a\nb")])])), "a\nb");

console.log("3) Serialisasi: daftar");
eq("item daftar = unit sendiri", wiEdSerialize(ROOT([E("UL", [E("LI", [T("Apel")]), E("LI", [T("Jeruk")])]), E("P", [T("Tutup.")])])), "Apel\n\nJeruk\n\nTutup.");
eq("daftar bersarang", wiEdSerialize(ROOT([E("UL", [E("LI", [T("Induk"), E("UL", [E("LI", [T("Anak")])])])])])), "Induk\n\nAnak");
eq("daftar nomor", wiEdSerialize(ROOT([E("OL", [E("LI", [T("Pertama")]), E("LI", [T("Kedua")])])])), "Pertama\n\nKedua");

console.log("4) Serialisasi: teks liar di akar");
eq("teks liar saja", wiEdSerialize(ROOT([T("Halo dunia")])), "Halo dunia");
eq("teks liar + blok", wiEdSerialize(ROOT([T("Pembuka"), E("P", [T("Isi.")])])), "Pembuka\n\nIsi.");
eq("spasi liar antarblok dibuang", wiEdSerialize(ROOT([E("P", [T("A")]), T("\n  \n"), E("P", [T("B")])])), "A\n\nB");
eq("akar hanya <br> (sisa hapus-semua)", wiEdSerialize(ROOT([E("BR")])), "");
eq("editor kosong", wiEdSerialize(ROOT([])), "");
eq("blok kosong tunggal", wiEdSerialize(ROOT([E("P", [])])), "");
eq("blok kosong di tengah (tanpa anak)", wiEdSerialize(ROOT([E("P", [T("A")]), E("P", []), E("P", [T("B")])])), "A\n\n\n\nB");
eq("blok berisi spasi dipertahankan", wiEdSerialize(ROOT([E("P", [T("A")]), E("P", [T(" ")]), E("P", [T("B")])])), "A\n\n \n\nB");

console.log("5) Serialisasi: artefak Firefox (terukur lewat probe)");
eq("<p><br></p> blok kosong peramban", wiEdSerialize(ROOT([E("P", [T("Atas")]), E("P", [E("BR")]), E("P", [T("Bawah")])])), "Atas\n\n\n\nBawah");
eq("Shift+Enter di akhir blok: <br><br> = satu baris baru", wiEdSerialize(ROOT([E("P", [T("abc def"), E("BR"), E("BR")])])), "abc def\n");
eq("sesudah Shift+Enter lalu mengetik", wiEdSerialize(ROOT([E("P", [T("abc def"), E("BR"), T("x")])])), "abc def\nx");
eq("artefak nbsp awal blok hasil belah paragraf", wiEdSerialize(ROOT([E("P", [T("abc")]), E("P", [T("\u00A0def")])])), "abc\n\n def");
eq("nbsp di tengah teks dinormalkan", wiEdSerialize(ROOT([E("P", [T("kata\u00A0kata")])])), "kata kata");
eq("ZWSP penanda ketik dibuang", wiEdSerialize(ROOT([E("P", [E("SPAN", [T("\u200Bteks")])])])), "teks");
eq("render: unit berakhiran newline memakai teks kosong eksplisit (tanpa pop)", wiEdSerialize(ROOT([E("P", [T("abc"), E("BR"), T("")])])), "abc\n");

console.log("6) Titik tetap render <-> serialisasi");
const FIXED = [
  "", "Halo", "Satu kalimat saja.", "A\nB", "A\n\nB", "A\n\n\nB", "\n\nA", "A\n\n", "A\n\n\n\nB",
  "  spasi tepi  ", "Baris satu\nbaris dua\n\nParagraf dua.",
  "Pemerintah desa mengumumkan jadwal baru.\n\nKegiatan gotong royong dilaksanakan pada hari Minggu pagi.",
  "Kata  ganda   berjarak.\n\n\nSesudah tiga newline.",
  "Tab\tberjajar di sini.\n\nSelesai."
];
FIXED.forEach(function (t, i) {
  eq("titik tetap #" + (i + 1), wiEdSerialize(fakeRender(t)), t);
});

console.log("7) Gerbang ekuivalensi wiAnalyze (editor vs textarea)");
const BATTERY = [
  "Penelitian ini dilakukan untuk menganalisa data yang diperoleh dari lapangan.",
  "Hasil hasil penelitian menunjukkan bahwa praktek di lapangan masih belum rapi.\n\nOleh karena itu, kami menyarankan agar tehnik yang dipakai segera diperbaiki.",
  "Kalimat pertama.\nBaris kedua masih satu paragraf.\n\nParagraf kedua berisi kata yang diulang ulang dan spasi  ganda.",
  "Judul Bab\n\nIsi bab menjelaskan metoda yang dipakai serta resiko yang mungkin muncul.",
  "Satu.\n\n\nTiga newline di antara paragraf.",
  "Paragraf dengan angka 123 dan tanggal 12-11-2026 serta singkatan dll. yang lazim.",
  "Kalimat ini sengaja dibuat sangat panjang sekali karena ia memuat begitu banyak anak kalimat yang saling bertumpuk satu di atas yang lain tanpa jeda yang memadai sehingga pembaca yang membacanya dalam sekali jalan akan merasa kehabisan napas sebelum tiba di titik akhir kalimat ini."
];
BATTERY.forEach(function (t, i) {
  const viaEditor = wiAnalyze(wiEdSerialize(fakeRender(t)));
  const viaPlain = wiAnalyze(t);
  check("ekuivalen #" + (i + 1) + " (paragraf+separator+saran identik)",
    JSON.stringify(viaEditor) === JSON.stringify(viaPlain),
    { editor: viaEditor.suggestions.length, plain: viaPlain.suggestions.length });
});
/* Bentuk pohon hasil ketikan Firefox (blok terbungkus sesudah Enter): */
const typedTree = ROOT([E("P", [T("Penelitian ini dilakukan untuk menganalisa data.")]), E("P", [T("Hasil hasil dicatat.")])]);
const typedText = "Penelitian ini dilakukan untuk menganalisa data.\n\nHasil hasil dicatat.";
eq("pohon ketikan -> teks", wiEdSerialize(typedTree), typedText);
check("pohon ketikan -> analisis identik",
  JSON.stringify(wiAnalyze(wiEdSerialize(typedTree))) === JSON.stringify(wiAnalyze(typedText)));

console.log("8) wiEdUnits");
check("jumlah unit", wiEdUnits(ROOT([E("P", [T("A")]), E("UL", [E("LI", [T("B")]), E("LI", [T("C")])])])).length === 3);
check("unit kosong ikut terhitung", wiEdUnits(ROOT([E("P", [T("A")]), E("P", [E("BR")]), E("P", [T("B")])])).join("|") === "A||B");

console.log("9) wiEdFilterStyle");
eq("inline: color dipertahankan", wiEdFilterStyle("color: red; font-weight: bold", "inline"), "color: red; font-weight: bold");
eq("inline: properti asing dibuang", wiEdFilterStyle("position: absolute; color: blue", "inline"), "color: blue");
eq("inline: url() ditolak", wiEdFilterStyle("color: url(javascript:x); background-color: #fff", "inline"), "background-color: #fff");
eq("inline: expression ditolak", wiEdFilterStyle("width: expression(alert(1)); color: green", "inline"), "color: green");
eq("block: text-align + margin dipertahankan", wiEdFilterStyle("text-align: center; margin-left: 24px; color: red", "block"), "text-align: center; margin-left: 24px");
eq("block: color dibuang", wiEdFilterStyle("color: red", "block"), "");
eq("gaya kosong", wiEdFilterStyle("", "inline"), "");
eq("huruf besar properti ditoleransi", wiEdFilterStyle("COLOR: red", "inline"), "color: red");

console.log("10) wiEdPxLen");
eq("px", wiEdPxLen("24px"), 24);
eq("pt -> px", wiEdPxLen("12pt"), 16);
eq("tanpa satuan", wiEdPxLen("24"), 24);
eq("negatif", wiEdPxLen("-24px"), -24);
eq("sampah -> 0", wiEdPxLen("abc"), 0);
eq("kosong -> 0", wiEdPxLen(""), 0);

console.log("\nHASIL editor-test: " + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
