/* D8 Tahap 3 — Node tests for FAITHFUL-CORE (extracted from index.html).
   Keenam blok murni (WI/DI/REPORT/ANNOT/ANNOT-PDF/FAITHFUL) diekstrak
   dan dimuat dalam SATU sandbox — meniru scope <script> tunggal
   halaman. Inflate disuntikkan dari zlib Node (di peramban bawaan
   DecompressionStream yang dipakai). */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
function extract(startMarker, endMarker){
  const raw = html.split(startMarker)[1].split(endMarker)[0];
  return raw.slice(raw.indexOf("*/") + 2);
}
const wiCore = extract("WI-CORE-START", "/* WI-CORE-END */");
const diCore = extract("DI-CORE-START", "/* DI-CORE-END */");
const repCore = extract("REPORT-CORE-START", "/* REPORT-CORE-END */");
const annotCore = extract("ANNOT-CORE-START", "/* ANNOT-CORE-END */");
const faithfulCore = extract("FAITHFUL-CORE-START", "/* FAITHFUL-CORE-END */");

const sandbox = {};
new Function("sandbox",
  wiCore + "\n" + diCore + "\n" + repCore + "\n" + annotCore + "\n" + faithfulCore +
  "\nsandbox.wiAnalyze = wiAnalyze;" +
  " sandbox.diParseDocx = diParseDocx; sandbox.diAssembleText = diAssembleText;" +
  " sandbox.diBlockText = diBlockText; sandbox.diParseXml = diParseXml;" +
  " sandbox.diPdfPagesToModel = diPdfPagesToModel; sandbox.diPdfTextStats = diPdfTextStats;" +
  " sandbox.annotBuildReport = annotBuildReport;" +
  " sandbox.diFaithfulZipEntries = diFaithfulZipEntries; sandbox.diFaithfulCrc32 = diFaithfulCrc32;" +
  " sandbox.diFaithfulZipWrite = diFaithfulZipWrite; sandbox.diFaithfulIncluded = diFaithfulIncluded;" +
  " sandbox.diFaithfulAppendix = diFaithfulAppendix; sandbox.diFaithfulAppendixLines = diFaithfulAppendixLines;" +
  " sandbox.diFaithfulFileName = diFaithfulFileName; sandbox.diFaithfulParaPlan = diFaithfulParaPlan;" +
  " sandbox.diFaithfulBlockSegments = diFaithfulBlockSegments;" +
  " sandbox.diFaithfulCollectParas = diFaithfulCollectParas; sandbox.diFaithfulParaText = diFaithfulParaText;" +
  " sandbox.diFaithfulDocxSurgery = diFaithfulDocxSurgery; sandbox.diFaithfulVerifyDocx = diFaithfulVerifyDocx;" +
  " sandbox.diFaithfulPdfGarble = diFaithfulPdfGarble; sandbox.diFaithfulPdfGeometry = diFaithfulPdfGeometry;" +
  " sandbox.diFaithfulRangeRects = diFaithfulRangeRects; sandbox.diFaithfulPdfPlan = diFaithfulPdfPlan;" +
  " sandbox.diFaithfulWinAnsiSafe = diFaithfulWinAnsiSafe; sandbox.diFaithfulWinAnsiSafeChar = diFaithfulWinAnsiSafeChar;")(sandbox);
const S = sandbox;
const inflateRaw = (data) => Promise.resolve(zlib.inflateRawSync(Buffer.from(data)));
const OPTS = { inflateRaw };

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra).slice(0, 300)); }
}

