/* Phase 6 — Node tests for the PROD-CORE pure functions in index.html
   (batch validation, OCR aggregation, history sanitization, batch summary).
   Run: node prod-test.cjs */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const a = html.indexOf("/* PROD-CORE-START");
const b = html.indexOf("/* PROD-CORE-END */");
if (a < 0 || b < 0) { console.error("PROD-CORE markers missing"); process.exit(1); }
eval(html.slice(a, b + "/* PROD-CORE-END */".length));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL:", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

/* ---------- p6ValidateBatch ---------- */
{
  const small = Array.from({ length: 3 }, (_, i) => ({ name: "f" + i + ".txt", size: 1000 }));
  const v = p6ValidateBatch(small);
  check("3 small files accepted", v.accepted.length === 3 && v.rejected.length === 0, v);
  check("total bytes summed", v.totalBytes === 3000, v.totalBytes);
}
{
  const many = Array.from({ length: 55 }, (_, i) => ({ name: "f" + i + ".txt", size: 10 }));
  const v = p6ValidateBatch(many);
  check("55 files -> 50 accepted, 5 rejected", v.accepted.length === 50 && v.rejected.length === 5, { a: v.accepted.length, r: v.rejected.length });
  check("over-cap reason mentions 50", /50 berkas/.test(v.rejected[0].reason), v.rejected[0]);
}
{
  const big = [{ name: "big.pdf", size: 21 * 1024 * 1024 }, { name: "ok.txt", size: 5 }];
  const v = p6ValidateBatch(big);
  check("21MB file rejected, small accepted", v.accepted.length === 1 && v.rejected.length === 1 && /20 MB/.test(v.rejected[0].reason), v);
}
{
  const tot = Array.from({ length: 6 }, (_, i) => ({ name: "t" + i + ".pdf", size: 19 * 1024 * 1024 }));
  const v = p6ValidateBatch(tot); // 5*19=95MB ok, 6th exceeds 100MB
  check("total cap: 5 accepted, 6th rejected", v.accepted.length === 5 && v.rejected.length === 1 && /100 MB/.test(v.rejected[0].reason), { a: v.accepted.length, r: v.rejected });
}
check("empty batch validates empty", (() => { const v = p6ValidateBatch([]); return v.accepted.length === 0 && v.totalBytes === 0; })());

/* ---------- p6OcrAggregate ---------- */
{
  const agg = p6OcrAggregate([{ confidence: 90, words: 100 }, { confidence: 50, words: 100 }]);
  check("word-weighted mean = 70", agg.meanConfidence === 70, agg);
  check("low page flagged (page 2)", agg.lowPages.length === 1 && agg.lowPages[0] === 2, agg);
  check("total words", agg.totalWords === 200, agg);
}
{
  const agg = p6OcrAggregate([{ confidence: 0, words: 0 }, { confidence: 80, words: 10 }]);
  check("empty page listed, mean from words only", agg.emptyPages.length === 1 && agg.emptyPages[0] === 1 && agg.meanConfidence === 80, agg);
}
{
  const agg = p6OcrAggregate([]);
  check("no pages -> mean 0, no crash", agg.meanConfidence === 0 && agg.totalWords === 0, agg);
}

/* ---------- p6SanitizeEntry ---------- */
{
  const e = p6SanitizeEntry({ ts: 1, kind: "detector", title: "t", summary: {}, text: "hello" }, false);
  check("no text consent -> text null", e.text === null && e.textTruncated === false, e);
}
{
  const e = p6SanitizeEntry({ ts: 1, kind: "detector", title: "t", summary: {}, text: "hello" }, true);
  check("text consent -> text kept", e.text === "hello", e);
}
{
  const long = "x".repeat(250000);
  const e = p6SanitizeEntry({ ts: 1, kind: "detector", title: "t", summary: {}, text: long }, true);
  check("long text truncated at 200k + flagged", e.text.length === 200000 && e.textTruncated === true, { len: e.text.length, tr: e.textTruncated });
}

/* ---------- p6BatchSummary ---------- */
{
  const rows = [
    { name: "a", score: 0.10, error: null }, { name: "b", score: 0.50, error: null },
    { name: "c", score: 0.90, error: null }, { name: "d", score: null, error: "x" },
  ];
  const s = p6BatchSummary(rows);
  check("summary counts", s.total === 4 && s.ok === 3 && s.err === 1, s);
  check("bands 1/1/1", s.bands.RENDAH === 1 && s.bands.SEDANG === 1 && s.bands.TINGGI === 1, s.bands);
  check("mean = 0.5", Math.abs(s.mean - 0.5) < 1e-9, s.mean);
  check("median = 0.5", Math.abs(s.median - 0.5) < 1e-9, s.median);
}
{
  const s = p6BatchSummary([]);
  check("empty summary -> null mean/median", s.mean === null && s.median === null && s.total === 0, s);
}
{
  const s = p6BatchSummary([{ name: "x", score: 0.35, error: null }, { name: "y", score: 0.65, error: null }]);
  check("band edges: 0.35 and 0.65 are SEDANG", s.bands.SEDANG === 2 && s.bands.RENDAH === 0 && s.bands.TINGGI === 0, s.bands);
}

console.log("PROD TESTS: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
