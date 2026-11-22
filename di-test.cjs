/* Document Intelligence (D1) — Node tests for DI-CORE (extracted from index.html).
   Fixtures dibangun oleh fixtures/build-fixtures.cjs dan dibaca dari fixtures/. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const coreRaw = html.split("DI-CORE-START")[1].split("/* DI-CORE-END */")[0];
const core = coreRaw.slice(coreRaw.indexOf("*/") + 2);

const sandbox = {};
new Function("sandbox", core +
  "\nsandbox.diParseDocx = diParseDocx; sandbox.diAssembleText = diAssembleText;" +
  " sandbox.diModelStats = diModelStats; sandbox.diParseXml = diParseXml;" +
  " sandbox.diSerializeXml = diSerializeXml; sandbox.DI_CAPS = DI_CAPS; sandbox.DI_MAX_ANALYSIS_CHARS = DI_MAX_ANALYSIS_CHARS;" +
  " sandbox.diPdfPagesToModel = diPdfPagesToModel; sandbox.diPdfTextStats = diPdfTextStats;" +
  " sandbox.diPdfErrorInfo = diPdfErrorInfo; sandbox.diSniffFormat = diSniffFormat;" +
  " sandbox.diSyncModel = diSyncModel; sandbox.diMapSuggestion = diMapSuggestion; sandbox.diMapAll = diMapAll;" +
  " sandbox.diApplyToModel = diApplyToModel; sandbox.diCloneModel = diCloneModel;" +
  " sandbox.diBlockText = diBlockText; sandbox.DI_MAP_REASON_TEXT = DI_MAP_REASON_TEXT;" +
  " sandbox.diModelToHtml = diModelToHtml; sandbox.diModelToPlainText = diModelToPlainText;" +
  " sandbox.diExportWarnings = diExportWarnings; sandbox.diDiffModels = diDiffModels;" +
  " sandbox.diDiffSegments = diDiffSegments; sandbox.diLinkSafe = diLinkSafe;" +
  " sandbox.diLinkScheme = diLinkScheme; sandbox.diHeadingStyleCustom = diHeadingStyleCustom;" +
  " sandbox.diModelIndentCount = diModelIndentCount; sandbox.diScanPartFlags = diScanPartFlags;")(sandbox);
const { diParseDocx, diAssembleText, diModelStats, diParseXml, diSerializeXml, DI_CAPS, DI_MAX_ANALYSIS_CHARS,
  diPdfPagesToModel, diPdfTextStats, diPdfErrorInfo, diSniffFormat,
  diSyncModel, diMapSuggestion, diMapAll, diApplyToModel, diCloneModel, diBlockText, DI_MAP_REASON_TEXT,
  diModelToHtml, diModelToPlainText, diExportWarnings, diDiffModels, diDiffSegments, diLinkSafe,
  diLinkScheme, diHeadingStyleCustom, diModelIndentCount, diScanPartFlags } = sandbox;

/* WI-CORE diekstrak juga (read-only) agar uji D3 dapat menegaskan saran
   sungguhan dari wiAnalyze atas teks rakitan dokumen. */
const wiRaw = html.split("WI-CORE-START")[1].split("/* WI-CORE-END */")[0];
const wiCore = wiRaw.slice(wiRaw.indexOf("*/") + 2);
const wiSandbox = {};
new Function("sandbox", wiCore + "\nsandbox.wiAnalyze = wiAnalyze;")(wiSandbox);
const { wiAnalyze } = wiSandbox;

