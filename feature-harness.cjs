#!/usr/bin/env node
/*
 * Saksara — stub harness for the 2026-11-20 feature build.
 * Extracts the page's REAL functions from ../index.html (heuristic core by
 * slice, the rest by string/comment/regex-aware brace matching) and tests:
 *   (a) excludeStandardParts on a synthetic document + filter-off invariance
 *   (b) batch scoring (scoreBatchText) equals direct analyze() calls
 *   (c) compareLineText visibility + delta rules
 *   (d) buildTelemetryPayload exact key set (no text-like field)
 * Usage: node feature-harness.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8").replace(/<(?:link|script)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>(?:\s*<\/script>)?/gi, (tag, ref) => { const assetPath = ref.split(/[?#]/)[0].replace(/^\.?\//, ""); return assetPath.startsWith("assets/") ? fs.readFileSync(path.join(__dirname, assetPath), "utf8") : tag; });

/* ---------- string/comment/regex-aware brace-matched extraction ---------- */
function extractFn(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error("signature not found: " + signature);
  let i = src.indexOf("{", start);
  if (i < 0) throw new Error("no opening brace for " + signature);
  let depth = 0;
  let state = "normal"; // normal | sq | dq | tpl | line | block | regex | regexClass
  const tplStack = [];
  let lastSig = "";
  let lastWord = "";
  for (let p = i; p < src.length; p++) {
    const c = src[p], n = src[p + 1] || "";
    if (state === "line") { if (c === "\n") state = "normal"; continue; }
    if (state === "block") { if (c === "*" && n === "/") { p++; state = "normal"; } continue; }
    if (state === "sq") { if (c === "\\") p++; else if (c === "'") state = "normal"; continue; }
    if (state === "dq") { if (c === "\\") p++; else if (c === '"') state = "normal"; continue; }
    if (state === "regex") {
      if (c === "\\") p++;
      else if (c === "[") state = "regexClass";
      else if (c === "/") { state = "normal"; lastSig = "/"; }
      continue;
    }
    if (state === "regexClass") { if (c === "\\") p++; else if (c === "]") state = "regex"; continue; }
    if (state === "tpl") {
      if (c === "\\") p++;
      else if (c === "`") state = "normal";
      else if (c === "$" && n === "{") { tplStack.push(depth); state = "normal"; p++; depth++; }
      continue;
    }
    // normal
    if (c === "/" && n === "/") { state = "line"; p++; continue; }
    if (c === "/" && n === "*") { state = "block"; p++; continue; }
    if (c === "'") { state = "sq"; continue; }
    if (c === '"') { state = "dq"; continue; }
    if (c === "`") { state = "tpl"; continue; }
    if (c === "/" && ("(,=:[!&|?;{}+-*%~^".includes(lastSig) || /^(return|typeof|case|in|of)$/.test(lastWord))) { state = "regex"; continue; }
    if (c === "{") { depth++; lastSig = "{"; lastWord = ""; continue; }
    if (c === "}") {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); state = "tpl"; continue; }
      if (depth === 0) return src.slice(start, p + 1);
      lastSig = "}"; lastWord = ""; continue;
    }
    if (!/\s/.test(c)) {
      lastSig = c;
      if (/[A-Za-z_$]/.test(c)) lastWord += c; else if (!/[0-9]/.test(c)) lastWord = "";
    }
  }
  throw new Error("unbalanced braces for " + signature);
}

/* ---------- assemble the page's real code ---------- */
const coreStart = html.indexOf("var PHRASES_OLD");
const coreEnd = html.indexOf("var $ = function(id)");
if (coreStart < 0 || coreEnd < 0) throw new Error("core markers not found");
const core = html.slice(coreStart, coreEnd);

const fns = [
  extractFn(html, "function pct("),
  extractFn(html, "function capAnalysisText("),
  extractFn(html, "function isHeadingLikeLine("),
  extractFn(html, "function excludeStandardParts("),
  extractFn(html, "function compareLineText("),
  extractFn(html, "function buildTelemetryPayload("),
  extractFn(html, "function stripListSections("),
  extractFn(html, "function stripStructuralHeadings("),
  extractFn(html, "async function scoreBatchText("),
].join("\n");

