/* D8 Tahap 2 — Node tests for ANNOT-PDF-CORE (extracted from index.html).
   Mesin tata letak murni annotPdfLayout diuji dengan fungsi measure
   STUB yang deterministik (lebar per codepoint tetap): geometri
   rencana — rect sorotan, garis penasihat, nomor superskrip — dapat
   diverifikasi PERSIS terhadap geometri fragmen teks yang digambar
   dari lintasan yang sama (syarat C-2). Verifikasi tingkat glif pada
   PDF nyata (font tertanam + jsPDF) dilakukan rig peramban d8-qa. */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
function extract(startMarker, endMarker){
  const raw = html.split(startMarker)[1].split(endMarker)[0];
  return raw.slice(raw.indexOf("*/") + 2);
}
const wiCore = extract("WI-CORE-START", "/* WI-CORE-END */");
const diCore = extract("DI-CORE-START", "/* DI-CORE-END */");
const repCore = extract("REPORT-CORE-START", "/* REPORT-CORE-END */");
const annotCore = extract("ANNOT-CORE-START", "/* ANNOT-CORE-END */");
const annotPdfCore = extract("ANNOT-PDF-CORE-START", "/* ANNOT-PDF-CORE-END */");

const sandbox = {};
new Function("sandbox",
  wiCore + "\n" + diCore + "\n" + repCore + "\n" + annotCore + "\n" + annotPdfCore +
  "\nsandbox.wiAnalyze = wiAnalyze; sandbox.annotBuildReport = annotBuildReport;" +
  " sandbox.annotPdfLayout = annotPdfLayout; sandbox.annotPdfSubstitute = annotPdfSubstitute;" +
  " sandbox.annotPdfDisclosure = annotPdfDisclosure; sandbox.annotPdfFileName = annotPdfFileName;" +
  " sandbox.ANNOT_PDF_PLACEHOLDER = ANNOT_PDF_PLACEHOLDER;")(sandbox);
const { wiAnalyze, annotBuildReport, annotPdfLayout, annotPdfSubstitute,
  annotPdfDisclosure, annotPdfFileName, ANNOT_PDF_PLACEHOLDER } = sandbox;

function loadCoverage(){
  const candidates = [
    path.join(__dirname, "fonts", "noto-sans-coverage.json"),
    path.join(__dirname, "..", "docintel-work", "fonts", "noto-sans-coverage.json")
  ];
  for (const c of candidates) if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, "utf8")).coverage;
  throw new Error("noto-sans-coverage.json tidak ditemukan");
}
const COVERAGE = loadCoverage();

/* Measure stub deterministik: lebar mm per codepoint. */
function stubMeasure(text, style){
  let w = 0;
  for (const ch of String(text)){
    const cp = ch.codePointAt(0);
    const base = cp === 0x20 ? 0.30 : cp === 0x09 ? 0.60 : (cp > 0x2000 ? 1.05 : 0.55);
    w += base * style.size * 0.3528 * (style.bold ? 1.06 : 1);
  }
  return w;
}
const LABELS = {
  kindLabels: { "kata-tidak-baku": "Kata tidak baku", "repeated-word": "Kata berulang",
    "kalimat-panjang": "Kalimat panjang", "tanda-baca": "Tanda baca" },
  certLabels: { "pasti": "Aturan pasti", "saran": "Saran", "potensial": "Masalah potensial", "gaya": "Saran gaya" },
  stateLabels: { accepted: "Diterima", pending: "Menunggu keputusan", rejected: "Ditolak", read: "Sudah dibaca" }
};
function layout(model, extra){
  return annotPdfLayout(model, Object.assign({
    measure: stubMeasure, coverage: null, dateStr: "22 November 2026",
    stateLabels: LABELS.stateLabels, recommendations: ["Periksa temuan bernomor besar."],
    limitations: ["Keterbatasan contoh."]
  }, extra || {}));
}

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra).slice(0, 300)); }
}
const EPS = 1e-6;
/* Lebar op teks menurut measure yang sama dengan mesin. */
function opW(op){ return stubMeasure(op.text, { size: op.size, bold: op.bold }); }
/* Untuk satu (block, mark): kumpulkan, per halaman+baris (dikelompokkan
   oleh y teks), interval-x fragmen teks yang src-nya di dalam rentang
   mark, dan interval-x rect sorotannya. Keduanya harus sama persis. */