/* ---------- Pembangun fixture DOCX (ZIP stored/deflate, CRC benar) ---------- */
function zipWrite(entries){
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries){
    const name = Buffer.from(e.name, "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const method = e.deflate ? 8 : 0;
    const comp = e.deflate ? zlib.deflateRawSync(data, { level: 9 }) : data;
    const crc = S.diFaithfulCrc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(((2026 - 1980) << 9) | (1 << 5) | 1, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(((2026 - 1980) << 9) | (1 << 5) | 1, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
const CT_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:styles ' + W_NS + '><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
function docxFixture(documentXml, deflate){
  return zipWrite([
    { name: "[Content_Types].xml", data: CT_XML, deflate: !!deflate },
    { name: "word/document.xml", data: documentXml, deflate: !!deflate },
    { name: "word/styles.xml", data: STYLES_XML, deflate: !!deflate },
    { name: "docProps/core.xml", data: '<?xml version="1.0"?><cp:coreProperties><dc:title>Fixture</dc:title></cp:coreProperties>', deflate: false }
  ]);
}
function docXml(bodyInner){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document ' + W_NS + '><w:body>' + bodyInner +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
}
const LONG = "Penelitian membahas pengaruh metode pembelajaran daring terhadap motivasi belajar mahasiswa semester awal program studi pendidikan bahasa indonesia fakultas keguruan ilmu universitas negeri contoh selama masa transisi kurikulum baru berlangsung penuh tantangan adaptasi teknologi evaluasi berkala melalui angket wawancara observasi kelas dokumentasi nilai ujian tengah akhir semester ganjil tahun akademik berjalan tuntas.";
const FIXTURE_BODY =
  '<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Bab Satu Menganalisa Data</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">Penelitian ini </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>menganalisa</w:t></w:r><w:r><w:t xml:space="preserve"> data yang diperoleh.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Hasil hasil wawancara dicatat dan menganalisa ulang dilakukan tim.</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Sel pertama bersih.</w:t></w:r></w:p></w:tc>' +
  '<w:tc><w:p><w:r><w:t>Sel kedua menganalisa ulang.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '<w:p><w:r><w:t xml:space="preserve">Rumus berikut </w:t></w:r><m:oMath><m:r><m:t>x+y</m:t></m:r></m:oMath><w:r><w:t xml:space="preserve"> dipakai untuk menganalisa data.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>' + LONG + '</w:t></w:r></w:p>';

async function buildAnnot(bytes, name, extras){
  const parsed = await S.diParseDocx(new Uint8Array(bytes), OPTS);
  if (!parsed.ok) throw new Error("fixture gagal diimpor: " + parsed.message);
  const asm = S.diAssembleText(parsed.model);
  const analysis = S.wiAnalyze(asm.text);
  const A = S.annotBuildReport(analysis, Object.assign(
    { doc: { name: name || "fixture.docx", model: parsed.model } }, extras || {}));
  return { model: parsed.model, analysis, A, asm };
}

(async () => {
/* ============ Grup 1 — CRC32 + ZIP tulis/baca ============ */
console.log("Grup 1 — CRC32 & ZIP");
{
  check("CRC32 vektor '123456789' = 0xCBF43926",
    S.diFaithfulCrc32(Buffer.from("123456789")) === 0xCBF43926,
    S.diFaithfulCrc32(Buffer.from("123456789")).toString(16));
  check("CRC32 kosong = 0", S.diFaithfulCrc32(new Uint8Array(0)) === 0);
  const bytes = docxFixture(docXml(FIXTURE_BODY), true);
  const zr = S.diFaithfulZipEntries(new Uint8Array(bytes));
  check("direktori pusat terbaca (4 entri)", zr.ok && zr.entries.length === 4, zr);
  const rewritten = S.diFaithfulZipWrite(new Uint8Array(bytes), zr.entries, {});
  const zr2 = S.diFaithfulZipEntries(rewritten);
  check("tulis ulang tanpa penggantian: entri sama", zr2.ok && zr2.entries.length === 4 &&
    zr2.entries.every((e, i) => e.name === zr.entries[i].name && e.crc === zr.entries[i].crc));
  const parsed = await S.diParseDocx(rewritten, OPTS);
  check("hasil tulis ulang tetap terimpor", parsed.ok, parsed && parsed.message);
  check("nama berkas setia", S.diFaithfulFileName("laporan akhir.PDF") === "laporan-akhir-beranotasi.PDF" &&
    S.diFaithfulFileName("skripsi.docx") === "skripsi-beranotasi.docx" &&
    S.diFaithfulFileName("") === "dokumen-beranotasi");
}

/* ============ Grup 2 — Bedah DOCX multi-fitur + verifikasi penuh ============ */
console.log("Grup 2 — bedah DOCX multi-fitur");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), true));
  const { model, A } = await buildAnnot(bytes);
  check("model memuat 7 blok (judul, 3 paragraf, 2 sel, rumus, panjang)",
    model.blocks.length === 7, model.blocks.length);
  check("ada temuan berjangkar", A.totals.anchored >= 5, A.totals);
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
  check("bedah berhasil", surgery.ok === true, surgery);
  if (surgery.ok){
    const verify = await S.diFaithfulVerifyDocx(bytes, surgery.bytes, model, A, OPTS);
    check("verifikasi penuh lulus", verify.ok === true, verify.failures);
    /* Bagian selain document.xml byte-identik (cek langsung) */
    const zo = S.diFaithfulZipEntries(bytes), zn = S.diFaithfulZipEntries(surgery.bytes);
    let partsSame = true, docChanged = false;
    zo.entries.forEach((eo, i) => {
      const en = zn.entries[i];
      const a = bytes.subarray(eo.dataStart, eo.dataStart + eo.compSize);
      const b = surgery.bytes.subarray(en.dataStart, en.dataStart + en.compSize);
      if (eo.name === "word/document.xml"){ docChanged = !Buffer.from(a).equals(Buffer.from(b)); return; }
      if (!Buffer.from(a).equals(Buffer.from(b))) partsSame = false;
    });
    check("bagian lain byte-identik", partsSame);
    check("document.xml memang berubah", docChanged);
    check("OMML utuh pada hasil (x+y tetap ada)", surgery.xml.includes("x+y"));
    const root = S.diParseXml(surgery.xml);
    const paras = S.diFaithfulCollectParas(root);
    check("paragraf hasil = 7 asal + rekomendasi", paras.length > 7, paras.length);
    const bodyKids = root.children[0].children;
    check("sectPr tetap anak terakhir body",
      bodyKids[bodyKids.length - 1].local === "sectPr");
    check("judul tanpa temuan tetap utuh (mesin tidak menandai judul)",
      S.diFaithfulParaText(paras[0]) === "Bab Satu Menganalisa Data", S.diFaithfulParaText(paras[0]));
    /* Determinisme */
    const surgery2 = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
    check("bedah deterministik (byte identik)", surgery2.ok && Buffer.from(surgery2.bytes).equals(Buffer.from(surgery.bytes)));
  }
}

/* ============ Grup 3 — Temuan di sel tabel tersorot ============ */
console.log("Grup 3 — sel tabel");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), false));
  const { model, A } = await buildAnnot(bytes);
  const cellBlock = model.blocks.findIndex(b => b.type === "table-cell" && S.diBlockText(b).includes("menganalisa"));
  check("blok sel bertemuan ditemukan", cellBlock >= 0, cellBlock);
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
  check("bedah (stored) berhasil", surgery.ok === true, surgery);
  if (surgery.ok){
    const root = S.diParseXml(surgery.xml);
    const paras = S.diFaithfulCollectParas(root);
    const xmlText = S.diFaithfulParaText(paras[cellBlock]);
    check("teks sel memuat nomor sisipan", /menganalisa\d ulang\./.test(xmlText), xmlText);
    const verify = await S.diFaithfulVerifyDocx(bytes, surgery.bytes, model, A, OPTS);
    check("verifikasi sel lulus", verify.ok === true, verify.failures);
  }
}