const $stub = function (id) {
  if (id === "score-num") return { textContent: "42" };
  return { textContent: "", style: {}, disabled: false };
};
const factory = new Function(
  "$", "clfState", "runClassifierScore",
  core + "\nvar MAX_ANALYZE_WORDS = 100000;\nvar lastClfScore = null;\n" + fns + `
;return {
  analyze: analyze, wordsOf: wordsOf,
  CONTOH_MANUSIA: CONTOH_MANUSIA, CONTOH_AI: CONTOH_AI,
  excludeStandardParts: excludeStandardParts,
  scoreBatchText: scoreBatchText,
  compareLineText: compareLineText,
  buildTelemetryPayload: buildTelemetryPayload,
  setLastClfScore: function (v) { lastClfScore = v; }
};`
);
const api = factory($stub, "off", async function () { return null; });

let failures = 0;
function check(tag, cond, detail) {
  console.log((cond ? "OK   " : "FAIL ") + tag + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}

/* ---------- (a) exclusion zones ---------- */
const kpBlock = [
  "Kata Pengantar",
  "Puji syukur penulis panjatkan ke hadirat Tuhan Yang Maha Esa atas rahmat dan karunia-Nya sehingga laporan ini dapat diselesaikan dengan baik tepat pada waktunya tanpa hambatan yang berarti sama sekali bagi semua pihak yang terlibat dalam penyusunannya.",
  "Penulis",
].join("\n");
const quoteInner = "metode kualitatif deskriptif menekankan pemahaman mendalam terhadap fenomena yang diteliti melalui pengamatan langsung wawancara mendalam analisis dokumen serta triangulasi sumber data yang beragam untuk memastikan keabsahan temuan penelitian yang diperoleh di lapangan secara menyeluruh dan dapat dipertanggungjawabkan secara ilmiah kepada pembaca";
const tableLines = ["1 | 23,5 | 4.567 | 89,0 | 12", "2 | 98,1 | 7.654 | 10,2 | 33"].join("\n");
const refsBlock = [
  "Daftar Pustaka",
  "Sugiyono. 2019. Metode Penelitian Kuantitatif Kualitatif dan R&D. Bandung: Alfabeta.",
  "Arikunto, Suharsimi. 2010. Prosedur Penelitian Suatu Pendekatan Praktik. Jakarta: Rineka Cipta.",
].join("\n");
const bodyBlock = [
  "Isi utama penelitian ini membahas metode yang digunakan dalam pengumpulan data lapangan secara sistematis dan terukur.",
  "Data dikumpulkan melalui observasi langsung di tiga lokasi berbeda selama dua bulan penuh.",
  "Setiap lokasi dipilih berdasarkan kriteria yang telah ditetapkan sebelumnya oleh tim peneliti.",
  "Hasil observasi kemudian dianalisis dengan pendekatan kualitatif deskriptif yang menekankan kedalaman makna dari setiap temuan di lapangan.",
  "Menurut seorang ahli, “" + quoteInner + "” sehingga pendekatan itu dipilih.",
  "Baris tabel berikut memuat angka hasil pengukuran.",
  tableLines,
].join("\n");
const synthetic = ["Judul Penelitian", "", kpBlock, "", bodyBlock, "", refsBlock].join("\n");

const excl = api.excludeStandardParts(synthetic);
check("a1 parts found", JSON.stringify(excl.parts) === JSON.stringify(["daftar pustaka", "kata pengantar", "kutipan", "baris tabel"]), JSON.stringify(excl.parts));
check("a2 body kept", excl.text.includes("Isi utama penelitian ini membahas"));
check("a3 references removed", !excl.text.includes("Sugiyono") && !excl.text.includes("Daftar Pustaka"));
check("a4 kata pengantar removed", !excl.text.includes("Puji syukur") && !excl.text.includes("Kata Pengantar"));
check("a5 long quote removed", !excl.text.includes("triangulasi") && excl.text.includes("sehingga pendekatan itu dipilih"));
check("a6 table lines removed", !excl.text.includes("23,5") && excl.text.includes("Baris tabel berikut memuat angka"));
const expectedExcluded =
  api.wordsOf(kpBlock).length + api.wordsOf(refsBlock).length +
  api.wordsOf(quoteInner).length + api.wordsOf(tableLines).length;
check("a7 excludedWords exact", excl.excludedWords === expectedExcluded,
  "got " + excl.excludedWords + " want " + expectedExcluded);
// plain text without standard parts: filter is a no-op (byte-identical input to analyze)
const plain = api.CONTOH_MANUSIA;
const exclPlain = api.excludeStandardParts(plain);
check("a8 no-op on plain text", exclPlain.excludedWords === 0 && exclPlain.text === plain);
// filter-off path: runAnalysisBody only invokes the filter under the checkbox
const bodySrc = html.slice(html.indexOf("function runAnalysisBody"), html.indexOf("function showSentenceDetail"));
check("a9 filter gated by checkbox", bodySrc.includes('exclBox.checked') && bodySrc.indexOf("exclBox.checked") < bodySrc.indexOf("excludeStandardParts(text)"));

/* ---------- (b) batch scoring equals direct analyze() ---------- */
(async function () {
  const texts = [api.CONTOH_MANUSIA, api.CONTOH_AI,
    "Kucing itu tidur di teras rumah sepanjang sore. Angin bertiup pelan dari arah kebun belakang. Tidak ada kejadian istimewa hari ini."];
  let allOk = true;
  for (let t = 0; t < texts.length; t++) {
    const direct = api.analyze(texts[t]);
    const viaBatch = await api.scoreBatchText(texts[t]);
    const ok = viaBatch.score === direct.final && viaBatch.words === direct.words &&
      viaBatch.indicatedPct === (direct.sents.length ? Math.round(direct.flagCount / direct.sents.length * 100) : 0);
    if (!ok) allOk = false;
    console.log("     batch[" + t + "] score=" + viaBatch.score.toFixed(4) + " direct=" + direct.final.toFixed(4) + " words=" + viaBatch.words);
  }
  check("b1 batch scores == analyze()", allOk);

  /* ---------- (c) compare line ---------- */
  const cur = { text: "teks B", finalPct: 55 };
  check("c1 no previous run", api.compareLineText(null, cur) === null);
  check("c2 same text hidden", api.compareLineText({ text: "teks B", finalPct: 40 }, cur) === null);
  const line = api.compareLineText({ text: "teks A", finalPct: 40 }, cur);
  check("c3 positive delta", line === "Analisis sebelumnya pada sesi ini: 40% — sekarang 55% (selisih +15,0 poin).", line || "");
  const lineNeg = api.compareLineText({ text: "teks A", finalPct: 55 }, { text: "teks B", finalPct: 40 });
  check("c4 negative delta", lineNeg === "Analisis sebelumnya pada sesi ini: 55% — sekarang 40% (selisih -15,0 poin).", lineNeg || "");
  const lineZero = api.compareLineText({ text: "teks A", finalPct: 40 }, { text: "teks B", finalPct: 40 });
  check("c5 zero delta still shown for different text", lineZero === "Analisis sebelumnya pada sesi ini: 40% — sekarang 40% (selisih 0,0 poin).", lineZero || "");

  /* ---------- (d) telemetry payload ---------- */
  const res = api.analyze(api.CONTOH_AI);
  api.setLastClfScore(null);
  const payload = api.buildTelemetryPayload(res, "ai");
  const keys = Object.keys(payload).sort();
  const wantKeys = ["clf", "engine", "final", "heur", "sentPct", "sentences", "signals",
    "userLabel", "words"].sort();
  check("d1 exact key set", JSON.stringify(keys) === JSON.stringify(wantKeys), keys.join(","));
  check("d2 values", payload.heur === res.final && payload.clf === null && payload.final === 0.42 &&
    payload.signals && payload.signals.burstiness === res.burst && payload.signals.kosakata === res.vocab &&
    payload.signals.frasa === res.phraseGlobal && payload.signals.stilometri === res.stylo &&
    payload.signals.markdown === res.markdown && payload.signals.simetri === res.symmetry &&
    payload.signals.pengulangan === res.repetition && payload.words === res.words &&
    payload.sentences === res.sents.length &&
    payload.sentPct === res.flagCount / res.sents.length &&
    payload.userLabel === "ai" && payload.engine === "heuristik-v3");
  const payloadJson = JSON.stringify(payload);
  check("d3 no text content leaks", !payloadJson.includes("teknologi") && !payloadJson.includes("pembelajaran") && !/teks|text|nama|file/i.test(keys.join(",")));
  api.setLastClfScore(0.5);
  const payload2 = api.buildTelemetryPayload(res, "manusia");
  check("d4 clf carried when present", payload2.clf === 0.5 && payload2.userLabel === "manusia");

  console.log(failures === 0 ? "HARNESS PASS" : "HARNESS FAIL (" + failures + " checks)");
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) { console.error("HARNESS ERROR", e); process.exit(1); });