function markGeometry(plan, blockKey, mark){
  const frags = [], rects = [];
  plan.pages.forEach((pg, pi) => {
    pg.forEach(op => {
      if (op.op === "text" && op.src && op.src.block === blockKey && op.src.start >= mark.start && op.src.end <= mark.end)
        frags.push({ page: pi, y: op.y, x0: op.x, x1: op.x + opW(op) });
      if (op.op === "rect" && op.block === blockKey && op.mark === mark.no && op.kind === "hl")
        rects.push({ page: pi, y: op.y, x0: op.x, x1: op.x + op.w });
    });
  });
  return { frags, rects };
}
function sameIntervals(a, b){
  if (a.length !== b.length) return false;
  const key = i => i.page + "|" + Math.round(i.y * 1000) + "|" + Math.round(i.x0 * 1000) + "|" + Math.round(i.x1 * 1000);
  const sa = a.map(key).sort(), sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}
/* Rect memakai y = baseline - sizeMm*0.80; samakan bidang perbandingan:
   geser rect ke baseline fragmen (sizeMm blok dokumen 10.5pt). */
function rectsAsBaselines(rects, sizeMm){
  return rects.map(r => ({ page: r.page, y: r.y + sizeMm * 0.80, x0: r.x0, x1: r.x1 }));
}
const SMM105 = 10.5 * 25.4 / 72;

/* ============ 1. Nama berkas D-9 + substitusi murni ============ */
console.log("Grup 1 — nama berkas + substitusi");
check("nama berkas D-9", annotPdfFileName(new Date(2026, 10, 22)) === "saksara-laporan-anotasi-2026-11-22.pdf", annotPdfFileName(new Date(2026, 10, 22)));
check("substitusi emoji -> penanda", annotPdfSubstitute("a\u{1F600}b", COVERAGE) === "a" + ANNOT_PDF_PLACEHOLDER + "b");
check("substitusi CJK -> penanda", annotPdfSubstitute("\u6F22\u5B57", COVERAGE) === ANNOT_PDF_PLACEHOLDER + ANNOT_PDF_PLACEHOLDER);
check("karakter tercakup utuh (é, —, ✓)", annotPdfSubstitute("café \u2014 \u2713", COVERAGE) === "café \u2014 \u2713");
check("tanpa coverage = identitas", annotPdfSubstitute("a\u{1F600}b", null) === "a\u{1F600}b");
check("whitespace tata letak dipertahankan", annotPdfSubstitute("a\nb\tc", COVERAGE) === "a\nb\tc");

/* ============ 2. Geometri sorotan mode tempel (C-2) ============ */
console.log("Grup 2 — geometri sorotan persis (mode tempel)");
{
  const text = "Penelitian ini dilakukan untuk menganalisa data yang diperoleh dari lapangan.\n\nHasil hasil penelitian dicatat dengan sangat rapi oleh tim.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  const plan = layout(m);
  check("rencana punya >= 1 halaman", plan.pageCount >= 1);
  check("kepala laporan tercetak", plan.pages[0].some(o => o.op === "text" && o.text === "LAPORAN ANOTASI TULISAN"));
  let allOk = true, detail = "";
  m.renderBlocks.forEach(rb => {
    rb.marks.forEach(mk => {
      if (mk.advisory) return;
      const g = markGeometry(plan, rb.key, mk);
      if (!g.rects.length){ allOk = false; detail = "tanpa rect: temuan " + mk.no; return; }
      if (!sameIntervals(g.frags, rectsAsBaselines(g.rects, SMM105))){ allOk = false; detail = "interval beda: temuan " + mk.no; }
    });
  });
  check("setiap rect sorotan == geometri fragmen glifnya", allOk, detail);
  /* Nomor: tepat satu per penanda berjangkar, di x fragmen pertama, di atas baseline. */
  let numOk = true;
  m.renderBlocks.forEach(rb => {
    rb.marks.forEach(mk => {
      const nums = [];
      plan.pages.forEach(pg => pg.forEach(o => { if (o.op === "num" && o.block === rb.key && o.mark === mk.no) nums.push(o); }));
      if (nums.length !== 1) numOk = false;
    });
  });
  check("tepat satu nomor superskrip per penanda", numOk);
  /* Urutan teks Bagian A mereproduksi teks blok persis. */
  let textOk = true;
  m.renderBlocks.forEach(rb => {
    const joined = [];
    plan.pages.forEach(pg => pg.forEach(o => { if (o.op === "text" && o.src && o.src.block === rb.key) joined.push(o); }));
    joined.sort((p, q) => p.src.start - q.src.start);
    if (joined.map(o => o.text).join("") !== rb.text) textOk = false;
  });
  check("teks tercetak Bagian A == teks teranalisis, utuh", textOk);
}

