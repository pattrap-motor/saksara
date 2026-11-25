#!/usr/bin/env node
/*
 * VeritasAI — Indonesian benchmark runner (Tahap 1).
 *
 * Extracts the heuristic core (Ensemble Heuristik v3) directly from
 * ../index.html on every run, so the benchmark always tests the exact code
 * the site ships — never a copy that can drift. It then:
 *   1. re-runs the 4 built-in calibration samples (regression guard), and
 *   2. scores every file in ./samples/ and prints per-sample scores,
 *      per-category mean/range, and false-positive / false-negative rates
 *      at the site's verdict bands (RENDAH < 0.35, SEDANG 0.35–0.65,
 *      TINGGI >= 0.65).
 *
 * Usage: node benchmark/run-benchmark.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");

const projectDir = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(projectDir, "index.html"), "utf8").replace(/<(?:link|script)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>(?:\s*<\/script>)?/gi, (tag, ref) => { const assetPath = ref.split(/[?#]/)[0].replace(/^\.?\//, ""); return assetPath.startsWith("assets/") ? fs.readFileSync(path.join(projectDir, assetPath), "utf8") : tag; });
const start = html.indexOf("var PHRASES_OLD");
const end = html.indexOf("var $ = function(id)");
if (start < 0 || end < 0 || end <= start) {
  console.error("Extraction markers not found in index.html");
  process.exit(1);
}
const coreSrc = html.slice(start, end);
const mod = { exports: {} };
new Function("module", "exports", coreSrc +
  "\nmodule.exports = { analyze, CONTOH_MANUSIA, CONTOH_AI, CONTOH_PARAFRASE, CONTOH_GEMINI };"
)(mod, mod.exports);
const { analyze } = mod.exports;

function band(s) { return s >= 0.65 ? "TINGGI" : s >= 0.35 ? "SEDANG" : "RENDAH"; }

/* --- 1. regression guard: the 4 built-in calibration samples ---
 * (The 5th sample, REFLEKSI — a generic bureaucratic reflection text —
 *  was removed from the site on 2026-11-20 at the owner's request;
 *  the built-in calibration set is now 4 samples.) */
const regression = [
  ["MANUSIA", mod.exports.CONTOH_MANUSIA, 0.0859, "RENDAH"],
  ["AI", mod.exports.CONTOH_AI, 0.7714, "TINGGI"],
  ["PARAFRASE", mod.exports.CONTOH_PARAFRASE, 0.3582, "SEDANG"],
  ["GEMINI", mod.exports.CONTOH_GEMINI, 0.6693, "TINGGI"],
];
console.log("== Regression (4 built-in calibration samples) ==");
let regOk = true;
for (const [name, text, expected, wantBand] of regression) {
  const r = analyze(text);
  const b = band(r.final);
  const ok = b === wantBand;
  if (!ok) regOk = false;
  console.log(
    name.padEnd(10),
    "score=" + r.final.toFixed(4),
    "expected~" + expected,
    "band=" + b,
    ok ? "OK" : "FAIL (want " + wantBand + ")"
  );
}
console.log(regOk ? "REGRESSION OK\n" : "REGRESSION FAILED\n");

/* --- 2. benchmark samples --- */
const CATEGORIES = {
  hf: "human-formal",
  ai: "ai-formal",
  ap: "ai-paraphrase",
  hp: "human-personal",
};
const samplesDir = path.join(__dirname, "samples");
const files = fs.readdirSync(samplesDir).filter((f) => f.endsWith(".txt")).sort();
const rows = [];
for (const f of files) {
  const prefix = f.split("-")[0];
  const cat = CATEGORIES[prefix];
  if (!cat) { console.warn("skip (unknown prefix):", f); continue; }
  const text = fs.readFileSync(path.join(samplesDir, f), "utf8");
  const r = analyze(text);
  rows.push({ file: f, cat, words: r.words, score: r.final, band: band(r.final),
    burst: r.burst, vocab: r.vocab, phrase: r.phraseGlobal, stylo: r.stylo,
    md: r.markdown, sym: r.symmetry, rep: r.repetition, hits: r.totalHits, density: r.density });
}

console.log("== Benchmark samples ==");
console.log("| file | category | words | score | band |");
console.log("|---|---|---:|---:|---|");
for (const r of rows) {
  console.log(`| ${r.file} | ${r.cat} | ${r.words} | ${r.score.toFixed(4)} | ${r.band} |`);
}

console.log("\n== Per-category summary ==");
const byCat = {};
for (const r of rows) (byCat[r.cat] = byCat[r.cat] || []).push(r);
for (const [cat, rs] of Object.entries(byCat)) {
  const scores = rs.map((r) => r.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(
    cat.padEnd(16),
    "n=" + rs.length,
    "mean=" + mean.toFixed(4),
    "range=" + Math.min(...scores).toFixed(4) + ".." + Math.max(...scores).toFixed(4),
    "bands: RENDAH=" + rs.filter((r) => r.band === "RENDAH").length,
    "SEDANG=" + rs.filter((r) => r.band === "SEDANG").length,
    "TINGGI=" + rs.filter((r) => r.band === "TINGGI").length
  );
}

/* FP/FN at the site's verdict bands.
 * Human ground truth = human-formal + human-personal (n=9).
 * AI ground truth    = ai-formal (n=5). ai-paraphrase is reported separately:
 * the site's own example copy expects paraphrased AI in the middle band. */
const human = rows.filter((r) => r.cat === "human-formal" || r.cat === "human-personal");
const aiFormal = rows.filter((r) => r.cat === "ai-formal");
const aiPara = rows.filter((r) => r.cat === "ai-paraphrase");
const fpAny = human.filter((r) => r.score >= 0.35).length;   // flagged at all
const fpHigh = human.filter((r) => r.score >= 0.65).length;  // flagged as high
const fnMiss = aiFormal.filter((r) => r.score < 0.35).length;  // scored as human
const fnNotHigh = aiFormal.filter((r) => r.score < 0.65).length; // not in high band
console.log("\n== FP / FN (site verdict bands) ==");
console.log(`False positives (human, n=${human.length}): >=0.35 flagged ${fpAny}/${human.length} (${(100 * fpAny / human.length).toFixed(1)}%), >=0.65 high ${fpHigh}/${human.length} (${(100 * fpHigh / human.length).toFixed(1)}%)`);
console.log(`False negatives (ai-formal, n=${aiFormal.length}): <0.35 missed ${fnMiss}/${aiFormal.length} (${(100 * fnMiss / aiFormal.length).toFixed(1)}%), <0.65 not-high ${fnNotHigh}/${aiFormal.length} (${(100 * fnNotHigh / aiFormal.length).toFixed(1)}%)`);
console.log(`ai-paraphrase (n=${aiPara.length}): RENDAH=${aiPara.filter((r) => r.band === "RENDAH").length} SEDANG=${aiPara.filter((r) => r.band === "SEDANG").length} TINGGI=${aiPara.filter((r) => r.band === "TINGGI").length}`);

console.log("\n== Per-sample signal detail (JSON) ==");
console.log(JSON.stringify(rows, null, 1));
