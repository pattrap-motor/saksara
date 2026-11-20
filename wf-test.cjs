/* Phase 3 — Node tests for the Writing Forensic core (extracted from index.html). */
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
const coreRaw = html.split("WF-CORE-START")[1].split("/* WF-CORE-END */")[0];
const core = coreRaw.slice(coreRaw.indexOf("*/") + 2);
const contohM = grab(/var CONTOH_MANUSIA = "[\s\S]*?";/, "CONTOH_MANUSIA");
const contohA = grab(/var CONTOH_AI = "[\s\S]*?";/, "CONTOH_AI");

const sandbox = {};
new Function("sandbox", helpers + "\n" + core + "\n" + contohM + "\n" + contohA +
  "\nsandbox.wfAnalyze = wfAnalyze; sandbox.CONTOH_MANUSIA = CONTOH_MANUSIA; sandbox.CONTOH_AI = CONTOH_AI;")(sandbox);
const wfAnalyze = sandbox.wfAnalyze;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}

console.log("1) Input kosong / tidak valid");
check("empty string -> empty", wfAnalyze("").empty === true);
check("spaces only -> empty", wfAnalyze("   \n\n  ").empty === true);
check("symbols only -> empty", wfAnalyze("!!! ??? ... ---").empty === true);
check("numbers only -> not empty, no content words", (() => { const s = wfAnalyze("123 456 789 123"); return !s.empty && s.topContent.length === 0; })());

console.log("2) Teks pendek");
const short = "Kemarin saya pergi ke pasar membeli sayur dan buah untuk makan malam bersama keluarga di rumah nenek yang hangat.";
const ss = wfAnalyze(short);
check("short flagged", ss.shortText === true, ss.words);
check("short words counted", ss.words >= 15 && ss.words <= 25, ss.words);
check("short sents = 1", ss.sents === 1, ss.sents);

console.log("3) Teks repetitif ekstrem");
const rep = Array(20).fill("Teknologi digital membantu siswa belajar dengan cepat dan mudah setiap hari.").join(" ");
const rs = wfAnalyze(rep);
check("repetitive TTR very low", rs.ttr < 0.15, rs.ttr);
check("repetitive lensCv ~ 0", rs.lensCv < 0.01, rs.lensCv);
check("repetitive 4-grams found", rs.topGrams.length > 0 && rs.topGrams[0].c >= 10, rs.topGrams[0]);
check("repetitive top content words all tie at 20x", rs.topContent[0].c === 20 && rs.topContent.every(c => c.c === 20), rs.topContent[0]);

console.log("4) Contoh bawaan: manusia vs AI generik");
const hm = wfAnalyze(sandbox.CONTOH_MANUSIA), ai = wfAnalyze(sandbox.CONTOH_AI);
check("manusia words ~ 300", hm.words > 250 && hm.words < 400, hm.words);
check("AI transitions denser than manusia", ai.transPer100 > hm.transPer100, { ai: ai.transPer100, hm: hm.transPer100 });
check("manusia TTR window > AI TTR window", hm.ttrWin > ai.ttrWin, { hm: hm.ttrWin, ai: ai.ttrWin });
check("AI has repeated 4-grams, manusia fewer", ai.topGrams.length >= hm.topGrams.length, { ai: ai.topGrams.length, hm: hm.topGrams.length });
console.log("   [info] manusia: TTR", hm.ttr.toFixed(3), "CV", hm.lensCv.toFixed(2), "| AI: TTR", ai.ttr.toFixed(3), "CV", ai.lensCv.toFixed(2));

console.log("5) Kalimat sangat panjang");
const longSent = Array(3).fill(Array(60).fill("kata").map((w, i) => w + i % 7).join(" ")).join(". ") + ".";
const ls = wfAnalyze(longSent);
check("3 long sentences", ls.sents === 3, ls.sents);
check("longSentPct = 100%", Math.abs(ls.longSentPct - 1) < 1e-9, ls.longSentPct);
check("mean length ~60", ls.lensMean > 55 && ls.lensMean < 65, ls.lensMean);

console.log("6) Banyak paragraf + konsistensi");
const paras = [];
for (let i = 0; i < 10; i++) {
  const s = [];
  if (i === 9) { for (let j = 0; j < 8; j++) s.push("Pendek saja sekarang."); } // 24 words, avgLen 3 -> outlier
  else { for (let j = 0; j < 6; j++) s.push("Kalimat contoh nomor " + j + " pada paragraf " + i + " ini sengaja dibuat cukup panjang agar memenuhi syarat minimal kata yang dibutuhkan untuk perbandingan antarparagraf."); }
  paras.push(s.join(" "));
}
const mp = wfAnalyze(paras.join("\n\n"));
check("10 paragraphs", mp.paras === 10, mp.paras);
check("style paras compared = 10", mp.cons.n === 10, mp.cons.n);
check("short-sentence paragraph flagged as outlier", mp.cons.outliers.length === 1 && mp.cons.outliers[0].idx === 10, mp.cons.outliers);
console.log("   [info] outliers:", JSON.stringify(mp.cons.outliers.map(o => o.idx)), "cvLen:", mp.cons.cvLen.toFixed(2));

console.log("7) Tanda baca tidak beraturan");
const wild = wfAnalyze("halo... apa kabar??? baik!! coba-coba ya; tunggu: jangan pergi... oke.");
check("no crash, words > 0", !wild.empty && wild.words > 5, wild.words);
check("sentences counted sanely (3-8)", wild.sents >= 3 && wild.sents <= 8, wild.sents);

console.log("8) Dokumen panjang 100.000 kata (timing)");
const vocab = "apel buku cerdas damai embun fajar guru hutan ikan jalan kopi lampu meja nasi ombak pintu quil raja sapi taman udara vista warna xenon yoga zaman berita sekolah kantor pasar sungai gunung desa kota".split(" ");
let big = [];
let seed = 42;
function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
while (big.join(" ").split(" ").length < 100000) {
  const s = [];
  const len = 8 + rnd(14);
  for (let i = 0; i < len; i++) s.push(vocab[rnd(vocab.length)]);
  big.push(s.join(" ") + ".");
  if (big.length % 25 === 0) big.push("\n\n");
}
const bigText = big.join(" ");
const t0 = Date.now();
const bs = wfAnalyze(bigText);
const dt = Date.now() - t0;
check("100k words counted", bs.words >= 99000 && bs.words <= 101000, bs.words);
check("timing < 2000 ms", dt < 2000, dt + "ms");
console.log("   [info] wfAnalyze(100k words) took", dt, "ms; sents:", bs.sents, "paras:", bs.paras, "unique:", bs.unique);

console.log("\nWF TESTS:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