/* ============ 3. Rentang lintas halaman ============ */
console.log("Grup 3 — lintas baris/halaman");
{
  /* Satu kalimat sangat panjang (±700 kata) dengan satu kata tidak baku
     di tengah: penanda penasihat kalimat-panjang merentang lintas halaman. */
  const words = [];
  for (let i = 0; i < 700; i++) words.push(i === 350 ? "menganalisa" : "kata" + (i % 37));
  const text = "Penelitian " + words.join(" ") + " selesai.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  const plan = layout(m);
  check("dokumen panjang menjadi multi-halaman", plan.pageCount >= 3, plan.pageCount);
  const adv = m.findings.find(f => f.advisory);
  check("ada temuan penasihat kalimat panjang", !!adv, m.findings.map(f => f.kind));
  if (adv){
    const pagesWithAdv = new Set();
    plan.pages.forEach((pg, pi) => pg.forEach(o => { if (o.op === "line" && o.mark === adv.no && o.dash) pagesWithAdv.add(pi); }));
    check("garis titik penasihat terbelah lintas halaman (>= 2)", pagesWithAdv.size >= 2, [...pagesWithAdv]);
    const nums = [];
    plan.pages.forEach(pg => pg.forEach(o => { if (o.op === "num" && o.mark === adv.no) nums.push(o); }));
    check("nomor penasihat hanya pada fragmen pertama", nums.length === 1, nums.length);
  }
  const mech = m.findings.find(f => !f.advisory);
  if (mech){
    const rb = m.renderBlocks[0];
    const mk = rb.marks.find(x => x.no === mech.no);
    const g = markGeometry(plan, rb.key, mk);
    check("sorotan mekanis di dalam kalimat lintas halaman tetap persis", g.rects.length >= 1 && sameIntervals(g.frags, rectsAsBaselines(g.rects, SMM105)));
  }
}

/* ============ 4. Multi-temuan satu kalimat + usulan ============ */
console.log("Grup 4 — multi-temuan + rentang usulan");
{
  const text = "Tim menganalisa  data lapangan dengan sangat teliti.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  check("dua temuan pada satu kalimat", m.findings.length === 2 && m.findings.every(f => f.sharedSentence), m.findings.map(f => f.kind));
  const plan = layout(m);
  let propOk = true, detail = "";
  m.findings.forEach(f => {
    if (f.proposedSentence == null){ propOk = false; detail = "usulan null"; return; }
    const rs = f.rangeInSentence.start;
    const rl = f.proposedSentence.length - (f.sentenceText.length - (f.rangeInSentence.end - f.rangeInSentence.start));
    const key = "f" + f.no + "-usulan";
    const frags = [], rects = [];
    plan.pages.forEach((pg, pi) => pg.forEach(o => {
      if (o.op === "text" && o.src && o.src.block === key && o.src.start >= rs && o.src.end <= rs + rl)
        frags.push({ page: pi, y: o.y, x0: o.x, x1: o.x + opW(o) });
      if (o.op === "rect" && o.block === key && o.kind === "proposal")
        rects.push({ page: pi, y: o.y, x0: o.x, x1: o.x + o.w });
    }));
    if (!rects.length || !sameIntervals(frags, rectsAsBaselines(rects, SMM105))){ propOk = false; detail = "usulan temuan " + f.no; }
  });
  check("rect usulan == rentang pengganti pada kalimat usulan", propOk, detail);
  const allText = plan.pages.flat().filter(o => o.op === "text").map(o => o.text).join(" ");
  check("catatan kalimat berbagi tercetak", allText.includes("kalimat ini memuat temuan lain"));
}

/* ============ 5. Dokumen penasihat saja ============ */
console.log("Grup 5 — penasihat saja");
{
  const vocab = "Penelitian membahas pengaruh metode pembelajaran daring terhadap motivasi belajar mahasiswa semester awal program studi pendidikan bahasa indonesia fakultas keguruan ilmu universitas negeri contoh selama masa transisi kurikulum baru berlangsung penuh tantangan adaptasi teknologi evaluasi berkala melalui angket wawancara observasi kelas dokumentasi nilai ujian tengah akhir semester ganjil tahun akademik berjalan".split(" ");
  const text = vocab.join(" ") + " tuntas.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  check("semua temuan manualReview", m.findings.length >= 1 && m.findings.every(f => f.manualReview), m.findings.map(f => f.kind));
  const plan = layout(m);
  const allText = plan.pages.flat().filter(o => o.op === "text").map(o => o.text).join(" ");
  check("label 'Perlu ditinjau manual' tercetak", allText.includes("Perlu ditinjau manual"));
  check("tidak ada rect usulan", !plan.pages.flat().some(o => o.op === "rect" && o.kind === "proposal"));
  check("tidak ada rect sorotan untuk penasihat", !plan.pages.flat().some(o => o.op === "rect" && o.kind === "hl" && o.block === m.renderBlocks[0].key));
  check("ada garis titik penasihat", plan.pages.flat().some(o => o.op === "line" && o.dash && o.mark != null));
}

