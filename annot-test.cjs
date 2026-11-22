/* D8 Tahap 1 — Node tests for ANNOT-CORE (extracted from index.html).
   Keempat blok murni (WI-CORE, DI-CORE, REPORT-CORE, ANNOT-CORE)
   diekstrak dan dimuat dalam SATU sandbox — meniru scope <script>
   tunggal halaman, tempat builder memanggil wiSentences,
   diReportCategoryForKind, diPdfEachChar/diPdfCpInRanges,
   diBlockText/diSyncModel/diMapAll apa adanya. */
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

const sandbox = {};
new Function("sandbox",
  wiCore + "\n" + diCore + "\n" + repCore + "\n" + annotCore +
  "\nsandbox.wiAnalyze = wiAnalyze; sandbox.wiApply = wiApply; sandbox.wiSentences = wiSentences;" +
  " sandbox.diBlockText = diBlockText; sandbox.diAssembleText = diAssembleText;" +
  " sandbox.diSyncModel = diSyncModel; sandbox.diMapAll = diMapAll;" +
  " sandbox.annotBuildReport = annotBuildReport;" +
  " sandbox.ANNOT_MANUAL_REVIEW_LABEL = ANNOT_MANUAL_REVIEW_LABEL;")(sandbox);
const { wiAnalyze, wiApply, wiSentences, diBlockText, diAssembleText,
  diSyncModel, diMapAll, annotBuildReport, ANNOT_MANUAL_REVIEW_LABEL } = sandbox;

/* Cakupan font subset yang benar-benar terbangun (rentang codepoint) —
   bentuk yang sama dengan yang dikonsumsi diPdfPreflight. */
function loadCoverage(){
  const candidates = [
    path.join(__dirname, "fonts", "noto-sans-coverage.json"),
    path.join(__dirname, "..", "docintel-work", "fonts", "noto-sans-coverage.json"),
    path.join(__dirname, "..", "uiux-integration-work", "suite", "fonts", "noto-sans-coverage.json")
  ];
  for (const c of candidates){
    if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, "utf8")).coverage;
  }
  throw new Error("noto-sans-coverage.json tidak ditemukan");
}
const COVERAGE = loadCoverage();

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}
function byKind(model, kind){ return model.findings.filter(f => f.kind === kind); }
function sugByKind(analysis, kind){ return analysis.suggestions.filter(s => s.kind === kind); }
/* Invarian global: setiap penanda menunjuk irisan yang persis sama
   dengan `original` temuan bernomor itu, dan kalimat memuat rentang. */
function invariantMarks(model){
  for (const rb of model.renderBlocks){
    for (const mk of rb.marks){
      const f = model.findings[mk.no - 1];
      if (!f || f.no !== mk.no) return "penanda tanpa temuan: " + mk.no;
      if (rb.text.slice(mk.start, mk.end) !== f.original) return "irisan penanda != original temuan " + mk.no;
      if (mk.advisory !== f.advisory) return "flag penasihat penanda != temuan " + mk.no;
    }
  }
  for (const f of model.findings){
    if (f.sentenceText.slice(f.rangeInSentence.start, f.rangeInSentence.end) !== f.original)
      return "rangeInSentence != original temuan " + f.no;
    if (f.no !== model.findings.indexOf(f) + 1) return "penomoran tidak urut pada " + f.no;
  }
  return null;
}

/* ============ 1. Penomoran urutan dokumen + penanda (tempel) ============ */
console.log("Grup 1 — penomoran & penanda mode tempel");
{
  const text = "Penelitian ini dilakukan untuk menganalisa data yang diperoleh.\n\nHasil hasil penelitian dicatat dengan rapi.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, {});
  check("jumlah temuan == jumlah saran", m.findings.length === a.suggestions.length, m.findings.length);
  check("nomor urut dokumen 1..N", m.findings.every((f, i) => f.no === i + 1 && f.id === a.suggestions[i].id));
  check("paragraf temuan benar", m.findings[0].paragraphNo === 1 && m.findings[m.findings.length - 1].paragraphNo === 2);
  check("sumber mode paste", m.source.mode === "paste" && m.source.fileName === null);
  check("renderBlocks == paragraf analisis", m.renderBlocks.length === a.paragraphs.length);
  const inv = invariantMarks(m);
  check("invarian penanda/kalimat", inv === null, inv);
  check("anchor tempel = paragraph", m.findings.every(f => f.anchor.type === "paragraph"));
  check("mapStatus tempel null", m.findings.every(f => f.mapStatus === null));
}