/* ============ Grup 4 — Penasihat: label manual + sorotan biru muda ============ */
console.log("Grup 4 — penasihat");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), false));
  const { model, A } = await buildAnnot(bytes);
  const adv = A.findings.filter(f => f.advisory);
  check("ada temuan penasihat", adv.length >= 1, A.totals);
  const app = S.diFaithfulAppendix(A);
  check("lampiran memuat item manual", app.items.some(it => it.manual && it.proposal === null));
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
  check("bedah berhasil", surgery.ok === true, surgery);
  if (surgery.ok){
    const root = S.diParseXml(surgery.xml);
    const paras = S.diFaithfulCollectParas(root);
    const longIdx = model.blocks.findIndex(b => S.diBlockText(b) === LONG);
    const plan = S.diFaithfulParaPlan(LONG, (S.diFaithfulIncluded(A).marksByBlock[longIdx] || []));
    const cyanLen = plan.segments.filter(s => s.hl === "cyan").reduce((n, s) => n + (s.end - s.start), 0);
    check("segmen biru muda penasihat substansial (>100 karakter)", cyanLen > 100, cyanLen);
    check("XML hasil memuat highlight cyan", surgery.xml.includes('w:val="cyan"'));
    check("XML hasil memuat highlight yellow", surgery.xml.includes('w:val="yellow"'));
  }
}