/* ============ 6. Kebijakan D-1 pada rencana ============ */
console.log("Grup 6 — D-1 placeholder + pengungkapan");
{
  const text = "Penelitian ini menganalisa data \u{1F600} dengan teliti sekali.\n\nTim menulis \u6F22\u5B57 dan simbol \u{1F600} lagi di sini.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, Object.assign({}, LABELS, { coverage: COVERAGE }));
  check("inventaris model menangkap emoji + CJK", !!m.unsupported && m.unsupported.length === 3, m.unsupported);
  const disc = annotPdfDisclosure(m);
  check("pengungkapan terhitung (emoji x2, 2 CJK)", !!disc && disc.total === 4, disc && disc.total);
  const plan = layout(m, { coverage: COVERAGE });
  const allText = plan.pages.flat().filter(o => o.op === "text").map(o => o.text).join("");
  check("tidak ada emoji/CJK mentah pada rencana", !allText.includes("\u{1F600}") && !allText.includes("\u6F22") && !allText.includes("\u5B57"));
  check("penanda tercetak pada rencana", allText.includes(ANNOT_PDF_PLACEHOLDER));
  check("pengungkapan tercetak menyebut codepoint", allText.includes("U+1F600") && allText.includes("U+6F22"));
  check("kalimat sisi temuan ikut tersubstitusi", (() => {
    const sent = plan.pages.flat().filter(o => o.op === "text" && o.src && o.src.block === "f1-kal");
    return sent.length > 0 && sent.map(o => o.text).join("").includes(ANNOT_PDF_PLACEHOLDER);
  })());
  /* Jalur tanpa coverage: tidak ada substitusi (fallback diatur lem). */
  const planFb = layout(m);
  const fbText = planFb.pages.flat().filter(o => o.op === "text").map(o => o.text).join("");
  check("tanpa coverage: teks mentah dipertahankan", fbText.includes("\u{1F600}"));
  check("tanpa coverage: tidak ada pengungkapan", planFb.disclosure === null);
}

/* ============ 7. Jangkar putus ============ */
console.log("Grup 7 — jangkar putus tanpa penanda semu");
{
  /* Model dokumen tangan: paragraf kedua disunting sesudah analisis. */
  const model = { format: "docx", blocks: [
    { id: "b0", type: "paragraph", runs: [{ text: "Penelitian ini menganalisa data." }] },
    { id: "b1", type: "paragraph", runs: [{ text: "Paragraf kedua versi suntingan." }] }
  ]};
  const analysis = wiAnalyze("Penelitian ini menganalisa data.\n\nParagraf kedua menganalisa ulang.");
  const m = annotBuildReport(analysis, Object.assign({}, LABELS, { doc: { name: "uji.docx", model } }));
  const broken = m.findings.find(f => f.anchor.type === "none");
  check("ada temuan berjangkar putus", !!broken, m.findings.map(f => f.anchor.type));
  const plan = layout(m);
  if (broken){
    check("tidak ada nomor untuk temuan putus", !plan.pages.flat().some(o => o.op === "num" && o.mark === broken.no));
    check("tidak ada rect Bagian A untuk temuan putus", !plan.pages.flat().some(o => o.op === "rect" && o.mark === broken.no && o.block === "b1"));
    const allText = plan.pages.flat().filter(o => o.op === "text").map(o => o.text).join(" ").replace(/\s+/g, " ");
    check("catatan jangkar putus tercetak di Bagian B", allText.includes(broken.anchor.note.replace(/\s+/g, " ")), broken.anchor.note);
  }
}

/* ============ 8. Nol temuan ============ */
console.log("Grup 8 — dokumen bersih");
{
  const text = "Penelitian ini menganalisis data dengan teliti. Hasilnya dicatat dengan rapi.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  check("model tanpa temuan", m.findings.length === 0, m.findings.length);
  const plan = layout(m);
  check("tidak ada op penanda", !plan.pages.flat().some(o => (o.op === "rect" || o.op === "num") && o.mark != null));
  const allText = plan.pages.flat().filter(o => o.op === "text").map(o => o.text).join(" ");
  check("redaksi jujur nol temuan tercetak", allText.includes("Tidak ditemukan saran untuk teks ini."));
  check("dokumen tetap dirender utuh", (() => { const ops = []; plan.pages.forEach(pg => pg.forEach(o => { if (o.op === "text" && o.src) ops.push(o); })); ops.sort((p, q) => p.src.start - q.src.start); return ops.map(o => o.text).join("") === text; })());
}