/* ============ 2. Derivasi kalimat: singkatan, desimal, tanda tanya ============ */
console.log("Grup 2 — derivasi kalimat penampung");
{
  const a1 = wiAnalyze("Penelitian ini dipimpin Dr. Sari. Ia menganalisa data kemarin.");
  const m1 = annotBuildReport(a1, {});
  const f1 = byKind(m1, "kata-tidak-baku")[0];
  check("singkatan Dr. tidak memisah kalimat", f1 && f1.sentenceText === "Ia menganalisa data kemarin.", f1 && f1.sentenceText);

  const a2 = wiAnalyze("Harga naik menjadi Rp5.000 per unit. Peneliti menganalisa data itu.");
  const m2 = annotBuildReport(a2, {});
  const f2 = byKind(m2, "kata-tidak-baku")[0];
  check("desimal Rp5.000 tidak memisah kalimat", f2 && f2.sentenceText === "Peneliti menganalisa data itu.", f2 && f2.sentenceText);

  const a3 = wiAnalyze("Peneliti menganalisa biaya Rp5.000 itu dengan cermat.");
  const m3 = annotBuildReport(a3, {});
  const f3 = byKind(m3, "kata-tidak-baku")[0];
  check("desimal di tengah kalimat tidak memecah kalimat temuan", f3 && f3.sentenceText === "Peneliti menganalisa biaya Rp5.000 itu dengan cermat.", f3 && f3.sentenceText);

  const a4 = wiAnalyze("Apakah data sudah lengkap? Tim menganalisa data besok.");
  const m4 = annotBuildReport(a4, {});
  const f4 = byKind(m4, "kata-tidak-baku")[0];
  check("batas tanda tanya dihormati", f4 && f4.sentenceText === "Tim menganalisa data besok.", f4 && f4.sentenceText);

  const spans = wiSentences("Harga naik menjadi Rp5.000 per unit. Peneliti menganalisa data itu.");
  check("wiSentences: 2 span pada fixture desimal", spans.length === 2, spans);
}

/* ============ 3. Komposisi usulan kalimat lengkap (kelas i) ============ */
console.log("Grup 3 — komposisi usulan");
{
  const cases = [
    ["Penelitian ini dilakukan untuk menganalisa data yang diperoleh.", "kata-tidak-baku",
     "Penelitian ini dilakukan untuk menganalisis data yang diperoleh."],
    ["Menganalisa data adalah langkah awal penelitian.", "kata-tidak-baku",
     "Menganalisis data adalah langkah awal penelitian."],
    ["Data  dianalisis dengan teliti.", "double-space",
     "Data dianalisis dengan teliti."],
    ["Data dianalisis,kemudian disimpulkan dengan hati-hati.", "tanda-baca",
     "Data dianalisis, kemudian disimpulkan dengan hati-hati."],
    ["Data dianalisis.Kemudian disimpulkan dengan hati-hati.", "missing-space-after-punctuation",
     "Data dianalisis. Kemudian disimpulkan dengan hati-hati."],
    ["data dianalisis dengan teliti.", "sentence-capital",
     "Data dianalisis dengan teliti."],
    ["Hasil hasil penelitian dicatat dengan rapi.", "repeated-word",
     "Hasil penelitian dicatat dengan rapi."]
  ];
  cases.forEach(([text, kind, expected], ci) => {
    const a = wiAnalyze(text);
    const m = annotBuildReport(a, {});
    const f = byKind(m, kind)[0];
    check("komposisi " + kind, !!f && f.proposedSentence === expected, f && f.proposedSentence);
    check("bukan tinjau manual " + kind, !!f && f.manualReview === false);
    /* Silang wiApply: usulan == kalimat hasil penerapan TUNGGAL temuan itu. */
    if (f){
      const applied = wiApply(a.paragraphs, a.suggestions, [f.id]);
      check("usulan == wiApply tunggal " + kind, applied[f.paragraphNo - 1] === f.proposedSentence, applied[f.paragraphNo - 1]);
    }
    void ci;
  });
  /* Temuan di awal kalimat: rangeInSentence.start == 0. */
  const a0 = wiAnalyze("Menganalisa data adalah langkah awal penelitian.");
  const f0 = byKind(annotBuildReport(a0, {}), "kata-tidak-baku")[0];
  check("temuan di awal kalimat: rangeInSentence.start == 0", !!f0 && f0.rangeInSentence.start === 0, f0 && f0.rangeInSentence);
}

