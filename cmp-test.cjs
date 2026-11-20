/* Phase 4 — Node tests for the Compare Writing diff core (extracted from index.html). */
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
const wfRaw = html.split("WF-CORE-START")[1].split("/* WF-CORE-END */")[0];
const wfCore = wfRaw.slice(wfRaw.indexOf("*/") + 2);
const cmpRaw = html.split("CMP-CORE-START")[1].split("/* CMP-CORE-END */")[0];
const cmpCore = cmpRaw.slice(cmpRaw.indexOf("*/") + 2);

const sandbox = {};
new Function("sandbox", helpers + "\n" + wfCore + "\n" + cmpCore +
  "\nsandbox.cmpDiff = cmpDiff;")(sandbox);
const cmpDiff = sandbox.cmpDiff;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}

const A = "Pemerintah desa mengumumkan jadwal baru untuk pelayanan administrasi warga.\n\nKegiatan gotong royong akan dilaksanakan pada hari Minggu pagi di balai desa. Seluruh warga diharapkan membawa peralatan masing-masing dari rumah.";
const Bpar = "Panitia juga menyiapkan konsumsi untuk peserta yang hadir sejak pagi hari.";

console.log("1) Dokumen identik");
const r1 = cmpDiff(A, A);
check("similarity = 1", r1.similarity === 1, r1.similarity);
check("identical flag", r1.identical === true);
check("no changes", r1.wAdd === 0 && r1.wDel === 0 && r1.wChg === 0 && r1.pMoved === 0);

console.log("2) Beda satu kata");
const r2 = cmpDiff(A, A.replace("baru", "terbaru"));
check("wChg = 1", r2.wChg === 1, r2);
check("no add/del words", r2.wAdd === 0 && r2.wDel === 0, r2);
check("sChg = 1", r2.sChg === 1, r2.sChg);
check("similarity = 2*29/60 ~ 0.967", r2.similarity > 0.96 && r2.similarity < 0.975, r2.similarity);

console.log("3) Paragraf tambahan di B");
const r3 = cmpDiff(A, A + "\n\n" + Bpar);
check("pAdd = 1", r3.pAdd === 1, r3.pAdd);
check("sAdd = 1", r3.sAdd === 1, r3.sAdd);
check("wAdd = words of new paragraph", r3.wAdd === 11, r3.wAdd);
check("similarity < 1 but > 0.8", r3.similarity < 1 && r3.similarity > 0.8, r3.similarity);

console.log("4) Penghapusan (kebalikan #3)");
const r4 = cmpDiff(A + "\n\n" + Bpar, A);
check("pDel = 1", r4.pDel === 1, r4.pDel);
check("wDel = 11", r4.wDel === 11, r4.wDel);

console.log("5) Beda tanda baca / kapitalisasi / spasi saja");
const r5 = cmpDiff(A, A.toUpperCase().replace(/\./g, "!").replace(/\n\n/g, "\n\n\n"));
check("token-identical", r5.identical === true, r5);
check("surfaceOnly flagged", r5.surfaceOnly === true, r5.surfaceOnly);
check("similarity = 1", r5.similarity === 1, r5.similarity);

console.log("6) Urutan paragraf berubah");
const parts = A.split("\n\n");
const r6 = cmpDiff(A, parts[1] + "\n\n" + parts[0]);
check("pMoved >= 1", r6.pMoved >= 1, r6.pMoved);
check("similarity still 1 (content-based)", r6.similarity === 1, r6.similarity);
check("no word changes", r6.wAdd === 0 && r6.wDel === 0 && r6.wChg === 0, r6);

console.log("7) Satu sisi kosong (inti tidak crash)");
const r7 = cmpDiff("", A);
check("all of B counted as added", r7.pAdd === 2 && r7.wordsB > 0, r7);
check("similarity = 0", r7.similarity === 0, r7.similarity);

console.log("8) Kalimat tambahan di tengah paragraf");
const A8 = "Kalimat pertama tetap sama. Kalimat kedua juga tetap.";
const B8 = "Kalimat pertama tetap sama. Kalimat sisipan benar-benar baru muncul. Kalimat kedua juga tetap.";
const r8 = cmpDiff(A8, B8);
check("sAdd = 1, pAdd = 0", r8.sAdd === 1 && r8.pAdd === 0, r8);

console.log("9) Dokumen sangat berbeda");
const r9 = cmpDiff("Kucing tidur di atas tikar hangat sepanjang sore hari.", "Roket meluncur menuju orbit membawa satelit komunikasi baru.");
check("similarity low", r9.similarity < 0.25, r9.similarity);

console.log("10) Pasangan kalimat raksasa -> ringkasan multiset");
const big1 = Array.from({ length: 1100 }, (_, i) => "kata" + (i % 50)).join(" ") + ".";
const big2 = Array.from({ length: 1100 }, (_, i) => "kata" + ((i + 1) % 50)).join(" ") + ".";
const r10 = cmpDiff(big1, big2);
check("summarizedPairs >= 1", r10.summarizedPairs >= 1, r10.summarizedPairs);
check("no crash, similarity computed", r10.similarity >= 0 && r10.similarity <= 1, r10.similarity);

console.log("11) Dokumen besar 100rb kata dengan suntingan tersebar (timing)");
const vocab = "apel buku cerdas damai embun fajar guru hutan ikan jalan kopi lampu meja nasi ombak pintu raja sapi taman udara warna yoga zaman berita sekolah kantor pasar sungai gunung desa kota warga".split(" ");
let seed = 7;
function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
function makeDoc(editEvery) {
  const paras = [];
  let words = 0, sentCount = 0;
  while (words < 100000) {
    const sents = [];
    for (let s = 0; s < 6; s++) {
      const len = 10 + rnd(10), ws = [];
      for (let i = 0; i < len; i++) ws.push(vocab[rnd(vocab.length)]);
      sentCount++;
      ws.push("s" + sentCount); // unique per-sentence marker: keeps sentences/paragraphs unique so alignment is exact
      if (editEvery && sentCount % editEvery === 0) ws[3] = "suntingan";
      sents.push(ws.join(" ") + ".");
      words += len;
    }
    paras.push(sents.join(" "));
  }
  return paras.join("\n\n");
}
seed = 7; const docA = makeDoc(0);
seed = 7; const docB = makeDoc(97);
const t0 = Date.now();
const r11 = cmpDiff(docA, docB);
const dt = Date.now() - t0;
check("~100k words each", r11.wordsA > 99000 && r11.wordsB > 99000, { a: r11.wordsA, b: r11.wordsB });
check("edits detected (wChg > 50)", r11.wChg > 50, r11.wChg);
check("changed sentences ~1/97 of total (40-130)", r11.sChg >= 40 && r11.sChg <= 130, r11.sChg);
check("similarity > 0.995 but < 1", r11.similarity > 0.995 && r11.similarity < 1, r11.similarity);
check("timing < 5000 ms", dt < 5000, dt + "ms");
console.log("   [info] cmpDiff(100k vs 100k) took", dt, "ms; changed words:", r11.wChg, "; changed sentences:", r11.sChg);

console.log("\nCMP TESTS:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
