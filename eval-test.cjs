/* Phase 5 — tests for the Benchmark Center metric core (extracted from index.html).
 * Covers: known confusion outcomes, metric formulas, division by zero, empty set,
 * single class, imbalance (macro vs weighted), the production blend gate, live-set
 * consistency against the Phase 0 golden baseline, classifier outcomes on the
 * embedded provenanced scores, and a fast duplication/leakage spot-check
 * (full audit: audit-dataset.cjs — 0 duplicates, 0 cluster violations, 0 overlap). */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function slice(a, b) { const s = html.indexOf(a), e = html.indexOf(b); if (s < 0 || e < 0) throw new Error("markers missing: " + a); return html.slice(s, e); }
const coreMod = { exports: {} };
new Function("module", "exports", slice("/* EVAL-CORE-START */", "/* EVAL-CORE-END */") +
  "\nmodule.exports = { bnMetrics, bnBlend, bnSide };")(coreMod, coreMod.exports);
const { bnMetrics, bnBlend } = coreMod.exports;

const dataMod = { exports: {} };
new Function("module", "exports", slice("var BN_SAMPLES", "var BN_CATNAME") +
  "\nmodule.exports = { BN_SAMPLES, BN_V0 };")(dataMod, dataMod.exports);
const { BN_SAMPLES, BN_V0 } = dataMod.exports;

const engMod = { exports: {} };
new Function("module", "exports", html.slice(html.indexOf("var PHRASES_OLD"), html.indexOf("var $ = function(id)")) +
  "\nmodule.exports = { analyze };")(engMod, engMod.exports);
const analyze = engMod.exports.analyze;

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.log("FAIL:", name); } }
function approx(a, b) { return a !== null && Math.abs(a - b) < 1e-9; }