/* ============ 4. Klasifikasi penasihat (kelas ii) → tinjau manual ============ */
console.log("Grup 4 — penasihat = Perlu ditinjau manual");
{
  check("label manual persis", ANNOT_MANUAL_REVIEW_LABEL === "Perlu ditinjau manual");
  const fixtures = [
    ["Penelitian ini menganalisa data lapangan yang dikumpulkan selama enam bulan penuh dari dua belas desa terpencil di wilayah pegunungan dengan bantuan tiga asisten lokal serta mencatat seluruh temuan harian ke dalam buku catatan besar untuk diperiksa kembali pada akhir masa penelitian.", "kalimat-panjang"],
    ["Ketika peneliti yang datang karena hujan yang deras akhirnya tiba di lokasi, ia segera mencatat bahwa data yang hilang kemarin perlu dicari kembali.", "kalimat-kompleks"],
    ["Hasil uji pertama menunjukkan pola dan hasil uji pertama dicatat ulang.", "kalimat-pengulangan-frasa"],
    ["Data ini dikumpulkan dari lapangan. Data ini dianalisis dengan teliti. Data ini disajikan dalam laporan.", "transisi-awalan"]
  ];
  fixtures.forEach(([text, kind]) => {
    const a = wiAnalyze(text);
    const m = annotBuildReport(a, {});
    const f = byKind(m, kind)[0];
    check("penasihat ada: " + kind, !!f, a.suggestions.map(s => s.kind));
    if (!f) return;
    check("manualReview " + kind, f.manualReview === true && f.advisory === true);
    check("tanpa kalimat karangan " + kind, f.proposedSentence === null);
    check("kalimat penasihat == original (kalimat lengkap) " + kind, f.sentenceText === f.original);
  });
}

/* ============ 5. Dua temuan satu kalimat: komposisi mandiri ============ */
console.log("Grup 5 — multi-temuan satu kalimat");
{
  const a = wiAnalyze("Penelitian ini menganalisa data  dengan teliti.");
  const m = annotBuildReport(a, {});
  const fBaku = byKind(m, "kata-tidak-baku")[0];
  const fSpace = byKind(m, "double-space")[0];
  check("dua temuan ditemukan", !!fBaku && !!fSpace, a.suggestions.map(s => s.kind));
  if (fBaku && fSpace){
    check("sharedSentence keduanya", fBaku.sharedSentence === true && fSpace.sharedSentence === true);
    check("usulan baku hanya memperbaiki baku", fBaku.proposedSentence === "Penelitian ini menganalisis data  dengan teliti.", fBaku.proposedSentence);
    check("usulan spasi hanya memperbaiki spasi", fSpace.proposedSentence === "Penelitian ini menganalisa data dengan teliti.", fSpace.proposedSentence);
    check("kalimat asli sama", fBaku.sentenceText === fSpace.sentenceText);
  }
  const single = annotBuildReport(wiAnalyze("Penelitian ini dilakukan untuk menganalisa data yang diperoleh."), {});
  check("satu temuan: sharedSentence false", byKind(single, "kata-tidak-baku")[0].sharedSentence === false);
}

