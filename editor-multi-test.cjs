/* D8 Tahap 5 — Node tests for the multi-surface editor factory (extracted from index.html).
   Gerbang ekuivalensi per permukaan: titik masuk analisis permukaan itu sendiri
   harus menghasilkan hasil IDENTIK JSON PENUH dari jalur editor vs jalur polos
   pada baterai >= 7 teks per permukaan, termasuk teks ber-U+00A0, U+200B,
   spasi ganda, baris mirip daftar, dan kasus tempel HTML gaya Word.
   Permukaan: detektor (rantai runAnalysisBody: stripQuotedCitations ->
   stripListSections -> stripStructuralHeadings -> capAnalysisText -> analyze),
   forensik (capAnalysisText -> wfAnalyze), bandingkan (capAnalysisText per sisi
   -> cmpDiff + wfAnalyze kedua sisi), serta periksa cepat (#p7-quick-text) dan
   hasil OCR (#ocr-out) yang menyerahkan nilainya apa adanya ke rantai detektor.
   Jalur editor dimodelkan persis seperti lem pabrik: render tulang punggung
   (wiEdSplitBlocks -> <p> per unit, <br> antarbaris, <p><br></p> untuk unit
   kosong tunggal) lalu serialisasi varian permukaan itu. */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

function grab(re, name) {
  const m = html.match(re);
  if (!m) throw new Error("cannot extract " + name);
  return m[0];
}
const helpers = [
  grab(/function wordsOf\(s\)\{[^\n]*\}/, "wordsOf"),
  grab(/function splitSentences\(text\)\{[\s\S]*?\n      \}/, "splitSentences"),
  grab(/function splitParagraphs\(text\)\{[\s\S]*?\n      \}/, "splitParagraphs"),
].join("\n");
const detRegion = html.slice(html.indexOf("var PHRASES_OLD"), html.indexOf("var $ = function(id)"));
const strips = [
  grab(/var MAX_ANALYZE_WORDS = \d+;/, "MAX"),
  grab(/function capAnalysisText\(text\)\{[\s\S]*?\n      \}/, "capAnalysisText"),
  grab(/function stripQuotedCitations\(text\)\{[\s\S]*?\n      \}/, "stripQuotedCitations"),
  grab(/function stripListSections\(text\)\{[\s\S]*?\n      \}/, "stripListSections"),
  grab(/function stripStructuralHeadings\(text\)\{[\s\S]*?\n      \}/, "stripStructuralHeadings"),
  grab(/function isTitleCasePhrase\(s\)\{[\s\S]*?\n      \}/, "isTitleCasePhrase"),
  grab(/function isHeadingLikeLine\(line\)\{[\s\S]*?\n      \}/, "isHeadingLikeLine"),
].join("\n");
function grabCore(startMark, endMark) {
  const raw = html.split(startMark)[1].split(endMark)[0];
  return raw.slice(raw.indexOf("*/") + 2);
}
const wfCore = grabCore("WF-CORE-START", "/* WF-CORE-END */");
const cmpCore = grabCore("CMP-CORE-START", "/* CMP-CORE-END */");
const edCore = grabCore("ED-CORE-START", "/* ED-CORE-END */");
const contohM = grab(/var CONTOH_MANUSIA = "[\s\S]*?";/, "CONTOH_MANUSIA");
const contohA = grab(/var CONTOH_AI = "[\s\S]*?";/, "CONTOH_AI");

const sandbox = {};
new Function("sandbox",
  helpers + "\n" + detRegion + "\n" + strips + "\n" + wfCore + "\n" + cmpCore + "\n" + edCore + "\n" + contohM + "\n" + contohA +
  "\nsandbox.analyze = analyze; sandbox.wfAnalyze = wfAnalyze; sandbox.cmpDiff = cmpDiff;" +
  " sandbox.capAnalysisText = capAnalysisText; sandbox.stripQuotedCitations = stripQuotedCitations;" +
  " sandbox.stripListSections = stripListSections; sandbox.stripStructuralHeadings = stripStructuralHeadings;" +
  " sandbox.wiEdSplitBlocks = wiEdSplitBlocks; sandbox.wiEdSerialize = wiEdSerialize;" +
  " sandbox.wiEdSerializeLiteral = wiEdSerializeLiteral; sandbox.wiEdUnits = wiEdUnits;" +
  " sandbox.CONTOH_MANUSIA = CONTOH_MANUSIA; sandbox.CONTOH_AI = CONTOH_AI;")(sandbox);
const S = sandbox;