/* 1. Known confusion outcome: scores [ai .9, ai .2, human .8, human .1] @0.35 */
{
  const items = [
    { label: "ai", score: 0.9 }, { label: "ai", score: 0.2 },
    { label: "human", score: 0.8 }, { label: "human", score: 0.1 },
  ];
  const m = bnMetrics(items, 0.35);
  t("known TP/TN/FP/FN", m.TP === 1 && m.FN === 1 && m.FP === 1 && m.TN === 1);
  t("known accuracy .5", approx(m.accuracy, 0.5));
  t("known precision .5", approx(m.precision, 0.5));
  t("known recall .5", approx(m.recall, 0.5));
  t("known f1 .5", approx(m.f1, 0.5));
  t("known fpr .5", approx(m.fpr, 0.5));
  t("known fnr .5", approx(m.fnr, 0.5));
  t("known specificity .5", approx(m.specificity, 0.5));
}
/* 2. Perfect + perfectly wrong */
{
  const ok = bnMetrics([{ label: "ai", score: 0.9 }, { label: "human", score: 0.1 }], 0.35);
  t("perfect accuracy 1", ok.accuracy === 1 && ok.f1 === 1 && ok.fpr === 0);
  const bad = bnMetrics([{ label: "ai", score: 0.1 }, { label: "human", score: 0.9 }], 0.35);
  t("wrong accuracy 0", bad.accuracy === 0 && bad.recall === 0 && bad.fpr === 1);
}
/* 3. Division by zero: no AI items -> recall/FNR undefined, NOT 0 */
{
  const m = bnMetrics([{ label: "human", score: 0.1 }, { label: "human", score: 0.9 }], 0.35);
  t("no-AI recall null", m.recall === null);
  t("no-AI fnr null", m.fnr === null);
  t("no-AI f1 null", m.f1 === null);
  t("no-AI fpr defined", approx(m.fpr, 0.5));
  t("no-AI precision 0 (TP=0, FP=1)", m.precision === 0);
}
/* 4. Empty dataset */
{
  const m = bnMetrics([], 0.35);
  t("empty n=0", m.n === 0);
  t("empty accuracy null", m.accuracy === null);
  t("empty macroF1 null", m.macroF1 === null);
}
/* 5. Single class (only AI) */
{
  const m = bnMetrics([{ label: "ai", score: 0.9 }, { label: "ai", score: 0.8 }], 0.35);
  t("only-AI specificity null", m.specificity === null);
  t("only-AI fpr null", m.fpr === null);
  t("only-AI recall 1", m.recall === 1);
}
/* 6. Imbalance: accuracy hides a weak minority class; macro vs weighted F1 */
{
  const items = [];
  for (let i = 0; i < 90; i++) items.push({ label: "human", score: 0.1 });       // TN x90
  for (let i = 0; i < 10; i++) items.push({ label: "ai", score: 0.1 });          // FN x10
  const m = bnMetrics(items, 0.35);
  t("imbalance accuracy .9 despite recall 0", approx(m.accuracy, 0.9) && m.recall === 0);
  t("imbalance macroF1 null (AI precision undefined: TP+FP=0)", m.macroF1 === null);
  const items2 = [];
  for (let i = 0; i < 80; i++) items2.push({ label: "human", score: 0.1 });      // TN x80
  for (let i = 0; i < 10; i++) items2.push({ label: "human", score: 0.9 });      // FP x10
  for (let i = 0; i < 5; i++) items2.push({ label: "ai", score: 0.9 });          // TP x5
  for (let i = 0; i < 5; i++) items2.push({ label: "ai", score: 0.1 });          // FN x5
  const m2 = bnMetrics(items2, 0.35);
  t("imbalance2 AI F1 = 0.4", approx(m2.f1, 0.4));
  t("imbalance2 weightedF1 > macroF1", m2.weightedF1 !== null && m2.macroF1 !== null && m2.weightedF1 > m2.macroF1);
}
/* 7. Blend gate: below 0.35 the classifier cannot move the score */
{
  t("blend gated below .35", bnBlend(0.2960, 1.0) === 0.2960);
  t("blend raises above .35", approx(bnBlend(0.674, 1.0), 0.674 + 0.326 * 0.5));
  t("blend with clf 0 = identity", approx(bnBlend(0.5, 0), 0.5));
}
/* 8. Live-set consistency: production analyze() reproduces the golden baseline */
{
  t("18 samples embedded", BN_SAMPLES.length === 18);
  let allGolden = true;
  const items = BN_SAMPLES.map(s => {
    const sc = analyze(s.text).final;
    if (Math.round(sc * 10000) / 10000 !== s.golden) allGolden = false;
    return { label: s.label, score: sc };
  });
  t("all 18 scores identical to Phase 0 baseline", allGolden);
  const m = bnMetrics(items, 0.35);
  t("live heur TP5 TN9 FP0 FN4", m.TP === 5 && m.TN === 9 && m.FP === 0 && m.FN === 4);
  t("live heur FPR 0", m.fpr === 0);
}
/* 9. Classifier (embedded provenanced scores) at illustrative 0.5 */
{
  const items = BN_SAMPLES.map(s => ({ label: s.label, score: s.clf }));
  const m = bnMetrics(items, 0.5);
  t("clf TP5 TN5 FP4 FN4", m.TP === 5 && m.TN === 5 && m.FP === 4 && m.FN === 4);
  const blend = BN_SAMPLES.map(s => ({ label: s.label, score: bnBlend(analyze(s.text).final, s.clf) }));
  const mb = bnMetrics(blend, 0.35);
  t("blend inherits heur safety on this set (FP 0)", mb.FP === 0 && mb.TP === 5 && mb.FN === 4);
}
/* 10. Embedded v0 aggregates are internally consistent */
{
  const s = BN_V0.sets.test.at035;
  t("v0 test counts sum", s.TP + s.TN + s.FP + s.FN === s.n && s.n === 2257);
  t("v0 external recall ~0.0302", Math.abs(BN_V0.sets.external.at035.recall - 0.0302) < 0.001);
  t("v0 stress has no AI (recall null in source metrics)", BN_V0.sets.stress.at035.FN === 0 && BN_V0.sets.stress.at035.TP === 0);
}
/* 11. Fast leakage spot-check: no test doc shares a 13-gram with any sample */
{
  function grams(text, n) {
    const w = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
    const set = new Set();
    for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(" "));
    return set;
  }
  const bench = new Set();
  BN_SAMPLES.forEach(s => grams(s.text, 13).forEach(g => bench.add(g)));
  const test = fs.readFileSync(path.join(__dirname, "../dataset/processed/test.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
  let hits = 0;
  test.forEach(r => { for (const g of grams(r.text, 13)) { if (bench.has(g)) { hits++; break; } } });
  t("test split shares 0 13-grams with the regression set", hits === 0);
}

console.log("EVAL TESTS: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