/* ============ 6. Tumpang-tindih penasihat ⊃ mekanis ============ */
console.log("Grup 6 — penasihat memuat temuan mekanis");
{
  const text = "Penelitian ini menganalisa data lapangan yang dikumpulkan selama enam bulan penuh dari dua belas desa terpencil di wilayah pegunungan dengan bantuan tiga asisten lokal serta mencatat seluruh temuan harian ke dalam buku catatan besar untuk diperiksa kembali pada akhir masa penelitian.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, {});
  const adv = byKind(m, "kalimat-panjang")[0];
  const mek = byKind(m, "kata-tidak-baku")[0];
  check("penasihat + mekanis sama-sama ada", !!adv && !!mek, a.suggestions.map(s => s.kind));
  if (adv && mek){
    check("penasihat manual, mekanis berusulan", adv.manualReview === true && mek.manualReview === false && typeof mek.proposedSentence === "string");
    check("kalimat penampung sama", adv.sentenceText === mek.sentenceText);
    const rb = m.renderBlocks[0];
    check("kedua penanda pada blok yang sama", rb.marks.length === 2 && rb.marks.some(x => x.advisory) && rb.marks.some(x => !x.advisory), rb.marks);
    const inv = invariantMarks(m);
    check("invarian penanda tumpang-tindih", inv === null, inv);
  }
}

/* ============ 7. Keadaan keputusan (D-3) + label/kategori ============ */
console.log("Grup 7 — state & label");
{
  const a = wiAnalyze("Penelitian ini menganalisa data  dengan teliti.");
  const idBaku = sugByKind(a, "kata-tidak-baku")[0].id;
  const idSpace = sugByKind(a, "double-space")[0].id;
  const m = annotBuildReport(a, { acceptedIds: [idBaku], rejectedIds: [idSpace],
    kindLabels: { "kata-tidak-baku": "Kata tidak baku" }, certLabels: { "pasti": "Aturan pasti" } });
  const fBaku = byKind(m, "kata-tidak-baku")[0], fSpace = byKind(m, "double-space")[0];
  check("state accepted", fBaku.state === "accepted", fBaku.state);
  check("state rejected", fSpace.state === "rejected", fSpace.state);
  check("semua temuan tetap tampil (D-3)", m.findings.length === 2);
  check("kindLabel dari extras", fBaku.kindLabel === "Kata tidak baku", fBaku.kindLabel);
  check("kategori baku = Ejaan", fBaku.category === "Ejaan", fBaku.category);
  check("kategori double-space = Tanda baca & spasi", fSpace.category === "Tanda baca & spasi", fSpace.category);
  check("kategori repeated-word = Redundansi",
    byKind(annotBuildReport(wiAnalyze("Hasil hasil penelitian dicatat dengan rapi."), {}), "repeated-word")[0].category === "Redundansi");
  check("kategori transisi = Kalimat",
    byKind(annotBuildReport(wiAnalyze("Data ini dikumpulkan dari lapangan. Data ini dianalisis dengan teliti. Data ini disajikan dalam laporan."), {}), "transisi-awalan")[0].category === "Kalimat");
  const mRaw = annotBuildReport(a, {});
  check("tanpa extras label: kindLabel == kind", byKind(mRaw, "kata-tidak-baku")[0].kindLabel === "kata-tidak-baku");
  /* Penasihat yang ditolak berstatus "read" (semantik diBuildReport). */
  const aP = wiAnalyze("Penelitian ini menganalisa data lapangan yang dikumpulkan selama enam bulan penuh dari dua belas desa terpencil di wilayah pegunungan dengan bantuan tiga asisten lokal serta mencatat seluruh temuan harian ke dalam buku catatan besar untuk diperiksa kembali pada akhir masa penelitian.");
  const idAdv = sugByKind(aP, "kalimat-panjang")[0].id;
  const mP = annotBuildReport(aP, { rejectedIds: [idAdv] });
  check("penasihat ditolak -> state read", byKind(mP, "kalimat-panjang")[0].state === "read");
  check("total ringkas konsisten", m.totals.findings === 2 && m.totals.withProposal === 2 && m.totals.manualReview === 0 && m.totals.anchored === 2);
}