/* ============ 9. Tabel + keping terlindungi ============ */
console.log("Grup 9 — tabel DOCX + keping terlindungi");
{
  const model = { format: "docx", blocks: [
    { id: "b0", type: "heading", level: 1, runs: [{ text: "Bab Satu" }] },
    { id: "b1", type: "paragraph", runs: [{ text: "Rumus berikut " }, { text: "x", protected: true, kind: "omml", xml: "<m:oMath/>" }, { text: " penting." }] },
    { id: "b2", type: "table-cell", table: 0, r: 0, c: 0, cellPara: 0, runs: [{ text: "Sel menganalisa data" }] },
    { id: "b3", type: "table-cell", table: 0, r: 0, c: 1, cellPara: 0, runs: [{ text: "Sel kedua bersih" }] },
    { id: "b4", type: "table-cell", table: 0, r: 1, c: 0, cellPara: 0, runs: [{ text: "Baris kedua" }] },
    { id: "b5", type: "table-cell", table: 0, r: 1, c: 1, cellPara: 0, runs: [{ text: "Sel terakhir" }] }
  ]};
  const asm = sandbox.diAssembleText ? null : null;
  const analysis = wiAnalyze("Bab Satu\n\nRumus berikut  penting.\n\nSel menganalisa data\n\nSel kedua bersih\n\nBaris kedua\n\nSel terakhir");
  const m = annotBuildReport(analysis, Object.assign({}, LABELS, { doc: { name: "tabel.docx", model } }));
  const plan = layout(m);
  const allOps = plan.pages.flat();
  check("bingkai sel tabel digambar (rects)", allOps.filter(o => o.op === "rects").length >= 4, allOps.filter(o => o.op === "rects").length);
  check("keping terlindungi tercetak jujur", allOps.some(o => o.op === "text" && o.text.includes("[rumus \u2014 tidak dianalisis]")));
  const cellFinding = m.findings.find(f => f.anchor && f.anchor.blockId === "b2");
  check("temuan di dalam sel berjangkar ke sel", !!cellFinding, m.findings.map(f => [f.kind, f.anchor]));
  if (cellFinding){
    const mk = m.renderBlocks.find(rb => rb.key === "b2").marks.find(x => x.no === cellFinding.no);
    const g = markGeometry(plan, "b2", mk);
    const colW = 178 / 2;
    check("rect sel menutupi fragmennya di dalam kolom sel", g.rects.length >= 1 && g.rects.every(r => r.x0 >= 16 - EPS && r.x1 <= 16 + colW + EPS), g.rects);
  }
}

/* ============ 10. Amplop 50.000 karakter + determinisme ============ */
console.log("Grup 10 — amplop besar + determinisme");
{
  const para = "Penelitian ini menganalisa data yang diperoleh dari hasil hasil wawancara mendalam. ";
  let text = "";
  while (text.length < 49000) text += para + "\n\n";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, LABELS);
  const t0 = Date.now();
  const plan = layout(m);
  const dt = Date.now() - t0;
  check("tata letak dokumen ±50rb karakter selesai", plan.pageCount > 5, plan.pageCount + " halaman, " + dt + " ms");
  let allAnchored = true, nRect = 0, nNum = 0;
  m.renderBlocks.forEach(rb => rb.marks.forEach(mk => {
    if (mk.advisory) return;
    const rs = plan.pages.flat().filter(o => o.op === "rect" && o.block === rb.key && o.mark === mk.no);
    const ns = plan.pages.flat().filter(o => o.op === "num" && o.block === rb.key && o.mark === mk.no);
    nRect += rs.length; nNum += ns.length;
    if (!rs.length || ns.length !== 1) allAnchored = false;
  }));
  check("seluruh penanda besar punya rect + tepat satu nomor", allAnchored, { nRect, nNum, marks: m.renderBlocks.reduce((s, rb) => s + rb.marks.length, 0) });
  const plan2 = layout(m);
  check("deterministik: dua tata letak identik", JSON.stringify(plan.pages) === JSON.stringify(plan2.pages));
  /* Lebar baris tidak pernah melampaui lebar konten. */
  let overflow = 0;
  plan.pages.forEach(pg => pg.forEach(o => { if (o.op === "text" && o.x + opW(o) > 194.5) overflow++; }));
  check("tidak ada teks melampaui margin kanan", overflow === 0, overflow);
}

console.log("\nannot-pdf-test: " + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
