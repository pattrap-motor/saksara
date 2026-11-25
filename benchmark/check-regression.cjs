#!/usr/bin/env node
/*
 * Saksara — regression gate (Phase 1).
 *
 * Extracts the heuristic core (Ensemble Heuristik v3) directly from
 * ../index.html — the exact code the site ships — and verifies it against
 * the Phase 0 golden baseline (baseline-phase0.json):
 *   1. the 4 built-in calibration samples reproduce their golden scores
 *      exactly (4 decimal places);
 *   2. all 18 benchmark samples reproduce their golden scores exactly;
 *   3. verdict invariants hold: every human sample < 0.35 (no false
 *      positive), every ai-formal sample >= 0.35 (none missed).
 *
 * Exit code 0 = PASS, 1 = FAIL. Used by .github/workflows/regression-gate.yml
 * and meant to be run locally before every publish:
 *   node benchmark/check-regression.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");

const projectDir = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(projectDir, "index.html"), "utf8");
/* Modular layout: inline the local assets referenced by index.html, in
 * document order, so extraction sees the same source the single-file
 * build shipped. */
const html = indexHtml.replace(/<(?:link|script)\b[^>]*\b(?:href|src)=["']([^"']+)["'][^>]*>(?:\s*<\/script>)?/gi, (tag, ref) => {
  const assetPath = ref.split(/[?#]/)[0].replace(/^\.?\//, "");
  if (!assetPath.startsWith("assets/")) return tag;
  return fs.readFileSync(path.join(projectDir, assetPath), "utf8");
});
const start = html.indexOf("var PHRASES_OLD");
const end = html.indexOf("var $ = function(id)");
if (start < 0 || end < 0 || end <= start) {
  console.error("FAIL: extraction markers not found in index.html");
  process.exit(1);
}
const coreSrc = html.slice(start, end);
const mod = { exports: {} };
new Function("module", "exports", coreSrc +
  "\nmodule.exports = { analyze, CONTOH_MANUSIA, CONTOH_AI, CONTOH_PARAFRASE, CONTOH_GEMINI };"
)(mod, mod.exports);
const { analyze } = mod.exports;

const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "baseline-phase0.json"), "utf8"));
const round4 = (x) => Math.round(x * 10000) / 10000;
let failures = 0;
function expectEq(label, actual, expected) {
  const a = round4(actual);
  if (a !== expected) {
    failures++;
    console.log(`FAIL ${label}: got ${a.toFixed(4)}, baseline ${expected.toFixed(4)}`);
  }
}

/* 1. calibration */
const calTexts = {
  MANUSIA: mod.exports.CONTOH_MANUSIA,
  AI: mod.exports.CONTOH_AI,
  PARAFRASE: mod.exports.CONTOH_PARAFRASE,
  GEMINI: mod.exports.CONTOH_GEMINI,
};
for (const [name, expected] of Object.entries(baseline.calibration)) {
  expectEq("calibration " + name, analyze(calTexts[name]).final, expected);
}
console.log("calibration: 4 samples checked");

/* 2 + 3. benchmark samples + invariants */
const samplesDir = path.join(__dirname, "samples");
let checked = 0;
for (const [file, expected] of Object.entries(baseline.samples)) {
  const text = fs.readFileSync(path.join(samplesDir, file), "utf8");
  const score = analyze(text).final;
  expectEq("sample " + file, score, expected);
  checked++;
  const prefix = file.split("-")[0];
  if ((prefix === "hf" || prefix === "hp") && score >= 0.35) {
    failures++;
    console.log(`FAIL invariant: human sample ${file} scores ${score.toFixed(4)} >= 0.35 (false positive)`);
  }
  if (prefix === "ai" && score < 0.35) {
    failures++;
    console.log(`FAIL invariant: ai-formal sample ${file} scores ${score.toFixed(4)} < 0.35 (missed)`);
  }
}
console.log(`samples: ${checked} checked against baseline`);

if (failures) {
  console.log(`\nREGRESSION GATE: FAIL (${failures} failure${failures === 1 ? "" : "s"}) — do not publish.`);
  process.exit(1);
}
console.log("\nREGRESSION GATE: PASS — engine output identical to the Phase 0 baseline.");