/* ============ 8. Inventaris karakter di luar subset (D-1) ============ */
console.log("Grup 8 — inventaris D-1");
{
  const text = "Data 😀 dicatat 😀 lagi.\n\nNama 漢字 dicatat apa adanya.\n\nData é — lengkap.";
  const a = wiAnalyze(text);
  const m = annotBuildReport(a, { coverage: COVERAGE });
  const u0 = m.renderBlocks[0].unsupported || [];
  const u1 = m.renderBlocks[1].unsupported || [];
  const u2 = m.renderBlocks[2].unsupported || [];
  check("emoji terinventaris U+1F600 x2", u0.length === 1 && u0[0].cp === "U+1F600" && u0[0].count === 2, u0);
  check("CJK terinventaris", u1.length === 2 && u1.some(e => e.cp === "U+6F22") && u1.some(e => e.cp === "U+5B57"), u1);
  check("Latin-1 + em-dash TIDAK terinventaris", Array.isArray(u2) && u2.length === 0, u2);
  check("roll-up dokumen", !!m.unsupported && m.unsupported.length === 3 &&
    m.unsupported.find(e => e.cp === "U+1F600").count === 2, m.unsupported);
  const mNo = annotBuildReport(a, {});
  check("tanpa coverage: inventaris null", mNo.renderBlocks[0].unsupported === null && mNo.unsupported === null);
}

/* ============ 9. Mode dokumen DOCX: blok, segmen, tabel, terlindungi ============ */
console.log("Grup 9 — mode dokumen (model tangan)");
function buildDocxModel(){
  const blocks = [
    { id: "b0", type: "heading", level: 1, runs: [{ text: "Bab Satu Pendahuluan" }] },
    { id: "b1", type: "paragraph", runs: [{ text: "Penelitian ini dilakukan untuk " }, { text: "menganalisa", bold: true }, { text: " data yang diperoleh." }] },
    { id: "b2", type: "paragraph", runs: [{ text: "Tim menganal" }, { text: "isa data kedua dengan rapi." }] },
    { id: "b3", type: "list-item", listKind: "bullet", level: 0, runs: [{ text: "Data dikumpulkan setiap hari." }] },
    { id: "b4", type: "table-cell", table: 0, r: 0, c: 0, cellPara: 0, runs: [{ text: "Nilai menganalisa ulang." }] },
    { id: "b5", type: "paragraph", runs: [{ text: "Rumus" }, { text: "E=mc2", protected: true, kind: "omml" }, { text: " dipakai dalam perhitungan." }] }
  ];
  return { format: "docx", blocks: blocks, tables: [{ rows: 1, cols: 1 }] };
}
{
  const model = buildDocxModel();
  const asm = diAssembleText(model);
  const a = wiAnalyze(asm.text);
  const m = annotBuildReport(a, { doc: { name: "uji.docx", model: model } });
  check("mode docx + nama berkas", m.source.mode === "docx" && m.source.fileName === "uji.docx");
  check("renderBlocks == blok model", m.renderBlocks.length === 6, m.renderBlocks.length);
  check("heading: type + level", m.renderBlocks[0].type === "heading" && m.renderBlocks[0].level === 1);
  check("list-item: listKind", m.renderBlocks[3].listKind === "bullet");
  check("table-cell: tableRef", !!m.renderBlocks[4].tableRef && m.renderBlocks[4].tableRef.table === 0 && m.renderBlocks[4].tableRef.r === 0 && m.renderBlocks[4].tableRef.c === 0, m.renderBlocks[4].tableRef);
  const segB5 = m.renderBlocks[5].segments;
  check("teks blok menyingkirkan run terlindungi", m.renderBlocks[5].text === "Rumus dipakai dalam perhitungan.", m.renderBlocks[5].text);
  check("segmen terlindungi nol-lebar pada posisi 5", segB5.length === 3 && segB5[1].protected === true && segB5[1].start === 5 && segB5[1].end === 5 && segB5[1].kind === "omml", segB5);
  check("segmen bold terbawa", m.renderBlocks[1].segments.some(sg => sg.bold === true && m.renderBlocks[1].text.slice(sg.start, sg.end) === "menganalisa"));
  const fB1 = m.findings.find(f => f.anchor.blockId === "b1");
  check("temuan b1 applicable + berpenanda", !!fB1 && fB1.mapStatus === "applicable" && m.renderBlocks[1].marks.some(x => x.no === fB1.no), fB1 && fB1.mapStatus);
  const fB2 = m.findings.find(f => f.anchor.blockId === "b2");
  check("temuan lintas-run: readonly TETAP berjangkar blok", !!fB2 && fB2.mapStatus === "readonly" && m.renderBlocks[2].marks.some(x => x.no === fB2.no), fB2 && fB2.mapStatus);
  const fB4 = m.findings.find(f => f.anchor.blockId === "b4");
  check("temuan di sel tabel berjangkar", !!fB4 && m.renderBlocks[4].marks.length === 1);
  const inv = invariantMarks(m);
  check("invarian penanda mode dokumen", inv === null, inv);
  /* Kontrak UI: sync+mapping yang dihitung lapisan UI == turunan builder. */
  const sync = diSyncModel(model, a.paragraphs);
  const mappedArr = diMapAll(model, sync, a.suggestions);
  const mapping = {};
  a.suggestions.forEach((s, i) => { mapping[s.id] = mappedArr[i]; });
  const m2 = annotBuildReport(a, { doc: { name: "uji.docx", model: model, sync: sync, mapping: mapping } });
  check("sync/mapping serahan UI == turunan builder", JSON.stringify(m2) === JSON.stringify(m));
}