/* ============ Grup 5 — Dokumen bersih: tanpa sorotan, catatan kosong jujur ============ */
console.log("Grup 5 — dokumen bersih");
{
  const clean = docXml('<w:p><w:r><w:t>Penelitian ini menganalisis data dengan teliti. Hasilnya dicatat dengan rapi.</w:t></w:r></w:p>');
  const bytes = new Uint8Array(docxFixture(clean, false));
  const { model, A } = await buildAnnot(bytes);
  check("nol temuan", A.findings.length === 0, A.findings.length);
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
  check("bedah dokumen bersih berhasil", surgery.ok === true, surgery);
  if (surgery.ok){
    check("tidak ada elemen highlight", !surgery.xml.includes("<w:highlight"));
    check("catatan kosong jujur tercetak", surgery.xml.includes("Tidak ada rekomendasi perbaikan"));
    const verify = await S.diFaithfulVerifyDocx(bytes, surgery.bytes, model, A, OPTS);
    check("verifikasi bersih lulus", verify.ok === true, verify.failures);
  }
}

/* ============ Grup 6 — Run rumit memicu penolakan bedah (pemicu cadangan) ============ */
console.log("Grup 6 — run rumit");
{
  const complexBody = '<w:p><w:r><w:t>Mereka menganalisa</w:t><w:tab/><w:t xml:space="preserve"> data dengan teliti.</w:t></w:r></w:p>';
  const bytes = new Uint8Array(docxFixture(docXml(complexBody), false));
  const { model, A } = await buildAnnot(bytes);
  check("temuan ada pada paragraf run rumit", A.totals.anchored >= 1, A.totals);
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, OPTS);
  check("bedah menolak run rumit", surgery.ok === false && surgery.code === "faithful-complex", surgery);
  /* Segmen cadangan tetap dapat dibangun dari run model */
  const inc = S.diFaithfulIncluded(A);
  const pieces = S.diFaithfulBlockSegments(model.blocks[0], inc.marksByBlock[0] || []);
  const joined = pieces.filter(p => p.text).map(p => p.text).join("");
  check("segmen cadangan menyusun teks utuh", joined === S.diBlockText(model.blocks[0]), joined);
  const hlText = pieces.filter(p => p.hl === "yellow").map(p => p.text).join("");
  const expectHl = A.renderBlocks[0].marks
    .map(m => S.diBlockText(model.blocks[0]).slice(m.start, m.end)).join("");
  check("segmen cadangan menyorot tepat rentang temuan",
    hlText === expectHl, JSON.stringify(hlText) + " vs " + JSON.stringify(expectHl));
  check("segmen cadangan memuat sisipan nomor", pieces.some(p => p.insertNo === 1));
}

/* ============ Grup 7 — Model tidak selaras -> penolakan jujur ============ */
console.log("Grup 7 — ketidaksejajaran");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), false));
  const other = await buildAnnot(new Uint8Array(docxFixture(docXml('<w:p><w:r><w:t>Teks lain sama sekali.</w:t></w:r></w:p>'), false)));
  const { A } = await buildAnnot(bytes);
  const surgery = await S.diFaithfulDocxSurgery(bytes, other.model, A, OPTS);
  check("bedah menolak model asing", surgery.ok === false &&
    (surgery.code === "faithful-align"), surgery);
}

