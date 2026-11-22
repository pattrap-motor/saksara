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
  " sandbox.diPdfErrorInfo = diPdfErrorInfo; sandbox.diSniffFormat = diSniffFormat;")(sandbox);
const { diParseDocx, diAssembleText, diModelStats, diParseXml, diSerializeXml, DI_CAPS, DI_MAX_ANALYSIS_CHARS,
  diPdfPagesToModel, diPdfTextStats, diPdfErrorInfo, diSniffFormat } = sandbox;

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

  console.log("\nDI-CORE: " + pass + " lulus, " + fail + " gagal, total " + (pass + fail));
  if (fail > 0) process.exitCode = 1;
})().catch((e) => { console.error("di-test error:", e); process.exitCode = 1; });