/* ---------- Titik masuk analisis per permukaan (replika jalur polos) ---------- */
function wordsIn(t) { return (String(t).match(/[\p{L}\p{N}']+/gu) || []).length; }
function detEntry(text) {
  var qs = S.stripQuotedCitations(text);
  if (qs.words > 0 && wordsIn(qs.text) > 0) text = qs.text;
  var secs = S.stripListSections(text);
  if (secs.words > 0 && wordsIn(secs.text) > 0) text = secs.text;
  var heads = S.stripStructuralHeadings(text);
  if (heads.lines > 0 && wordsIn(heads.text) > 0) text = heads.text;
  return S.analyze(S.capAnalysisText(text).text);
}
function wfEntry(text) { return S.wfAnalyze(S.capAnalysisText(text).text); }
function cmpEntry(a, b) {
  var ca = S.capAnalysisText(a), cb = S.capAnalysisText(b);
  return { R: S.cmpDiff(ca.text, cb.text), fa: S.wfAnalyze(ca.text), fb: S.wfAnalyze(cb.text) };
}

/* ---------- Pohon tiruan: tiruan persis renderFromBackbone pada lem ---------- */
function T(v) { return { nodeType: 3, nodeValue: v, childNodes: [] }; }
function E(tag, kids) { return { nodeType: 1, tagName: tag, childNodes: kids || [] }; }
function ROOT(kids) { return { nodeType: 9, tagName: undefined, childNodes: kids || [] }; }
function fakeRender(text) {
  return ROOT(S.wiEdSplitBlocks(text).map(function (lines) {
    const kids = [];
    lines.forEach(function (line, i) {
      if (i > 0) kids.push(E("BR"));
      if (line === "" && lines.length === 1) { kids.push(E("BR")); return; }
      kids.push(T(line));
    });
    return E("P", kids);
  }));
}
const serLit = (root) => S.wiEdSerializeLiteral(root);
const serNorm = (root) => S.wiEdSerialize(root);

/* ---------- Baterai ---------- */
const NB = String.fromCharCode(0xA0), ZW = String.fromCharCode(0x200B);
const BATTERY = [
  ["polos", "Pemerintah desa mengumumkan jadwal baru untuk pelayanan administrasi warga.\n\nKegiatan gotong royong akan dilaksanakan pada hari Minggu pagi di balai desa. Seluruh warga diharapkan membawa peralatan masing-masing dari rumah."],
  ["nbsp", "Penelitian ini" + NB + "dilakukan untuk menganalisa data yang diperoleh di lapangan.\n\nHasilnya" + NB + "menunjukkan kecenderungan yang" + NB + "jelas dan konsisten."],
  ["zwsp", "Metode" + ZW + " yang dipakai dalam penelitian ini cukup sederhana dan terukur.\n\nData" + ZW + "dikumpulkan selama tiga bulan penuh."],
  ["spasi-ganda", "Kalimat  dengan   spasi    ganda di beberapa tempat.\n\nParagraf   kedua  juga  berjarak  lebar."],
  ["daftar", "Bahan yang diperlukan:\n- 2 butir telur\n- 100 gram tepung terigu\n- 50 gram gula pasir\n\nCara membuat:\n1. Campur semua bahan hingga rata.\n2. Panggang selama 30 menit."],
  ["tiga-newline", "Paragraf pertama berisi kalimat pembuka.\n\n\nParagraf kedua sesudah tiga newline.\n"],
  ["contoh-manusia", S.CONTOH_MANUSIA],
  ["contoh-ai", S.CONTOH_AI],
];
/* Kasus tempel gaya Word: pohon hasil sanitasi khas Word — paragraf dengan
   span bergaya, NBSP di tengah kalimat, satu daftar; teks polos pasangannya
   adalah teks yang sama persis seperti bila diketik/ditempel polos. */
function wordTree() {
  return ROOT([
    E("P", [E("SPAN", [T("Pendahuluan")])]),
    E("P", [E("SPAN", [T("Teknologi" + NB + "kecerdasan buatan telah" + NB + "berkembang pesat.")]), T(" Banyak" + NB + "sektor memanfaatkannya.")]),
    E("UL", [E("LI", [T("Poin pertama daftar")]), E("LI", [T("Poin kedua daftar")])]),
    E("P", [T("Penutup dengan" + NB + "spasi" + NB + "nbsp di tengah kalimat.")])
  ]);
}
const WORD_PLAIN = "Pendahuluan\n\nTeknologi" + NB + "kecerdasan buatan telah" + NB + "berkembang pesat. Banyak" + NB + "sektor memanfaatkannya.\n\nPoin pertama daftar\n\nPoin kedua daftar\n\nPenutup dengan" + NB + "spasi" + NB + "nbsp di tengah kalimat.";
function wordTreeB() {
  const bt = wordTree();
  bt.childNodes[0].childNodes[0].childNodes[0].nodeValue = "Pengantar";
  bt.childNodes[3].childNodes[0].nodeValue = "Akhir dengan" + NB + "spasi" + NB + "nbsp di tengah kalimat.";
  return bt;
}
const WORD_PLAIN_B = WORD_PLAIN.replace("Pendahuluan", "Pengantar").replace("Penutup", "Akhir");
function editedB(t) {
  return t.replace("jadwal baru", "jadwal terbaru").replace("Penelitian ini", "Studi ini")
    .replace("Kalimat", "Sebuah kalimat").replace("Bahan", "Bahan-bahan")
    .replace("Paragraf pertama", "Bagian pertama").replace("Metode", "Pendekatan");
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + String(extra).slice(0, 300)); }
}
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

console.log("0) Varian serialisasi ED-CORE");
check("wiEdSerializeLiteral tersedia", typeof S.wiEdSerializeLiteral === "function");
check("literal mempertahankan NBSP+ZWSP", serLit(ROOT([E("P", [T("a" + NB + "b")]), E("P", [T("c" + ZW + "d")])])) === "a" + NB + "b\n\nc" + ZW + "d");
check("normalisasi (jalur WI) tidak berubah: NBSP->spasi, ZWSP dibuang",
  serNorm(ROOT([E("P", [T("a" + NB + "b")]), E("P", [T("c" + ZW + "d")])])) === "a b\n\ncd");

console.log("1) Titik tetap literal: serializeLiteral(render(teks)) === teks");
BATTERY.forEach(function ([name, t]) {
  check("titik tetap " + name, serLit(fakeRender(t)) === t);
});

console.log("2) DETEKTOR — rantai runAnalysisBody identik (editor literal vs polos)");
BATTERY.forEach(function ([name, t]) {
  check("detektor " + name, sameJson(detEntry(serLit(fakeRender(t))), detEntry(t)));
});
check("detektor word-paste", sameJson(detEntry(serLit(wordTree())), detEntry(WORD_PLAIN)));

console.log("3) FORENSIK — wfAnalyze(terbatas) identik");
BATTERY.forEach(function ([name, t]) {
  check("forensik " + name, sameJson(wfEntry(serLit(fakeRender(t))), wfEntry(t)));
});
check("forensik word-paste", sameJson(wfEntry(serLit(wordTree())), wfEntry(WORD_PLAIN)));

console.log("4) BANDINGKAN — cmpDiff + wfAnalyze dua sisi identik (kedua kotak literal)");
BATTERY.forEach(function ([name, t]) {
  const b = editedB(t);
  check("bandingkan " + name, sameJson(cmpEntry(serLit(fakeRender(t)), serLit(fakeRender(b))), cmpEntry(t, b)));
});
check("bandingkan word-paste", sameJson(cmpEntry(serLit(wordTree()), serLit(wordTreeB())), cmpEntry(WORD_PLAIN, WORD_PLAIN_B)));

console.log("5) Serah-terima apa adanya: #p7-quick-text dan #ocr-out (nilai -> rantai detektor)");
["nbsp", "zwsp", "polos"].forEach(function (name) {
  const t = BATTERY.find(function (x) { return x[0] === name; })[1];
  check("p7-quick nilai byte-identik + hasil detektor identik (" + name + ")",
    serLit(fakeRender(t)) === t && sameJson(detEntry(serLit(fakeRender(t))), detEntry(t)));
  check("ocr-out nilai byte-identik + hasil detektor identik (" + name + ")",
    serLit(fakeRender(t)) === t && sameJson(detEntry(serLit(fakeRender(t))), detEntry(t)));
});

console.log("6) Bukti pilihan varian terpaksa: varian NORMALISASI gagal pada teks U+200B");
{
  const t = BATTERY.find(function (x) { return x[0] === "zwsp"; })[1];
  const b = editedB(t);
  check("detektor: normalisasi != polos pada zwsp", !sameJson(detEntry(serNorm(fakeRender(t))), detEntry(t)));
  check("forensik: normalisasi != polos pada zwsp", !sameJson(wfEntry(serNorm(fakeRender(t))), wfEntry(t)));
  check("bandingkan: normalisasi != polos pada zwsp", !sameJson(cmpEntry(serNorm(fakeRender(t)), serNorm(fakeRender(b))), cmpEntry(t, b)));
}

console.log("\nHASIL editor-multi-test: " + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