/* ============ Grup 8 — Temuan ditolak dikecualikan + temuan tanpa jangkar ============ */
console.log("Grup 8 — penolakan & jangkar putus");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), false));
  const parsed = await S.diParseDocx(bytes, OPTS);
  const asm = S.diAssembleText(parsed.model);
  const analysis = S.wiAnalyze(asm.text);
  const repeated = analysis.suggestions.find(s => s.kind === "repeated-word");
  check("saran kata berulang ada", !!repeated);
  const A = S.annotBuildReport(analysis, { doc: { name: "f.docx", model: parsed.model },
    rejectedIds: repeated ? [repeated.id] : [] });
  const inc = S.diFaithfulIncluded(A);
  const repFinding = A.findings.find(f => f.kind === "repeated-word");
  check("temuan ditolak tidak bernomor setia", repFinding && inc.noByFindingNo[repFinding.no] === undefined);
  check("penomoran setia rapat 1..M", inc.anchored.every((f, i) => inc.noByFindingNo[f.no] === i + 1));
  const app = S.diFaithfulAppendix(A);
  check("lampiran hanya memuat temuan yang disertakan",
    app.items.length === inc.anchored.length && app.items.every(it => it.no != null));
  /* Jangkar putus: paragraf bertemuan disunting pada teks analisis —
     temuannya tetap ada tetapi tidak dapat ditandai di dokumen. */
  const editedText = asm.text.replace("data yang diperoleh.", "data yang didapat.");
  const analysis2 = S.wiAnalyze(editedText);
  const A2 = S.annotBuildReport(analysis2, { doc: { name: "f.docx", model: parsed.model } });
  const inc2 = S.diFaithfulIncluded(A2);
  check("temuan paragraf suntingan kehilangan jangkar", inc2.unanchored.length >= 1, A2.totals);
  const app2 = S.diFaithfulAppendix(A2);
  check("lampiran memuat bagian tanpa jangkar", !!app2.unanchoredIntro && app2.unanchoredItems.length >= 1);
  const surgery2 = await S.diFaithfulDocxSurgery(bytes, parsed.model, A2, OPTS);
  check("bedah dengan jangkar putus tetap berhasil", surgery2.ok === true, surgery2);
  if (surgery2.ok){
    const verify2 = await S.diFaithfulVerifyDocx(bytes, surgery2.bytes, parsed.model, A2, OPTS);
    check("verifikasi jangkar putus lulus", verify2.ok === true, verify2.failures);
  }
}

/* ---------- Fixture PDF: pagesData tiruan pdf.js dengan posisi diketahui ---------- */
function pdfItem(str, x, y, fontName, fontSize){
  return { str, x, y, width: str.length * ((fontSize || 11) * 0.5), fontName: fontName || "Helvetica", fontSize: fontSize || 11 };
}
function makePagesData(){
  return [
    { page: 1, items: [
      pdfItem("Penelitian ini ", 56, 750),
      pdfItem("menganalisa", 56 + 15 * 5.5, 750),
      pdfItem(" data yang diperoleh.", 56 + 26 * 5.5, 750),
      pdfItem("Baris kedua bersih.", 56, 736),
      pdfItem("Paragraf dua bersih.", 56, 700)
    ]},
    { page: 2, items: [
      pdfItem("Halaman dua menganalisa ulang data.", 56, 750)
    ]}
  ];
}
const DIMS = { 1: { width: 612, height: 842, rotation: 0 }, 2: { width: 612, height: 842, rotation: 0 } };
async function buildAnnotPdf(pagesData){
  const model = S.diPdfPagesToModel(pagesData);
  const asm = S.diAssembleText(model);
  const analysis = S.wiAnalyze(asm.text);
  const A = S.annotBuildReport(analysis, { doc: { name: "f.pdf", model } });
  return { model, analysis, A };
}