/* ============ 10. Jangkar putus: paragraf disunting + text-mismatch ============ */
console.log("Grup 10 — jangkar putus");
{
  const model = buildDocxModel();
  const asm = diAssembleText(model);
  const editedText = asm.text.replace("data yang diperoleh.", "data yang terkumpul.");
  const a = wiAnalyze(editedText);
  const m = annotBuildReport(a, { doc: { name: "uji.docx", model: model } });
  const fEdited = m.findings.find(f => f.paragraphNo === 2);
  check("temuan paragraf suntingan tetap terdaftar", !!fEdited, m.findings.map(f => f.paragraphNo));
  check("anchor none + catatan", !!fEdited && fEdited.anchor.type === "none" && typeof fEdited.anchor.note === "string" && fEdited.anchor.note.length > 0, fEdited && fEdited.anchor);
  check("usulan tetap disusun dari teks teranalisis", !!fEdited && typeof fEdited.proposedSentence === "string" && fEdited.proposedSentence.indexOf("menganalisis") >= 0, fEdited && fEdited.proposedSentence);
  check("blok b1 tidak dianalisis & tanpa penanda temuan itu", m.renderBlocks[1].analyzed === false && !m.renderBlocks[1].marks.some(x => fEdited && x.no === fEdited.no));
  check("paragraf lain tetap berjangkar", m.findings.filter(f => f.paragraphNo !== 2).every(f => f.anchor.type === "block"));
  check("totals.unanchored >= 1", m.totals.unanchored >= 1, m.totals);

  /* text-mismatch lewat mapping serahan (paragraf matched, posisi tak dipercaya). */
  const a2 = wiAnalyze(asm.text);
  const target = sugByKind(a2, "kata-tidak-baku")[0];
  const fakeMapping = {};
  a2.suggestions.forEach(s => { fakeMapping[s.id] = { status: "applicable" }; });
  fakeMapping[target.id] = { status: "readonly", reason: "text-mismatch", reasonText: "teks dokumen pada posisi ini tidak sama dengan teks yang dianalisis" };
  const sync2 = diSyncModel(model, a2.paragraphs);
  const m3 = annotBuildReport(a2, { doc: { name: "uji.docx", model: model, sync: sync2, mapping: fakeMapping } });
  const fMis = m3.findings.find(f => f.id === target.id);
  check("text-mismatch: anchor none + note dari reasonText", !!fMis && fMis.anchor.type === "none" && fMis.anchor.note === "teks dokumen pada posisi ini tidak sama dengan teks yang dianalisis", fMis && fMis.anchor);
  check("text-mismatch: tanpa penanda", !m3.renderBlocks.some(rb => rb.marks.some(x => x.no === (fMis && fMis.no))));
}