const inflateRaw = (data) => zlib.inflateRawSync(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
const OPTS = { inflateRaw };
const fx = (name) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function parse(name, opts) { return diParseDocx(fx(name), opts || OPTS); }
function blockText(b) { return b.runs.filter(r => !r.protected).map(r => r.text).join(""); }

(async function main() {

  console.log("1) Parser XML mini");
  {
    const root = diParseXml('<w:document xmlns:w="urn:x"><w:body><w:p a="1">teks &amp; &#x2713;<w:br/></w:p><w:p/></w:body></w:document>');
    check("akar terbaca dengan nama lokal", root.local === "document");
    const body = root.children.find(c => c.local === "body");
    check("anak body dua paragraf", body.children.filter(c => c.local === "p").length === 2);
    const p0 = body.children.find(c => c.local === "p");
    check("atribut terbaca", p0.attrs.a === "1");
    check("entitas & hex terurai", p0.children[0].text === "teks & ✓", p0.children[0].text);
    const cdata = diParseXml("<r><![CDATA[a <b> c]]></r>");
    check("CDATA menjadi teks mentah", cdata.children[0].text === "a <b> c");
    let threw = false;
    try { diParseXml("<r><a></r>"); } catch (e) { threw = e.code === "xml-invalid"; }
    check("XML rusak melempar xml-invalid", threw);
    const ser = diSerializeXml(diParseXml('<w:p><w:r><w:t a="x&amp;y">halo</w:t></w:r></w:p>'));
    check("serialisasi round-trip stabil", ser === '<w:p><w:r><w:t a="x&amp;y">halo</w:t></w:r></w:p>', ser);
  }

  console.log("2) simple.docx — paragraf & run menyambung");
  {
    const r = await parse("simple.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("format docx", m.format === "docx");
    check("tiga blok paragraf", m.blocks.length === 3 && m.blocks.every(b => b.type === "paragraph"), m.blocks.map(b => b.type));
    check("id blok berurutan", eq(m.blocks.map(b => b.id), ["b0", "b1", "b2"]));
    check("run ketiga menyambung dua run", blockText(m.blocks[2]) === "Paragraf ketiga menyambung kalimat yang sama.", blockText(m.blocks[2]));
    const asm = diAssembleText(m);
    check("teks rakitan = gabungan \\n\\n", asm.text === "Aktifitas ini di lakukan setiap hari Senin.\n\nParagraf kedua berisi kalimat biasa tanpa masalah.\n\nParagraf ketiga menyambung kalimat yang sama.");
    check("paraMap identitas", eq(asm.paraMap, [0, 1, 2]));
    check("tidak terpotong", asm.truncated === false && asm.keptBlocks === 3 && asm.totalBlocks === 3);
    const st = diModelStats(m);
    check("statistik kata", st.words === 20 && st.blocks === 3 && st.protected === 0 && st.tables === 0, st);
  }

  console.log("3) headings.docx — gaya Heading1/2");
  {
    const r = await parse("headings.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("blok pertama heading level 1", m.blocks[0].type === "heading" && m.blocks[0].level === 1, m.blocks[0]);
    check("blok ketiga heading level 2", m.blocks[2].type === "heading" && m.blocks[2].level === 2, m.blocks[2]);
    check("styleName tercatat", m.blocks[0].styleName === "heading 1", m.blocks[0].styleName);
    check("isi heading utuh", blockText(m.blocks[0]) === "Bab Satu Pendahuluan");
    check("statistik headings = 2", diModelStats(m).headings === 2);
  }

  console.log("4) formatting.docx — b/i/u, font, hyperlink");
  {
    const r = await parse("formatting.docx");
    check("parse ok", r.ok === true, r);
    const runs = r.model.blocks[0].runs;
    check("run tebal terdeteksi", runs.some(x => x.text === "tebal" && x.bold === true && !x.italic), runs);
    check("run miring terdeteksi", runs.some(x => x.text === "miring" && x.italic === true && !x.bold), runs);
    check("run garis bawah terdeteksi", runs.some(x => x.text === "garis bawah" && x.underline === true), runs);
    check("run tebal+miring terdeteksi", runs.some(x => x.text === "tebal miring" && x.bold === true && x.italic === true), runs);
    check("run biasa tanpa flag", runs.some(x => x.text === "Teks biasa " && !x.bold && !x.italic && !x.underline), runs);
    const fr = r.model.blocks[1].runs[0];
    check("fontName Georgia", fr.fontName === "Georgia", fr);
    check("fontSize 12 (sz 24 half-point)", fr.fontSize === 12, fr);
    const lr = r.model.blocks[2].runs.find(x => x.text === "situs Saksara");
    check("hyperlink tertaut ke rels", !!lr && lr.link === "https://saksara.vercel.app", lr);
  }

  console.log("5) lists.docx — bullet & bernomor");
  {
    const r = await parse("lists.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("semua blok list-item", m.blocks.length === 5 && m.blocks.every(b => b.type === "list-item"), m.blocks.map(b => b.type));
    check("tiga bullet", m.blocks.slice(0, 3).every(b => b.listKind === "bullet"), m.blocks.map(b => b.listKind));
    check("dua number", m.blocks.slice(3).every(b => b.listKind === "number"), m.blocks.map(b => b.listKind));
    check("level 0 tercatat", m.blocks.every(b => b.level === 0));
    check("statistik listItems = 5", diModelStats(m).listItems === 5);
  }

  console.log("6) table.docx — grid, gridSpan, vMerge");
  {
    const r = await parse("table.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("dua tabel tercatat", m.tables.length === 2, m.tables.length);
    check("blok: paragraf + 3 sel + 4 sel + paragraf", m.blocks.length === 9, m.blocks.map(b => b.type + "@" + (b.r ?? "-") + "," + (b.c ?? "-")));
    const merged = m.blocks.find(b => b.type === "table-cell" && b.gridSpan === 2);
    check("sel gridSpan=2 di (0,0)", !!merged && merged.r === 0 && merged.c === 0 && blockText(merged) === "Sel gabungan membentang dua kolom.", merged);
    check("sel baris kedua kolom 0 & 1", m.blocks.some(b => b.r === 1 && b.c === 0) && m.blocks.some(b => b.r === 1 && b.c === 1));
    check("metadata baris tabel konsisten", m.tables[0].rows.length === 2 && m.tables[0].rows[0].cells[0].blockIds.length === 1);
    const vm = m.blocks.filter(b => b.table === 1 && b.vMerge);
    check("vMerge restart + continue terbaca", vm.some(b => b.vMerge === "restart") && vm.some(b => b.vMerge === "continue"), vm.map(b => b.vMerge));
    const st = diModelStats(m);
    check("statistik sel = 7", st.cells === 7 && st.tables === 2, st);
    const asm = diAssembleText(m);
    check("sel kosong vMerge tidak menjadi paragraf analisis", asm.totalBlocks === 8, asm.totalBlocks);
  }

  console.log("7) equation.docx — OMML terlindungi");
  {
    const r = await parse("equation.docx");
    check("parse ok", r.ok === true, r);
    const runs = r.model.blocks[0].runs;
    const prot = runs.find(x => x.protected);
    check("ada run terlindungi omml", !!prot && prot.kind === "omml", prot);
    check("teks linear rumus tersimpan untuk tampilan", prot && prot.text === "ab", prot && prot.text);
    check("xml asli rumus dipertahankan", !!prot && prot.xml.indexOf("oMath") >= 0);
    const asm = diAssembleText(r.model);
    check("rumus TIDAK masuk teks analisis", asm.text === "Rumus pecahan berikut dipakai dalam perhitungan, yaitu  untuk setiap percobaan.", asm.text);
    check("statistik protected = 1", diModelStats(r.model).protected === 1);
  }

  console.log("8) unicode.docx & mixed.docx");
  {
    const r = await parse("unicode.docx");
    check("parse ok", r.ok === true, r);
    const t = diAssembleText(r.model).text;
    check("simbol unicode utuh", t.indexOf("✓") >= 0 && t.indexOf("→") >= 0 && t.indexOf("“kutip lengkung”") >= 0, t);
    check("emoji & harga utuh", t.indexOf("😀") >= 0 && t.indexOf("Rp15.000,00") >= 0, t);
    const r2 = await parse("mixed.docx");
    check("istilah teknis utuh", diAssembleText(r2.model).text.indexOf("API berbasis JSON") >= 0);
  }

  console.log("9) tracked.docx — del dibuang, ins diterima");
  {
    const r = await parse("tracked.docx");
    check("parse ok", r.ok === true, r);
    const t = blockText(r.model.blocks[0]);
    check("teks gabungan benar", t === "Kalimat awal sisipan baru tetap ada.", t);
    check("teks terhapus tidak muncul", t.indexOf("teks lama terhapus") < 0);
  }

  console.log("10) deflated.docx — jalur inflate");
  {
    const r = await parse("deflated.docx");
    check("parse ok", r.ok === true, r);
    check("teks terbaca", diAssembleText(r.model).text.indexOf("terkompresi deflate") >= 0);
    const r2 = await diParseDocx(fx("deflated.docx")); /* tanpa suntikan: DecompressionStream bawaan Node */
    check("inflate bawaan lingkungan juga bekerja", r2.ok === true, r2.ok ? "" : r2);
  }

  console.log("11) Fixtures negatif — kode galat");
  {
    const c = await parse("corrupt.docx");
    check("korup -> zip-invalid", c.ok === false && c.code === "zip-invalid", c);
    const nz = await parse("notdocx.zip");
    check("zip biasa -> docx-no-content-types", nz.ok === false && nz.code === "docx-no-content-types", nz);
    const nd = await parse("nodocument.docx");
    check("tanpa document.xml -> docx-no-document", nd.ok === false && nd.code === "docx-no-document", nd);
    const em = await parse("empty.docx");
    check("dokumen kosong parse ok", em.ok === true, em);
    const asmE = diAssembleText(em.model);
    check("dokumen kosong -> teks analisis kosong", asmE.text === "" && asmE.totalBlocks === 0, asmE);
  }

  console.log("12) Batas ZIP (caps diturunkan untuk uji)");
  {
    check("caps bawaan sesuai mandat", DI_CAPS.maxEntries === 200 && DI_CAPS.maxTotalBytes === 50 * 1024 * 1024 && DI_CAPS.maxEntryBytes === 20 * 1024 * 1024, DI_CAPS);
    const many = await diParseDocx(fx("simple.docx"), { inflateRaw, caps: { maxEntries: 2 } });
    check("entri berlebih -> zip-too-many-entries", many.ok === false && many.code === "zip-too-many-entries", many);
    const tot = await diParseDocx(fx("bomb.docx"), { inflateRaw, caps: { maxTotalBytes: 65536 } });
    check("total dekompresi berlebih -> zip-too-large", tot.ok === false && tot.code === "zip-too-large", tot);
    const per = await diParseDocx(fx("bomb.docx"), { inflateRaw, caps: { maxEntryBytes: 65536 } });
    check("satu entri berlebih -> zip-entry-too-large", per.ok === false && per.code === "zip-entry-too-large", per);
    const bombOk = await parse("bomb.docx");
    check("bomb.docx lolos dengan caps bawaan", bombOk.ok === true, bombOk.ok ? "" : bombOk);
  }

  console.log("13) Manipulasi header — zip64, enkripsi, metode");
  {
    const buf = Buffer.from(fx("simple.docx"));
    const eocdAt = buf.length - 22;
    const z64 = Buffer.from(buf); z64.writeUInt16LE(0xFFFF, eocdAt + 10);
    const rz = await diParseDocx(new Uint8Array(z64), OPTS);
    check("sentinel zip64 -> zip64", rz.ok === false && rz.code === "zip64", rz);
    const cdOff = buf.readUInt32LE(eocdAt + 16);
    const enc = Buffer.from(buf); enc.writeUInt16LE(enc.readUInt16LE(cdOff + 8) | 0x0001, cdOff + 8);
    const re = await diParseDocx(new Uint8Array(enc), OPTS);
    check("flag enkripsi -> zip-encrypted", re.ok === false && re.code === "zip-encrypted", re);
    /* cari record CD milik word/document.xml lalu rusak metode kompresinya */
    const met = Buffer.from(buf);
    let pos = cdOff, patched = false;
    while (pos + 46 <= met.length && met.readUInt32LE(pos) === 0x02014b50) {
      const nl = met.readUInt16LE(pos + 28), el = met.readUInt16LE(pos + 30), cl = met.readUInt16LE(pos + 32);
      const nm = met.subarray(pos + 46, pos + 46 + nl).toString("utf8");
      if (nm === "word/document.xml") { met.writeUInt16LE(99, pos + 10); patched = true; break; }
      pos += 46 + nl + el + cl;
    }
    check("record document.xml ditemukan untuk uji metode", patched);
    const rm = await diParseDocx(new Uint8Array(met), OPTS);
    check("metode asing pada document.xml -> zip-method", rm.ok === false && rm.code === "zip-method", rm);
  }

  console.log("14) Pemotongan rakitan pada batas blok");
  {
    const blocks = [];
    for (let i = 0; i < 30; i++) blocks.push({ id: "b" + i, type: "paragraph", runs: [{ text: "x".repeat(2000) }] });
    const model = { format: "docx", blocks, tables: [] };
    const asm = diAssembleText(model);
    check("batas analisis 50.000", DI_MAX_ANALYSIS_CHARS === 50000);
    check("terpotong pada batas blok", asm.truncated === true && asm.text.length <= 50000, asm.text.length);
    check("keptBlocks konsisten", asm.keptBlocks === asm.paraMap.length && asm.totalBlocks === 30, asm.keptBlocks);
    check("tidak ada blok terpotong di tengah", asm.text.split("\n\n").every(p => p.length === 2000));
    check("totalChars = panjang penuh", asm.totalChars === 30 * 2000 + 29 * 2, asm.totalChars);
  }

  console.log("15) Determinisme");
  {
    const a = await parse("table.docx");
    const b = await parse("table.docx");
    check("parse dua kali deep-equal", eq(a.model, b.model));
    const c = await parse("formatting.docx");
    const d = await parse("formatting.docx");
    check("parse formatting dua kali deep-equal", eq(c.model, d.model));
  }

  console.log("16) D2 — diSniffFormat (deteksi isi, bukan ekstensi)");
  {
    const enc = new TextEncoder();
    check("PK zip -> zip", diSniffFormat(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14])) === "zip");
    check("%PDF- -> pdf", diSniffFormat(enc.encode("%PDF-1.7\n")) === "pdf");
    check("sampah sebelum %PDF- (<=1024) -> pdf", diSniffFormat(enc.encode("junk junk %PDF-1.4")) === "pdf");
    check("teks lain -> unknown", diSniffFormat(enc.encode("halo dunia")) === "unknown");
    check("terlalu pendek -> unknown", diSniffFormat(new Uint8Array([0x25, 0x50])) === "unknown");
    check("null -> unknown", diSniffFormat(null) === "unknown");
  }

  console.log("17) D2 — diPdfPagesToModel: baris, run, celah spasi");
  const pit = (str, x, y, w, fn, fs) => ({ str, x, y, width: w, fontName: fn || "Helvetica", fontSize: fs || 11 });
  {
    /* item sengaja tidak terurut: kata kedua ditulis lebih dulu */
    const m = diPdfPagesToModel([{ page: 1, items: [pit("dua", 100, 700, 20), pit("Satu", 56, 700, 24)] }]);
    check("format pdf + pages tercatat", m.format === "pdf" && m.pages === 1, m.format + "/" + m.pages);
    check("satu blok paragraf halaman 1", m.blocks.length === 1 && m.blocks[0].type === "paragraph" && m.blocks[0].page === 1, m.blocks);
    check("urutan x + spasi dari celah", blockText(m.blocks[0]) === "Satu dua", blockText(m.blocks[0]));
    check("run menyatu sefont", m.blocks[0].runs.length === 1, m.blocks[0].runs);
    check("statistik pages muncul untuk PDF", diModelStats(m).pages === 1);
    check("run PDF tidak pernah terlindungi", diModelStats(m).protected === 0);
  }
  {
    const m = diPdfPagesToModel([{ page: 1, items: [
      pit("Biasa", 56, 700, 30), pit("Tebal", 90, 700, 28, "ABCDEE+Calibri-Bold"), pit("Miring", 130, 700, 30, "Times-Italic"),
    ] }]);
    const runs = m.blocks[0].runs;
    check("teks menyambung antarfont", blockText(m.blocks[0]) === "Biasa Tebal Miring", blockText(m.blocks[0]));
    const rb = runs.find(r => r.bold === true);
    check("heuristik bold dari nama font", !!rb && rb.text === " Tebal" && rb.fontName === "ABCDEE+Calibri-Bold", rb);
    const ri = runs.find(r => r.italic === true);
    check("heuristik italic dari nama font", !!ri && ri.text === " Miring", ri);
    check("run biasa tanpa flag", runs.some(r => r.text === "Biasa" && !r.bold && !r.italic), runs);
    check("tidak ada klaim heading dari PDF", m.blocks.every(b => b.type === "paragraph"));
    check("fontSize tercatat sebagai petunjuk", runs[0].fontSize === 11, runs[0]);
  }

  console.log("18) D2 — jeda paragraf & normalisasi y");
  {
    const m = diPdfPagesToModel([{ page: 1, items: [
      pit("Baris satu.", 56, 720, 60), pit("Baris dua.", 56, 706, 58), pit("Baris tiga.", 56, 676, 60),
    ] }]);
    check("jarak 14pt menyatu, 30pt memisah", m.blocks.length === 2, m.blocks.map(b => blockText(b)));
    check("blok pertama dua baris berspasi", blockText(m.blocks[0]) === "Baris satu. Baris dua.", blockText(m.blocks[0]));
    check("blok kedua paragraf baru", blockText(m.blocks[1]) === "Baris tiga.");
    const m2 = diPdfPagesToModel([{ page: 1, items: [pit("Bawah.", 56, 100, 34), pit("Atas.", 56, 700, 30)] }]);
    check("y besar (atas) dibaca lebih dulu", m2.blocks.length === 2 && blockText(m2.blocks[0]) === "Atas." && blockText(m2.blocks[1]) === "Bawah.", m2.blocks.map(b => blockText(b)));
  }

  console.log("19) D2 — banyak halaman, halaman kosong, statistik");
  {
    const pages = [
      { page: 1, items: [pit("Halaman satu.", 56, 700, 70)] },
      { page: 2, items: [pit("Halaman dua.", 56, 700, 66)] },
      { page: 3, items: [] },
    ];
    const m = diPdfPagesToModel(pages);
    check("blok membawa nomor halaman", eq(m.blocks.map(b => b.page), [1, 2]), m.blocks.map(b => b.page));
    check("model.pages = jumlah halaman berkas", m.pages === 3);
    const asm = diAssembleText(m);
    check("rakitan lintas halaman", asm.text === "Halaman satu.\n\nHalaman dua." && eq(asm.paraMap, [0, 1]), asm.text);
    check("statistik pages = 3", diModelStats(m).pages === 3);
    const rDocx = await parse("simple.docx");
    check("statistik DOCX TIDAK punya pages", !("pages" in diModelStats(rDocx.model)));
    const mEmpty = diPdfPagesToModel([{ page: 1, items: [] }]);
    check("halaman kosong: tanpa blok, pages tetap 1", mEmpty.blocks.length === 0 && mEmpty.pages === 1 && diAssembleText(mEmpty).text === "");
  }

  console.log("20) D2 — dua kolom: hasil deterministik = menyilang per baris (batas terdokumentasi)");
  {
    const m = diPdfPagesToModel([{ page: 1, items: [
      pit("Kiri satu.", 56, 720, 50), pit("Kanan satu.", 310, 720, 55),
      pit("Kiri dua.", 56, 706, 48), pit("Kanan dua.", 310, 706, 52),
    ] }]);
    check("kolom terbaca menyilang per baris", m.blocks.length === 1 &&
      blockText(m.blocks[0]) === "Kiri satu. Kanan satu. Kiri dua. Kanan dua.", m.blocks.map(b => blockText(b)));
  }

  console.log("21) D2 — diPdfTextStats & deteksi pindaian");
  {
    const scan = diPdfTextStats([{ page: 1, items: [] }, { page: 2, items: [] }]);
    check("tanpa teks -> scanLike", scan.scanLike === true && scan.totalChars === 0 && scan.emptyPages === 2, scan);
    const tipis = diPdfTextStats([{ page: 1, items: [pit("abc", 56, 700, 12)] }]);
    check("rata-rata < 10 karakter -> scanLike", tipis.scanLike === true && tipis.totalChars === 3, tipis);
    const sebagian = diPdfTextStats([
      { page: 1, items: [pit("x".repeat(100), 56, 700, 300)] },
      { page: 2, items: [] },
    ]);
    check("sebagian kosong -> bukan scan, emptyPages=1", sebagian.scanLike === false && sebagian.emptyPages === 1 && sebagian.pages === 2, sebagian);
    const normal = diPdfTextStats([{ page: 1, items: [pit("Teks yang cukup panjang untuk satu halaman.", 56, 700, 200)] }]);
    check("halaman berteks -> bukan scan", normal.scanLike === false && normal.emptyPages === 0, normal);
  }

  console.log("22) D2 — diPdfErrorInfo (pemetaan galat pdf.js)");
  {
    const enc = diPdfErrorInfo({ name: "PasswordException", message: "No password given" });
    check("PasswordException -> pdf-encrypted", enc.code === "pdf-encrypted" && /terenkripsi/i.test(enc.message), enc);
    const inv = diPdfErrorInfo({ name: "InvalidPDFException", message: "Invalid PDF structure" });
    check("InvalidPDFException -> pdf-invalid", inv.code === "pdf-invalid", inv);
    const mis = diPdfErrorInfo({ name: "MissingPDFException", message: "" });
    check("MissingPDFException -> pdf-invalid", mis.code === "pdf-invalid", mis);
    const gen = diPdfErrorInfo(new Error("ledakan tak terduga"));
    check("galat umum -> pdf-failed", gen.code === "pdf-failed" && gen.message.length > 10, gen);
    let noThrow = true;
    try { diPdfErrorInfo(null); diPdfErrorInfo(undefined); } catch (e) { noThrow = false; }
    check("null/undefined tidak melempar", noThrow);
  }

  console.log("23) D2 — pemotongan rakitan model PDF & determinisme");
  {
    const pages = [];
    for (let i = 0; i < 30; i++) pages.push({ page: i + 1, items: [pit("x".repeat(2000), 56, 700, 900)] });
    const m = diPdfPagesToModel(pages);
    const asm = diAssembleText(m);
    check("30 blok halaman -> terpotong pada batas blok", asm.truncated === true && asm.text.length <= 50000 && asm.keptBlocks === asm.paraMap.length, asm.keptBlocks);
    check("blok PDF utuh 2000 karakter", asm.text.split("\n\n").every(p => p.length === 2000));
    const cols = [{ page: 1, items: [pit("Kiri satu.", 56, 720, 50), pit("Kanan satu.", 310, 720, 55)] }];
    check("konversi dua kali deep-equal", eq(diPdfPagesToModel(cols), diPdfPagesToModel(cols)));
  }

  console.log("24) D3 — fixture doc-apply.docx: struktur & saran sungguhan WI");
  let applyModel = null, applyAsm = null, applyRes = null;
  {
    const r = await parse("doc-apply.docx");
    check("parse ok", r.ok === true, r);
    applyModel = r.model;
    check("jenis blok sesuai rancangan", eq(applyModel.blocks.map(b => b.type),
      ["heading", "paragraph", "paragraph", "paragraph", "list-item", "paragraph", "paragraph", "table-cell", "table-cell", "paragraph"]),
      applyModel.blocks.map(b => b.type));
    applyAsm = diAssembleText(applyModel);
    check("paraMap identitas 0..9", eq(applyAsm.paraMap, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), applyAsm.paraMap);
    applyRes = wiAnalyze(applyAsm.text);
    const got = applyRes.suggestions.map(s => [s.pIdx, s.kind, s.original]);
    check("10 saran non-penasihat persis seperti terverifikasi", eq(got, [
      [0, "kata-tidak-baku", "Aktifitas"], [1, "kata-tidak-baku", "Aktifitas"], [1, "imbuhan", "di lakukan"],
      [2, "kata-tidak-baku", "aktifitas"], [3, "kata-tidak-baku", "Aktifitas"], [4, "kata-tidak-baku", "Aktifitas"],
      [4, "imbuhan", "di lakukan"], [5, "imbuhan", "di hitung"], [6, "double-space", "  "], [7, "imbuhan", "di lakukan"],
    ]), got);
    check("tidak ada saran penasihat pada fixture", applyRes.suggestions.every(s => !s.advisory));
  }

  console.log("25) D3 — diSyncModel: jalur cepat = paraMap, masukan array identik");
  {
    const sync = diSyncModel(applyModel, applyAsm.text);
    check("semua paragraf matched", sync.align.every(a => a.status === "matched"), sync.align);
    check("blockIdx hasil sync == paraMap", eq(sync.align.map(a => a.blockIdx), applyAsm.paraMap));
    const syncArr = diSyncModel(applyModel, applyRes.paragraphs);
    check("masukan array (wiResult.paragraphs) identik", eq(syncArr.align, sync.align));
    const syncCrlf = diSyncModel(applyModel, applyAsm.text.replace(/\n\n/g, "\r\n\r\n"));
    check("CRLF dinormalisasi seperti wiAnalyze", eq(syncCrlf.align, sync.align));
  }

  console.log("26) D3 — pemetaan per jenis blok + contoh terkerjakan");
  let mappedAll = null;
  {
    const sync = diSyncModel(applyModel, applyRes.paragraphs);
    mappedAll = diMapAll(applyModel, sync, applyRes.suggestions);
    const bySug = {};
    applyRes.suggestions.forEach((s, i) => { bySug[s.pIdx + ":" + s.kind + ":" + s.original] = mappedAll[i]; });
    const mHead = bySug["0:kata-tidak-baku:Aktifitas"];
    check("heading: applicable di blok 0 run 0", mHead.status === "applicable" && mHead.blockIdx === 0 && mHead.runIdx === 0 && mHead.startInRun === 0 && mHead.endInRun === 9, mHead);
    const mBold = bySug["2:kata-tidak-baku:aktifitas"];
    check("CONTOH BERHASIL — run tebal: blok 2, run 1, [0,9), expected 'aktifitas'",
      mBold.status === "applicable" && mBold.blockIdx === 2 && mBold.runIdx === 1 &&
      mBold.startInRun === 0 && mBold.endInRun === 9 && mBold.expected === "aktifitas", mBold);
    const mImb = bySug["1:imbuhan:di lakukan"];
    check("paragraf biasa: blok 1 run 0 [14,24)", mImb.status === "applicable" && mImb.blockIdx === 1 && mImb.runIdx === 0 && mImb.startInRun === 14 && mImb.endInRun === 24, mImb);
    check("daftar: kedua saran applicable di blok list-item 4",
      bySug["4:kata-tidak-baku:Aktifitas"].status === "applicable" && bySug["4:kata-tidak-baku:Aktifitas"].blockIdx === 4 &&
      bySug["4:imbuhan:di lakukan"].status === "applicable" && bySug["4:imbuhan:di lakukan"].blockIdx === 4);
    check("rumus tetangga: imbuhan applicable di blok 5 run 0",
      bySug["5:imbuhan:di hitung"].status === "applicable" && bySug["5:imbuhan:di hitung"].blockIdx === 5 && bySug["5:imbuhan:di hitung"].runIdx === 0);
    check("sel tabel: imbuhan applicable di blok table-cell 7",
      bySug["7:imbuhan:di lakukan"].status === "applicable" && bySug["7:imbuhan:di lakukan"].blockIdx === 7);
    const mCross = bySug["3:kata-tidak-baku:Aktifitas"];
    check("CONTOH DITOLAK — kata terbelah dua run: readonly/cross-run",
      mCross.status === "readonly" && mCross.reason === "cross-run" && /melintasi batas/.test(mCross.reasonText), mCross);
    const mProt = bySug["6:double-space:  "];
    check("CONTOH DITOLAK — spasi ganda melintasi OMML: readonly/protected",
      mProt.status === "readonly" && mProt.reason === "protected" && /terlindungi/.test(mProt.reasonText), mProt);
    check("ringkasan: 8 applicable + 2 readonly", mappedAll.filter(m => m.status === "applicable").length === 8 &&
      mappedAll.filter(m => m.status === "readonly").length === 2, mappedAll.map(m => m.status));
  }

  console.log("27) D3 — penerapan: hanya run sasaran berubah, model asli utuh");
  {
    const work = diCloneModel(applyModel);
    const bySug = {};
    applyRes.suggestions.forEach((s, i) => { bySug[s.pIdx + ":" + s.kind] = { s, m: mappedAll[i] }; });
    const bold = bySug["2:kata-tidak-baku"];
    const r1 = diApplyToModel(work, bold.m, bold.s.replacement);
    check("apply run tebal ok", r1.ok === true && r1.runIdx === 1, r1);
    check("teks run tebal menjadi 'aktivitas'", work.blocks[2].runs[1].text === "aktivitas", work.blocks[2].runs[1]);
    check("flag tebal dipertahankan", work.blocks[2].runs[1].bold === true);
    check("run tetangga tidak berubah", work.blocks[2].runs[0].text === "Kata " && work.blocks[2].runs[2].text === " pada run tebal ini harus baku.");
    check("jumlah run & blok tidak berubah", work.blocks[2].runs.length === 3 && work.blocks.length === 10);
    const imb = bySug["1:imbuhan"];
    const r2 = diApplyToModel(work, imb.m, imb.s.replacement);
    check("apply imbuhan ok", r2.ok === true, r2);
    check("blok 1 terevisi pada teks", diBlockText(work.blocks[1]) === "Aktifitas ini dilakukan setiap hari Senin.", diBlockText(work.blocks[1]));
    check("model asli TIDAK berubah (deep-equal hasil parse ulang)", eq(applyModel, (await parse("doc-apply.docx")).model));
    check("run terlindungi pada model kerja utuh (xml sama)", work.blocks[5].runs[1].protected === true &&
      work.blocks[5].runs[1].xml === applyModel.blocks[5].runs[1].xml && work.blocks[6].runs[1].xml === applyModel.blocks[6].runs[1].xml);
  }

  console.log("28) D3 — terima semua (simulasi loop UI): hitungan jujur + keadaan akhir");
  {
    const work = diCloneModel(applyModel);
    let applied = 0, refused = 0;
    applyRes.suggestions.forEach((s, i) => {
      const m = mappedAll[i];
      if (m.status !== "applicable") return;
      const r = diApplyToModel(work, m, s.replacement);
      if (r.ok) applied++; else refused++;
    });
    check("8 diterapkan, 0 ditolak", applied === 8 && refused === 0, applied + "/" + refused);
    check("heading terevisi", diBlockText(work.blocks[0]) === "Aktivitas kelompok tani", diBlockText(work.blocks[0]));
    check("blok 1 terevisi penuh", diBlockText(work.blocks[1]) === "Aktivitas ini dilakukan setiap hari Senin.");
    check("blok cross-run TIDAK berubah", diBlockText(work.blocks[3]) === "Aktifitas kelompok dicatat dengan rapi.");
    check("blok spasi-rumus TIDAK berubah", diBlockText(work.blocks[6]) === "Nilai akhir yaitu  untuk semua siswa.");
    check("sel tabel terevisi", diBlockText(work.blocks[7]) === "Data ini dilakukan kemarin.");
    check("daftar terevisi penuh", diBlockText(work.blocks[4]) === "Aktivitas rutin dilakukan tiap pekan.");
  }

  console.log("29) D3 — suntingan manual: paragraf berubah -> manual-edit, sisanya tetap applicable");
  {
    const paras = applyRes.paragraphs.slice();
    paras[1] = "Aktifitas ini di lakukan setiap hari Selasa."; /* satu kata disunting manual */
    const sync = diSyncModel(applyModel, paras);
    check("paragraf 1 berstatus edited", sync.align[1].status === "edited", sync.align[1]);
    check("paragraf lain tetap matched", sync.align.every((a, i) => i === 1 || a.status === "matched"), sync.align.map(a => a.status));
    const res2 = wiAnalyze(paras.join("\n\n"));
    const mapped2 = diMapAll(applyModel, sync, res2.suggestions);
    const inEdited = res2.suggestions.map((s, i) => [s, mapped2[i]]).filter(([s]) => s.pIdx === 1);
    check("saran pada paragraf suntingan: readonly/manual-edit", inEdited.length === 2 &&
      inEdited.every(([, m]) => m.status === "readonly" && m.reason === "manual-edit"), inEdited.map(([, m]) => m.reason));
    const inHead = res2.suggestions.map((s, i) => [s, mapped2[i]]).filter(([s]) => s.pIdx === 0);
    check("saran heading tetap applicable", inHead.length === 1 && inHead[0][1].status === "applicable");
    /* paragraf dihapus dari tengah: paragraf sesudahnya tetap menemukan bloknya */
    const parasCut = applyRes.paragraphs.filter((_, i) => i !== 1);
    const syncCut = diSyncModel(applyModel, parasCut);
    check("paragraf terhapus tidak menggeser pemetaan sisanya",
      syncCut.align.every(a => a.status === "matched") && syncCut.align[1].blockIdx === 2 && syncCut.align[8].blockIdx === 9,
      syncCut.align.map(a => a.blockIdx));
  }

  console.log("30) D3 — duplikat & urutan rakus (greedy in-order)");
  {
    const model = { format: "docx", tables: [], blocks: [
      { id: "b0", type: "paragraph", runs: [{ text: "Isi sama." }] },
      { id: "b1", type: "paragraph", runs: [{ text: "Isi lain." }] },
      { id: "b2", type: "paragraph", runs: [{ text: "Isi sama." }] },
    ] };
    const sync = diSyncModel(model, ["Isi sama.", "Isi sama."]);
    check("duplikat mengonsumsi blok berurutan: [0, 2]", eq(sync.align.map(a => a.blockIdx), [0, 2]), sync.align);
    const syncEmpty = diSyncModel(model, ["", "Isi sama."]);
    check("paragraf kosong berstatus empty, bukan edited", syncEmpty.align[0].status === "empty" && syncEmpty.align[1].blockIdx === 0, syncEmpty.align);
  }

  console.log("31) D3 — validasi ulang saat apply: pergeseran offset, stale, ambigu, konflik");
  {
    const mkModel = (text) => ({ format: "docx", tables: [], blocks: [{ id: "b0", type: "paragraph", runs: [{ text }] }] });
    /* dua saran berurutan dalam run yang sama: yang kedua bergeser sesudah yang pertama diterapkan */
    const text = "Kemarin di lakukan dan di lakukan lagi.";
    const model = mkModel(text);
    const res = wiAnalyze(text);
    const sync = diSyncModel(model, res.paragraphs);
    const maps = diMapAll(model, sync, res.suggestions);
    check("dua imbuhan sama-sama applicable", maps.length === 2 && maps.every(m => m.status === "applicable"), maps);
    const work = diCloneModel(model);
    const a1 = diApplyToModel(work, maps[0], res.suggestions[0].replacement);
    check("apply pertama ok pada offset tercatat", a1.ok === true && a1.startInRun === 8, a1);
    const a2 = diApplyToModel(work, maps[1], res.suggestions[1].replacement);
    check("apply kedua ok lewat pencarian kemunculan tunggal (offset bergeser)", a2.ok === true && a2.startInRun === 22, a2);
    check("hasil akhir run benar", work.blocks[0].runs[0].text === "Kemarin dilakukan dan dilakukan lagi.", work.blocks[0].runs[0].text);
    /* stale: menerapkan peta yang sama dua kali — teks asal sudah hilang */
    const modelB = mkModel("Aktifitas tercatat.");
    const resB = wiAnalyze("Aktifitas tercatat.");
    const mapB = diMapAll(modelB, diSyncModel(modelB, resB.paragraphs), resB.suggestions)[0];
    const workB = diCloneModel(modelB);
    check("apply pertama (stale-test) ok", diApplyToModel(workB, mapB, "Aktivitas").ok === true);
    const stale = diApplyToModel(workB, mapB, "Aktivitas");
    check("apply ulang peta sama -> stale, tanpa perubahan", stale.ok === false && stale.reason === "stale" &&
      workB.blocks[0].runs[0].text === "Aktivitas tercatat.", stale);
    /* konflik: rentang lain yang teks asalnya hancur oleh penerapan pertama */
    const workC = diCloneModel(modelB);
    diApplyToModel(workC, mapB, "Aktivitas");
    const conflict = diApplyToModel(workC, { status: "applicable", blockIdx: 0, runIdx: 0, startInRun: 0, endInRun: 8, expected: "Aktifita" }, "X");
    check("konflik rentang tumpang-tindih -> stale", conflict.ok === false && conflict.reason === "stale", conflict);
    /* ambigu: teks asal muncul dua kali dan offset tercatat salah */
    const modelD = mkModel("di lakukan lalu di lakukan.");
    const workD = diCloneModel(modelD);
    const amb = diApplyToModel(workD, { status: "applicable", blockIdx: 0, runIdx: 0, startInRun: 3, endInRun: 13, expected: "di lakukan" }, "dilakukan");
    check("kemunculan ganda + offset meleset -> ambiguous, tanpa perubahan", amb.ok === false && amb.reason === "ambiguous" &&
      workD.blocks[0].runs[0].text === "di lakukan lalu di lakukan.", amb);
    /* peta readonly tidak pernah dapat diterapkan */
    const ro = diApplyToModel(workD, { status: "readonly", reason: "cross-run" }, "x");
    check("peta readonly ditolak diApplyToModel", ro.ok === false && ro.reason === "cross-run", ro);
  }

  console.log("32) D3 — field terlindungi (sintetis) & saran penasihat");
  {
    const model = { format: "docx", tables: [], blocks: [{ id: "b0", type: "paragraph", runs: [
      { text: "Hasil " },
      { text: "42", protected: true, kind: "field", xml: "<w:fldSimple w:instr=\" PAGE \"/>" },
      { text: " halaman berisi aktifitas." },
    ] }] };
    check("teks blok melompati field", diBlockText(model.blocks[0]) === "Hasil  halaman berisi aktifitas.", diBlockText(model.blocks[0]));
    const res = wiAnalyze(diAssembleText(model).text);
    const sync = diSyncModel(model, res.paragraphs);
    const maps = diMapAll(model, sync, res.suggestions);
    const ds = res.suggestions.findIndex(s => s.kind === "double-space");
    check("spasi ganda di junction field -> protected", ds >= 0 && maps[ds].status === "readonly" && maps[ds].reason === "protected", ds >= 0 ? maps[ds] : res.suggestions);
    const bk = res.suggestions.findIndex(s => s.kind === "kata-tidak-baku");
    check("baku sesudah field pada run sendiri -> applicable (run 2)", bk >= 0 && maps[bk].status === "applicable" && maps[bk].runIdx === 2, bk >= 0 ? maps[bk] : null);
    const work = diCloneModel(model);
    const ap = diApplyToModel(work, maps[bk], res.suggestions[bk].replacement);
    check("apply di samping field ok; field utuh", ap.ok === true && work.blocks[0].runs[1].xml === model.blocks[0].runs[1].xml &&
      work.blocks[0].runs[2].text === " halaman berisi aktivitas.", work.blocks[0].runs.map(r => r.text));
    /* saran penasihat tidak pernah dipetakan sebagai applicable */
    const longText = "Kalimat " + "yang sangat panjang dan berbelit dengan banyak anak kalimat yang terus bersambung tanpa henti untuk menguji saran penasihat ".repeat(3) + "selesai.";
    const resAdv = wiAnalyze(longText);
    const adv = resAdv.suggestions.find(s => s.advisory);
    check("fixture penasihat ditemukan", !!adv, resAdv.suggestions.map(s => s.kind));
    if (adv) {
      const mAdv = diMapSuggestion(model, sync, adv);
      check("penasihat -> status advisory (tidak dapat diterapkan)", mAdv.status === "advisory", mAdv);
    }
  }

  console.log("33) D3 — undo (snapshot) & determinisme pemetaan");
  {
    const work = diCloneModel(applyModel);
    const snap = diCloneModel(work);
    const bySug = {};
    applyRes.suggestions.forEach((s, i) => { bySug[s.pIdx + ":" + s.kind] = { s, m: mappedAll[i] }; });
    diApplyToModel(work, bySug["0:kata-tidak-baku"].m, "Aktivitas");
    diApplyToModel(work, bySug["1:imbuhan"].m, "dilakukan");
    check("model kerja berubah sesudah dua apply", !eq(work, snap));
    const restored = snap; /* pola Urungkan UI: snapshot terakhir dipulihkan */
    check("snapshot memulihkan keadaan persis (deep-equal klon awal)", eq(restored, diCloneModel(applyModel)));
    const sync2 = diSyncModel(applyModel, applyRes.paragraphs);
    const maps2 = diMapAll(applyModel, sync2, applyRes.suggestions);
    check("pemetaan dua kali deep-equal (deterministik)", eq(maps2, mappedAll));
    const clone = diCloneModel(applyModel);
    check("klon deep-equal tetapi bukan referensi sama", eq(clone, applyModel) && clone !== applyModel && clone.blocks[0] !== applyModel.blocks[0]);
    check("taksonomi alasan lengkap", ["manual-edit", "cross-run", "protected", "text-mismatch", "cross-block", "no-block"].every(k => typeof DI_MAP_REASON_TEXT[k] === "string"));
    /* text-mismatch: peta dihitung dari model yang sudah berubah isinya */
    const diverged = diCloneModel(applyModel);
    diverged.blocks[1].runs[0].text = "Teks yang sama sekali berbeda.";
    const syncD = { paragraphs: applyRes.paragraphs, align: applyRes.paragraphs.map((_, i) => ({ status: "matched", blockIdx: i })), textBlocks: 10 };
    const mDiv = diMapSuggestion(diverged, syncD, applyRes.suggestions[1]);
    check("blok berubah isi -> text-mismatch", mDiv.status === "readonly" && mDiv.reason === "text-mismatch", mDiv);
  }

  console.log("34) D4 — diModelToHtml: struktur, format, tautan, escaping");
  {
    const fmt = (await parse("formatting.docx")).model;
    const h = diModelToHtml(fmt);
    check("run tebal -> <strong>", h.includes("<strong>tebal</strong>"), h);
    check("run miring -> <em>", h.includes("<em>miring</em>"));
    check("run garis bawah -> <u>", h.includes("<u>garis bawah</u>"));
    check("tebal+miring bersarang strong>em", h.includes("<strong><em>tebal miring</em></strong>"));
    check("font Georgia + 12pt -> span style", h.includes("font-family:'Georgia'") && h.includes("font-size:12pt"), h);
    check("tautan https -> <a href>", h.includes('<a href="https://saksara.vercel.app">'), h);
    const hd = diModelToHtml((await parse("headings.docx")).model);
    check("heading 1 -> <h1>", hd.includes("<h1>Bab Satu Pendahuluan</h1>"), hd);
    check("heading 2 -> <h2>", hd.includes("<h2>Latar Belakang</h2>"));
    const ls = diModelToHtml((await parse("lists.docx")).model);
    const ulPart = ls.slice(ls.indexOf("<ul>"), ls.indexOf("</ul>"));
    const olPart = ls.slice(ls.indexOf("<ol>"), ls.indexOf("</ol>"));
    check("daftar bullet -> satu <ul> dengan 3 <li>", (ls.match(/<ul>/g) || []).length === 1 && (ulPart.match(/<li>/g) || []).length === 3, ls);
    check("daftar nomor -> satu <ol> dengan 2 <li>", (ls.match(/<ol>/g) || []).length === 1 && (olPart.match(/<li>/g) || []).length === 2, ls);
    check("urutan ul sebelum ol", ls.indexOf("<ul>") < ls.indexOf("<ol>"));
    const tb = diModelToHtml((await parse("table.docx")).model);
    check("gridSpan -> colspan=2", tb.includes('<td colspan="2">'), tb);
    check("vMerge restart -> rowspan=2", tb.includes('rowspan="2"'), tb);
    check("vMerge continue -> sel kosong berkelas", tb.includes('<td class="di-vmerge-cont"></td>'), tb);
    const eqm = diModelToHtml((await parse("equation.docx")).model);
    check("OMML -> span.di-prot berisi teks linear", eqm.includes('<span class="di-prot">ab</span>'), eqm);
    /* Escaping: teks dokumen tidak boleh lolos sebagai markup */
    const evil = { format: "docx", tables: [], blocks: [
      { id: "b0", type: "paragraph", runs: [{ text: '<script>alert("x")</script> & "kutip" <b>palsu</b>' }] },
      { id: "b1", type: "paragraph", runs: [{ text: "klik", link: "javascript:alert(1)" }] },
      { id: "b2", type: "paragraph", runs: [{ text: "surel", link: "mailto:halo@example.id" }] },
      { id: "b3", type: "paragraph", runs: [{ text: "data", link: "data:text/html;base64,PHNjcmlwdD4=" }] },
      { id: "b4", type: "paragraph", runs: [{ text: "spasi", link: "  https://example.id/a?x=1&y=2  " }] },
    ] };
    const eh = diModelToHtml(evil);
    check("teks <script> ter-escape penuh", !eh.includes("<script>") && eh.includes("&lt;script&gt;"), eh);
    check("ampersand ter-escape", eh.includes("&amp;"));
    check("tautan javascript: -> teks biasa (tanpa <a>)", !eh.includes("javascript:") && eh.includes("<p>klik</p>"), eh);
    check("tautan data: -> teks biasa", !eh.includes("data:text/html"), eh);
    check("tautan mailto: dirender", eh.includes('<a href="mailto:halo@example.id">surel</a>'), eh);
    check("href di-trim + & ter-escape di atribut", eh.includes('<a href="https://example.id/a?x=1&amp;y=2">spasi</a>'), eh);
    check("diLinkSafe menolak skema lain", diLinkSafe("ftp://x") === null && diLinkSafe("HTTPS://a.b") === "HTTPS://a.b" && diLinkSafe("") === null && diLinkSafe(42) === null);
    /* Daftar bersarang: level 0,1,1,0 */
    const nest = { format: "docx", tables: [], blocks: ["a", "b", "c", "d"].map((t, i) => ({
      id: "b" + i, type: "list-item", listKind: "bullet", level: [0, 1, 1, 0][i], runs: [{ text: t }],
    })) };
    check("daftar bersarang valid", diModelToHtml(nest) === "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>", diModelToHtml(nest));
    /* Teks biasa = rakitan yang sama persis */
    const sm = (await parse("simple.docx")).model;
    check("diModelToPlainText == diAssembleText", diModelToPlainText(sm) === diAssembleText(sm).text);
    check("diModelToHtml deterministik", diModelToHtml(fmt) === h);
  }

  console.log("35) D4 — diExportWarnings: hitungan per jenis + urutan deterministik");
  {
    const eqm = (await parse("equation.docx")).model;
    check("equation.docx -> [protected-omml x1]", eq(diExportWarnings(eqm).map(w => [w.kind, w.count]), [["protected-omml", 1]]), diExportWarnings(eqm));
    const apm = (await parse("doc-apply.docx")).model;
    check("doc-apply.docx -> [protected-omml x2]", eq(diExportWarnings(apm).map(w => [w.kind, w.count]), [["protected-omml", 2]]));
    const fmt = (await parse("formatting.docx")).model;
    check("formatting.docx -> tanpa peringatan", eq(diExportWarnings(fmt), []));
    const syn = { format: "docx", tables: [], blocks: [
      { id: "b0", type: "paragraph", runs: [
        { text: "x", protected: true, kind: "field", xml: "<w:r/>" },
        { text: "", protected: true, kind: "object", xml: "<w:r/>" },
        { text: "garis", underline: true, underlineStyle: "double" },
        { text: "biasa", underline: true },
      ] },
    ] };
    check("field+object+underline-style terhitung, urutan tetap",
      eq(diExportWarnings(syn).map(w => [w.kind, w.count]),
        [["protected-field", 1], ["protected-object", 1], ["underline-style", 1]]), diExportWarnings(syn));
    const pdfModel = diPdfPagesToModel([{ page: 1, items: [{ str: "Halo dunia", x: 56, y: 700, width: 60, fontName: "Helvetica", fontSize: 12 }] }]);
    check("model PDF -> pdf-source (count = halaman)", eq(diExportWarnings(pdfModel).map(w => [w.kind, w.count]), [["pdf-source", 1]]), diExportWarnings(pdfModel));
    check("peringatan deterministik", eq(diExportWarnings(syn), diExportWarnings(syn)));
    check("pesan peringatan tidak kosong", diExportWarnings(syn).every(w => typeof w.message === "string" && w.message.length > 10));
  }

  console.log("36) D4 — diDiffModels: unchanged/changed/added/removed + segmen");
  {
    const sm = (await parse("simple.docx")).model;
    const same = diDiffModels(sm, diCloneModel(sm));
    check("model identik -> changedCount 0", same.changedCount === 0 && same.entries.every(e => e.status === "unchanged"), same.changedCount);
    const work = diCloneModel(sm);
    work.blocks[0].runs[0].text = work.blocks[0].runs[0].text.replace("Senin", "Selasa");
    const d = diDiffModels(sm, work);
    check("satu blok berubah", d.changedCount === 1 && d.entries[0].status === "changed" && d.entries[1].status === "unchanged");
    const segs = d.entries[0].segments;
    const recon = (t) => segs.filter(s => s.t === "same" || s.t === t).map(s => s.text).join("");
    check("segmen merekonstruksi teks asli", recon("del") === d.entries[0].origText, segs);
    check("segmen merekonstruksi teks kerja", recon("ins") === d.entries[0].workText, segs);
    check("del memuat kata lama, ins kata baru",
      segs.some(s => s.t === "del" && s.text.includes("Senin")) && segs.some(s => s.t === "ins" && s.text.includes("Selasa")), segs);
    /* Perubahan spasi saja terlihat lewat token separator */
    const sp = diDiffSegments("kata  ganda", "kata ganda");
    check("diff spasi ganda -> del '  ' ins ' '",
      sp.some(s => s.t === "del" && s.text === "  ") && sp.some(s => s.t === "ins" && s.text === " "), sp);
    const longer = diCloneModel(sm);
    longer.blocks.push({ id: "bx", type: "paragraph", runs: [{ text: "Blok tambahan." }] });
    const dAdd = diDiffModels(sm, longer);
    check("blok ekstra di kerja -> added", dAdd.entries[dAdd.entries.length - 1].status === "added" && dAdd.changedCount === 1);
    const dRem = diDiffModels(longer, sm);
    check("blok hilang di kerja -> removed", dRem.entries[dRem.entries.length - 1].status === "removed" && dRem.changedCount === 1);
    /* Tidak mengubah kedua model */
    const snapA = JSON.stringify(sm), snapB = JSON.stringify(work);
    diDiffModels(sm, work);
    check("diDiffModels tidak memutasi model", JSON.stringify(sm) === snapA && JSON.stringify(work) === snapB);
    check("diDiffModels deterministik", eq(diDiffModels(sm, work), d));
    const hd = (await parse("headings.docx")).model;
    const hdW = diCloneModel(hd);
    hdW.blocks[0].runs[0].text = "Bab Satu Pembuka";
    const dHd = diDiffModels(hd, hdW);
    check("blok heading berubah membawa type heading", dHd.entries[0].status === "changed" && dHd.entries[0].type === "heading");
  }

  console.log("37) D4 — fixture doc-roundtrip.docx: struktur terpaku untuk round-trip peramban");
  {
    const r = await parse("doc-roundtrip.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("urutan tipe blok", eq(m.blocks.map(b => b.type),
      ["heading", "paragraph", "list-item", "list-item", "list-item", "list-item",
       "table-cell", "table-cell", "table-cell", "table-cell", "table-cell",
       "paragraph", "paragraph", "paragraph"]), m.blocks.map(b => b.type));
    check("heading level 1", m.blocks[0].type === "heading" && m.blocks[0].level === 1);
    check("jenis daftar bullet,bullet,number,number", eq(m.blocks.slice(2, 6).map(b => b.listKind), ["bullet", "bullet", "number", "number"]));
    check("tabel satu, gridSpan 2 + vMerge restart/continue",
      m.tables.length === 1 && m.tables[0].rows[0].cells[0].gridSpan === 2 &&
      m.tables[0].rows[1].cells[0].vMerge === "restart" && m.tables[0].rows[2].cells[0].vMerge === "continue",
      JSON.stringify(m.tables));
    const linkRun = m.blocks[1].runs.find(x => x.link);
    check("run tautan terbaca", !!linkRun && linkRun.link === "https://saksara.vercel.app", m.blocks[1].runs);
    check("run tebal/miring/garis bawah terbaca",
      m.blocks[1].runs.some(x => x.bold) && m.blocks[1].runs.some(x => x.italic) && m.blocks[1].runs.some(x => x.underline));
    check("run Georgia 12pt terbaca", m.blocks[1].runs.some(x => x.fontName === "Georgia" && x.fontSize === 12));
    check("teks unicode utuh", blockText(m.blocks[11]).includes("✓") && blockText(m.blocks[11]).includes("😀"), blockText(m.blocks[11]));
    check("OMML terlindungi di blok 12", m.blocks[12].runs.some(x => x.protected && x.kind === "omml"), m.blocks[12].runs);
    check("paragraf pelanggaran baku utuh", blockText(m.blocks[13]) === "Aktifitas ini di lakukan setiap hari Senin.", blockText(m.blocks[13]));
    const asm = diAssembleText(m);
    const res = wiAnalyze(asm.text);
    const sync = diSyncModel(m, res.paragraphs);
    const mapped = diMapAll(m, sync, res.suggestions);
    const appl = res.suggestions.filter((s, i) => mapped[i].status === "applicable");
    check("ada saran applicable untuk langkah round-trip", appl.length >= 2, appl.length);
  }

  console.log("38) D4 — dokumen besar mendekati batas 50.000 karakter (big.docx)");
  {
    const r = await parse("big.docx");
    check("parse ok", r.ok === true, r);
    const asm = diAssembleText(r.model);
    check("rakitan tidak terpotong", asm.truncated === false, asm.totalChars);
    check("panjang rakitan 48–50 ribu", asm.text.length >= 48000 && asm.text.length <= 50000, asm.text.length);
    check("HTML dokumen besar terbangun", diModelToHtml(r.model).length > asm.text.length);
    check("dokumen besar bersih -> tanpa peringatan", eq(diExportWarnings(r.model), []));
    check("diff dokumen besar identik -> 0 berubah", diDiffModels(r.model, diCloneModel(r.model)).changedCount === 0);
    check("teks biasa dokumen besar == rakitan", diModelToPlainText(r.model) === asm.text);
  }

  console.log("39) D4.1 F3 — tabel bersarang: flag impor + peringatan nested-table");
  {
    const r = await parse("nested.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("dua tabel tercatat (luar + dalam)", m.tables.length === 2, m.tables.length);
    check("flags.nestedTables = 1", !!m.flags && m.flags.nestedTables === 1, m.flags);
    check("peringatan persis [nested-table x1]", eq(diExportWarnings(m).map(w => [w.kind, w.count]), [["nested-table", 1]]), diExportWarnings(m));
    const asm = diAssembleText(m);
    check("teks sel dalam ikut rakitan", asm.text.includes("Sel dalam satu.") && asm.text.includes("Sel dalam dua."), asm.text);
    const t = (await parse("table.docx")).model;
    check("table.docx tanpa flag", t.flags === undefined, t.flags);
    check("table.docx tanpa peringatan nested-table", !diExportWarnings(t).some(w => w.kind === "nested-table"));
    const rt = (await parse("doc-roundtrip.docx")).model;
    check("doc-roundtrip.docx tanpa peringatan nested-table", !diExportWarnings(rt).some(w => w.kind === "nested-table"));
  }

  console.log("40) D4.1 F4 — tautan skema non-aman: peringatan link-scheme");
  {
    const r = await parse("links-unsafe.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    const links = [];
    m.blocks.forEach(b => b.runs.forEach(x => { if (x.link) links.push(x.link); }));
    check("tiga tautan tercatat", eq(links, ["https://saksara.vercel.app", "ftp://berkas.contoh.id/berkas.zip", "dokumen-relatif.docx"]), links);
    check("peringatan persis [link-scheme x1] (hanya ftp)", eq(diExportWarnings(m).map(w => [w.kind, w.count]), [["link-scheme", 1]]), diExportWarnings(m));
    const h = diModelToHtml(m);
    check("https tetap dirender sebagai tautan", h.includes('<a href="https://saksara.vercel.app">'), h);
    check("ftp TIDAK dirender sebagai tautan", !h.includes('href="ftp:'), h);
    check("diLinkScheme: HTTPS besar -> https", diLinkScheme("HTTPS://a.b") === "https");
    check("diLinkScheme: FTP besar -> ftp", diLinkScheme("FTP://x") === "ftp");
    check("diLinkScheme: relatif -> null", diLinkScheme("dokumen-relatif.docx") === null);
    check("diLinkScheme: jangkar -> null", diLinkScheme("#jangkar") === null);
    check("diLinkScheme: mailto ber-spasi -> mailto", diLinkScheme("  mailto:a@b.id ") === "mailto");
    check("diLinkScheme: javascript terdeteksi sebagai skema", diLinkScheme("javascript:alert(1)") === "javascript");
    check("diLinkScheme: non-string -> null", diLinkScheme(42) === null && diLinkScheme(null) === null);
    check("diLinkSafe tetap menolak ftp & javascript", diLinkSafe("ftp://x") === null && diLinkSafe("javascript:alert(1)") === null);
  }

  console.log("41) D4.1 F5 — nama gaya heading kustom: peringatan heading-style");
  {
    const r = await parse("heading-custom.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("blok 0 heading kustom", m.blocks[0].type === "heading" && m.blocks[0].level === 1 &&
      m.blocks[0].styleId === "BabKhusus" && m.blocks[0].styleName === "Bab Khusus", m.blocks[0]);
    check("blok 2 heading bawaan", m.blocks[2].type === "heading" && m.blocks[2].level === 2 &&
      m.blocks[2].styleId === "Heading2", m.blocks[2]);
    check("peringatan persis [heading-style x1]", eq(diExportWarnings(m).map(w => [w.kind, w.count]), [["heading-style", 1]]), diExportWarnings(m));
    const hd = (await parse("headings.docx")).model;
    check("headings.docx styleId bawaan tercatat", hd.blocks[0].styleId === "Heading1", hd.blocks[0]);
    check("headings.docx tanpa peringatan apa pun", eq(diExportWarnings(hd), []));
    check("detektor: styleId bawaan -> bukan kustom", diHeadingStyleCustom({ type: "heading", styleId: "Heading3", styleName: "Apa Saja" }) === false);
    check("detektor: nama 'judul 2' terlokalisasi -> bukan kustom", diHeadingStyleCustom({ type: "heading", styleName: "judul 2" }) === false);
    check("detektor: nama 'heading 4' -> bukan kustom", diHeadingStyleCustom({ type: "heading", styleName: "heading 4" }) === false);
    check("detektor: tanpa identitas gaya -> bukan kustom", diHeadingStyleCustom({ type: "heading", level: 1 }) === false);
    check("detektor: gaya bernama sendiri -> kustom", diHeadingStyleCustom({ type: "heading", styleId: "GayaSaya", styleName: "Gaya Saya" }) === true);
    check("detektor: paragraf bergaya apa pun -> bukan kustom", diHeadingStyleCustom({ type: "paragraph", styleId: "GayaSaya", styleName: "Gaya Saya" }) === false);
  }

  console.log("42) D4.1 F6 — indentasi: hitungan blok bukan-nol, khusus salin");
  {
    const r = await parse("indent.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("indent left 720 tercatat", !!m.blocks[0].indent && m.blocks[0].indent.left === 720, m.blocks[0].indent);
    check("indent firstLine 360 tercatat", !!m.blocks[1].indent && m.blocks[1].indent.firstLine === 360, m.blocks[1].indent);
    check("diModelIndentCount = 2 (nol eksplisit tidak terhitung)", diModelIndentCount(m) === 2, diModelIndentCount(m));
    check("indent.docx tanpa peringatan ekspor (F6 khusus salin)", eq(diExportWarnings(m), []), diExportWarnings(m));
    const sm = (await parse("simple.docx")).model;
    check("simple.docx indent count 0", diModelIndentCount(sm) === 0);
    check("sintetis: {left:0} -> 0", diModelIndentCount({ format: "docx", tables: [], blocks: [{ id: "b0", type: "paragraph", indent: { left: 0 }, runs: [{ text: "x" }] }] }) === 0);
    check("sintetis: {hanging:240} -> 1", diModelIndentCount({ format: "docx", tables: [], blocks: [{ id: "b0", type: "paragraph", indent: { hanging: 240 }, runs: [{ text: "x" }] }] }) === 1);
    check("model PDF indent count 0", diModelIndentCount(diPdfPagesToModel([{ page: 1, items: [{ str: "Halo", x: 1, y: 2, width: 10, fontName: "Helvetica", fontSize: 12 }] }])) === 0);
  }

  console.log("43) D4.1 F7 — flag bagian pendamping: header/footer, catatan kaki, komentar, track changes");
  {
    const r = await parse("parts.docx");
    check("parse ok", r.ok === true, r);
    const m = r.model;
    check("flags headerFooter+footnotes+comments terpasang", !!m.flags && m.flags.headerFooter === true && m.flags.footnotes === true && m.flags.comments === true, m.flags);
    check("flags trackedChanges tidak terpasang", !(m.flags && m.flags.trackedChanges));
    const asm = diAssembleText(m);
    check("isi header/footer tidak ikut rakitan", !asm.text.includes("Kepala halaman") && !asm.text.includes("Kaki halaman"), asm.text);
    check("isi catatan kaki/komentar tidak ikut rakitan", !asm.text.includes("Catatan kaki sungguhan") && !asm.text.includes("Komentar penguji pada"), asm.text);
    check("isi utama tetap utuh", asm.text.includes("Bagian yang dikomentari penguji.") && asm.text.includes("Ada catatan kaki"), asm.text);
    const tr = (await parse("tracked.docx")).model;
    check("tracked.docx flags.trackedChanges terpasang", !!tr.flags && tr.flags.trackedChanges === true, tr.flags);
    check("tracked.docx tanpa flag lain", !(tr.flags && (tr.flags.headerFooter || tr.flags.footnotes || tr.flags.comments || tr.flags.nestedTables)), tr.flags);
    const sep = (await parse("footnotes-sep.docx")).model;
    check("footnotes-sep.docx (separator saja) -> tanpa flags", sep.flags === undefined, sep.flags);
    const sm = (await parse("simple.docx")).model;
    check("simple.docx -> tanpa flags", sm.flags === undefined, sm.flags);
    const pdfM = diPdfPagesToModel([{ page: 1, items: [{ str: "Halo dunia", x: 56, y: 700, width: 60, fontName: "Helvetica", fontSize: 12 }] }]);
    check("model PDF -> tanpa flags", pdfM.flags === undefined, pdfM.flags);
    const scan1 = diScanPartFlags(diParseXml('<w:document xmlns:w="urn:x"><w:body><w:p><w:ins><w:r><w:t>x</w:t></w:r></w:ins></w:p></w:body></w:document>'));
    check("diScanPartFlags: ins -> trackedChanges", scan1.trackedChanges === true && scan1.commentRefs === false && scan1.footnoteRefs === false, scan1);
    const scan2 = diScanPartFlags(diParseXml('<w:document xmlns:w="urn:x"><w:body><w:p><w:r><w:t>bersih</w:t></w:r></w:p></w:body></w:document>'));
    check("diScanPartFlags: dokumen bersih -> semua false", scan2.trackedChanges === false && scan2.commentRefs === false && scan2.footnoteRefs === false, scan2);
  }

  console.log("44) D4.1 — peringatan tidak memutasi model + deterministik + flag konsisten antar-parse");
  {
    const m1 = (await parse("parts.docx")).model;
    const m2 = (await parse("nested.docx")).model;
    const s1 = JSON.stringify(m1), s2 = JSON.stringify(m2);
    diExportWarnings(m1); diModelIndentCount(m1); diModelToHtml(m1);
    diExportWarnings(m2); diModelIndentCount(m2); diModelToHtml(m2);
    check("model parts.docx tidak berubah oleh peringatan", JSON.stringify(m1) === s1);
    check("model nested.docx tidak berubah oleh peringatan", JSON.stringify(m2) === s2);
    const p1 = (await parse("parts.docx")).model, p2 = (await parse("parts.docx")).model;
    check("flags konsisten antar dua parse", eq(p1.flags, p2.flags), [p1.flags, p2.flags]);
    const lu = (await parse("links-unsafe.docx")).model;
    check("peringatan link-scheme deterministik", eq(diExportWarnings(lu), diExportWarnings(lu)));
    const all = (await parse("heading-custom.docx")).model;
    check("klon model mempertahankan styleId heading", diCloneModel(all).blocks[0].styleId === "BabKhusus");
    const pc = diCloneModel(p1);
    check("klon model parts.docx mempertahankan flags", eq(pc.flags, p1.flags), pc.flags);
  }

  console.log("\nDI-CORE: " + pass + " lulus, " + fail + " gagal, total " + (pass + fail));
  if (fail > 0) process.exitCode = 1;
})().catch((e) => { console.error("di-test error:", e); process.exitCode = 1; });