/* ============ Grup 9 — Geometri PDF cermin == model + rencana overlay ============ */
console.log("Grup 9 — geometri & rencana PDF");
{
  const pagesData = makePagesData();
  const { model, A } = await buildAnnotPdf(pagesData);
  check("model PDF 3 blok", model.blocks.length === 3, model.blocks.map(b => S.diBlockText(b)));
  const geo = S.diFaithfulPdfGeometry(pagesData);
  check("geometri cermin jumlah blok sama", geo.length === model.blocks.length, geo.length);
  check("geometri cermin teks persis sama",
    geo.every((g, i) => g.text === S.diBlockText(model.blocks[i]) && g.page === model.blocks[i].page),
    geo.map(g => g.text));
  const plan = S.diFaithfulPdfPlan(pagesData, model, A, DIMS);
  check("rencana overlay OK", plan.ok === true, plan);
  if (plan.ok){
    const item = pagesData[0].items[1];
    const r1 = plan.rects.find(r => r.page === 1 && Math.abs(r.x - (item.x - 0.6)) < 1.5);
    check("rect 'menganalisa' pada posisi item (±1,5 pt)", !!r1, plan.rects);
    if (r1){
      check("rect menutupi lebar item", r1.x <= item.x + 0.5 && r1.x + r1.w >= item.x + item.width - 0.5,
        { r: r1, item });
      check("rect pada pita baseline item", Math.abs(r1.y - (750 - 0.25 * 11)) < 1.5, r1.y);
    }
    check("rect halaman 2 ada", plan.rects.some(r => r.page === 2), plan.rects.map(r => r.page));
    check("label nomor ada untuk tiap temuan berjangkar",
      plan.labels.length === A.totals.anchored, { labels: plan.labels.length, anchored: A.totals.anchored });
    check("baris lampiran memuat rekomendasi",
      plan.appendixLines.some(l => l.text.includes("Usulan perbaikan")) ||
      plan.appendixLines.some(l => l.text.includes("Perlu ditinjau manual")));
  }
  /* Rentang lintas baris -> dua rect satu halaman */
  const gb = geo[0];
  const crossStart = gb.text.indexOf("diperoleh.");
  const crossEnd = gb.text.indexOf("bersih.") + "bersih.".length;
  const cross = S.diFaithfulRangeRects(gb, crossStart, crossEnd);
  check("rentang lintas baris menghasilkan >= 2 rect", cross.length >= 2, cross.length);
  check("rect lintas baris pada dua y berbeda",
    cross.length >= 2 && Math.abs(cross[0].y - cross[cross.length - 1].y) > 5,
    cross.map(r => r.y));
}

/* ============ Grup 10 — Gerbang kejujuran PDF ============ */
console.log("Grup 10 — gerbang PDF");
{
  /* Teks rusak (PUA/CID) */
  const garbled = [{ page: 1, items: [
    pdfItem("\uE000\uE001\uE002\uE003\uE004\uE005\uE006\uE007", 56, 750),
    pdfItem("\uE010\uE011\uE012\uE013", 200, 750)
  ]}];
  const gStats = S.diFaithfulPdfGarble(garbled);
  check("statistik garble: semua karakter buruk", gStats.bad === 12 && gStats.ratio === 1, gStats);
  const gModel = S.diPdfPagesToModel(garbled);
  const gAsm = S.diAssembleText(gModel);
  const gA = S.annotBuildReport(S.wiAnalyze(gAsm.text), { doc: { name: "g.pdf", model: gModel } });
  const gPlan = S.diFaithfulPdfPlan(garbled, gModel, gA, DIMS);
  check("gerbang garble menolak", gPlan.ok === false && gPlan.reason === "garbled", gPlan);
  /* Rotasi */
  const pagesData = makePagesData();
  const { model, A } = await buildAnnotPdf(pagesData);
  const rotDims = { 1: { width: 612, height: 842, rotation: 90 }, 2: { width: 612, height: 842, rotation: 0 } };
  const rPlan = S.diFaithfulPdfPlan(pagesData, model, A, rotDims);
  check("gerbang rotasi menolak", rPlan.ok === false && rPlan.reason === "rotation", rPlan);
  /* Geometri dirusak sesudah model dibangun */
  const tampered = makePagesData();
  tampered[0].items[1] = pdfItem("mengXnalisa", 56 + 15 * 5.5, 750);
  const tPlan = S.diFaithfulPdfPlan(tampered, model, A, DIMS);
  check("gerbang geometri menolak teks berubah", tPlan.ok === false && tPlan.reason === "geometry-mismatch", tPlan);
  /* Karakter lampiran di luar WinAnsi (CJK pada kalimat temuan) */
  const cjk = [{ page: 1, items: [pdfItem("Peneliti menganalisa data \u6F22\u5B57 dengan teliti.", 56, 750)] }];
  const cModel = S.diPdfPagesToModel(cjk);
  const cAsm = S.diAssembleText(cModel);
  const cA = S.annotBuildReport(S.wiAnalyze(cAsm.text), { doc: { name: "c.pdf", model: cModel } });
  const cPlan = S.diFaithfulPdfPlan(cjk, cModel, cA, DIMS);
  check("gerbang karakter lampiran menolak CJK", cPlan.ok === false && cPlan.reason === "appendix-chars", cPlan);
  /* Tanpa data halaman */
  const nPlan = S.diFaithfulPdfPlan(null, model, A, DIMS);
  check("gerbang tanpa data halaman menolak", nPlan.ok === false && nPlan.reason === "no-pages", nPlan);
  /* PDF mirip pindaian terdeteksi statistik yang ada */
  const scanStats = S.diPdfTextStats([{ page: 1, items: [] }]);
  check("statistik pindaian: scanLike", scanStats.scanLike === true, scanStats);
}