/* ============ 11. Mode PDF: penanda halaman asal (D-8) ============ */
console.log("Grup 11 — mode pdf");
{
  const model = { format: "pdf", pages: 2, tables: [], blocks: [
    { id: "b0", type: "paragraph", page: 1, runs: [{ text: "Tim menganalisa data halaman satu." }] },
    { id: "b1", type: "paragraph", page: 2, runs: [{ text: "Data halaman dua bersih." }] }
  ] };
  const a = wiAnalyze(diAssembleText(model).text);
  const m = annotBuildReport(a, { doc: { name: "uji.pdf", model: model } });
  check("mode pdf", m.source.mode === "pdf");
  check("renderBlock membawa page", m.renderBlocks[0].page === 1 && m.renderBlocks[1].page === 2);
  const f = byKind(m, "kata-tidak-baku")[0];
  check("anchor membawa page asal", !!f && f.anchor.type === "block" && f.anchor.page === 1, f && f.anchor);
}

/* ============ 12. Dokumen bersih / kosong ============ */
console.log("Grup 12 — tanpa temuan");
{
  const mClean = annotBuildReport(wiAnalyze("Data dianalisis dengan teliti dan dicatat dengan rapi."), {});
  check("bersih: findings kosong", mClean.findings.length === 0 && mClean.totals.findings === 0);
  check("bersih: renderBlocks tetap ada tanpa penanda", mClean.renderBlocks.length === 1 && mClean.renderBlocks[0].marks.length === 0);
  const mEmpty = annotBuildReport(wiAnalyze(""), {});
  check("kosong: model terbangun, 0 temuan", !!mEmpty && mEmpty.findings.length === 0 && mEmpty.renderBlocks.length >= 1);
}

/* ============ 13. Amplop 50.000 karakter ============ */
console.log("Grup 13 — batas 50.000");
{
  const para = "Penelitian ini menganalisa data yang diperoleh dari lapangan.";
  const big = new Array(901).fill(para).join("\n\n");
  const a = wiAnalyze(big);
  check("analisis terpotong pada batas", a.truncated === true);
  const m = annotBuildReport(a, {});
  check("model terbangun pada amplop batas", m.source.analysisTruncated === true && m.findings.length > 500, m.findings.length);
  const inv = invariantMarks(m);
  check("invarian penanda pada dokumen besar", inv === null, inv);
  check("penomoran tetap urut", m.findings.every((f, i) => f.no === i + 1));
}

/* ============ 14. Kemurnian & determinisme ============ */
console.log("Grup 14 — kemurnian builder");
{
  const model = buildDocxModel();
  const a = wiAnalyze(diAssembleText(model).text);
  const extras = { doc: { name: "uji.docx", model: model }, coverage: COVERAGE, acceptedIds: [], rejectedIds: [] };
  const before = JSON.stringify({ a: a, e: extras });
  const m1 = annotBuildReport(a, extras);
  const after = JSON.stringify({ a: a, e: extras });
  check("masukan tidak diubah builder", before === after);
  const m2 = annotBuildReport(a, extras);
  check("dua pembangunan identik", JSON.stringify(m1) === JSON.stringify(m2));
}

console.log("\nHASIL annot-test: " + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