/* ============ Grup 11 — Gerbang karakter WinAnsi ============ */
console.log("Grup 11 — WinAnsi");
{
  check("teks Indonesia + tanda baca umum aman",
    S.diFaithfulWinAnsiSafe("Kalimat \u2014 \u201Cuji\u201D \u2022 caf\u00E9 \u2026 selesai."));
  check("CJK tidak aman", !S.diFaithfulWinAnsiSafe("\u6F22\u5B57"));
  check("emoji tidak aman", !S.diFaithfulWinAnsiSafe("uji \u{1F600}"));
  check("huruf beraksen Latin-1 aman", S.diFaithfulWinAnsiSafe("r\u00E9sum\u00E9 na\u00EFve"));
}

/* ============ Grup 12 — pdf-lib sungguhan: overlay + teks asal utuh ============ */
console.log("Grup 12 — pdf-lib nyata");
{
  const { PDFDocument, StandardFonts, rgb } = require(__dirname + "/pdf-lib.min.cjs");
  const src = await PDFDocument.create();
  const helv = await src.embedFont(StandardFonts.Helvetica);
  const p1 = src.addPage([612, 842]);
  p1.drawText("Penelitian ini menganalisa data yang diperoleh.", { x: 56, y: 750, size: 11, font: helv });
  p1.drawText("Baris kedua bersih.", { x: 56, y: 736, size: 11, font: helv });
  const p2 = src.addPage([612, 842]);
  p2.drawText("Halaman dua menganalisa ulang data.", { x: 56, y: 750, size: 11, font: helv });
  const srcBytes = await src.save();
  /* pagesData diukur dari lebar font sungguhan — meniru keluaran pdf.js */
  const w = (s) => helv.widthOfTextAtSize(s, 11);
  const pagesData = [
    { page: 1, items: [
      { str: "Penelitian ini ", x: 56, y: 750, width: w("Penelitian ini "), fontName: "Helvetica", fontSize: 11 },
      { str: "menganalisa", x: 56 + w("Penelitian ini "), y: 750, width: w("menganalisa"), fontName: "Helvetica", fontSize: 11 },
      { str: " data yang diperoleh.", x: 56 + w("Penelitian ini menganalisa"), y: 750, width: w(" data yang diperoleh."), fontName: "Helvetica", fontSize: 11 },
      { str: "Baris kedua bersih.", x: 56, y: 736, width: w("Baris kedua bersih."), fontName: "Helvetica", fontSize: 11 }
    ]},
    { page: 2, items: [
      { str: "Halaman dua ", x: 56, y: 750, width: w("Halaman dua "), fontName: "Helvetica", fontSize: 11 },
      { str: "menganalisa", x: 56 + w("Halaman dua "), y: 750, width: w("menganalisa"), fontName: "Helvetica", fontSize: 11 },
      { str: " ulang data.", x: 56 + w("Halaman dua menganalisa"), y: 750, width: w(" ulang data."), fontName: "Helvetica", fontSize: 11 }
    ]}
  ];
  const { model, A } = await buildAnnotPdf(pagesData);
  const plan = S.diFaithfulPdfPlan(pagesData, model, A, DIMS);
  check("rencana atas PDF sungguhan OK", plan.ok === true, plan);
  if (plan.ok){
    const doc = await PDFDocument.load(srcBytes);
    const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    plan.rects.forEach(r => {
      pages[r.page - 1].drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h,
        color: r.advisory ? rgb(0.62, 0.84, 1) : rgb(1, 0.93, 0.55), opacity: 0.5 });
    });
    plan.labels.forEach(l => {
      pages[l.page - 1].drawText(String(l.no), { x: l.x, y: l.y, size: 7, font: helvB, color: rgb(0.11, 0.37, 0.82) });
    });
    const outBytes = await doc.save();
    fs.writeFileSync(path.join(__dirname, "faithful-qa-fixture.pdf"), Buffer.from(outBytes));
    fs.writeFileSync(path.join(__dirname, "faithful-qa-source.pdf"), Buffer.from(srcBytes));
    check("PDF hasil overlay tertulis untuk QA bbox", outBytes.length > srcBytes.length,
      { out: outBytes.length, src: srcBytes.length });
    /* Rect 'menganalisa' halaman 1 menutupi kata pada posisi font sungguhan */
    const item = pagesData[0].items[1];
    const r1 = plan.rects.find(r => r.page === 1);
    check("rect menutupi kata 'menganalisa' (font sungguhan, ±1,5 pt)",
      !!r1 && Math.abs(r1.x - (item.x - 0.6)) < 1.5 && r1.x + r1.w >= item.x + item.width - 0.5,
      { r1, item });
  }
  /* Gerbang WinAnsi terhadap pdf-lib sungguhan: karakter pada himpunan
     aman harus terkodekan; CJK harus ditolak pustaka. */
  const encDoc = await PDFDocument.create();
  const encFont = await encDoc.embedFont(StandardFonts.Helvetica);
  const encPage = encDoc.addPage([612, 842]);
  let threwSafe = false, threwCjk = false;
  try { encPage.drawText("Uji \u2014 \u201Ckutipan\u201D \u2022 caf\u00E9 \u2026 \u20AC", { x: 56, y: 750, size: 11, font: encFont }); }
  catch(e){ threwSafe = true; }
  try { encPage.drawText("\u6F22\u5B57", { x: 56, y: 700, size: 11, font: encFont }); }
  catch(e){ threwCjk = true; }
  check("pdf-lib mengodekan himpunan aman WinAnsi", !threwSafe);
  check("pdf-lib menolak CJK (gerbang konsisten)", threwCjk);
}

/* ============ Grup 13 — Jalur bawaan peramban (opts kosong) ============
   Regresi bug nyata: lem UI memanggil bedah/verifikasi dengan {} —
   inflateRaw harus jatuh ke diInflateRawDefault (DecompressionStream),
   bukan undefined. Di Node jalur bawaan itu juga tersedia. */
console.log("Grup 13 — opts kosong (jalur peramban)");
{
  const bytes = new Uint8Array(docxFixture(docXml(FIXTURE_BODY), true));
  const { model, A } = await buildAnnot(bytes);
  const surgery = await S.diFaithfulDocxSurgery(bytes, model, A, {});
  check("bedah dengan opts kosong berhasil", surgery.ok === true, surgery);
  if (surgery.ok){
    const verify = await S.diFaithfulVerifyDocx(bytes, surgery.bytes, model, A, {});
    check("verifikasi dengan opts kosong lulus", verify.ok === true, verify.failures);
  }
}

console.log("\nfaithful-test: " + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
})().catch(e => { console.error("GALAT UJI:", e); process.exit(1); });
