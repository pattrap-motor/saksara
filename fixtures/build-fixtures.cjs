/* Document Intelligence (D1) — pembangun fixtures .docx untuk di-test.cjs.
   Menulis ZIP minimal yang valid (entri stored atau deflate, CRC32 benar)
   dengan waktu DOS tetap agar keluaran deterministik. Jalankan:
   node fixtures/build-fixtures.cjs  (menulis ulang semua fixtures/*.docx) */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- Penulis ZIP (stored / deflate mentah) ---------- */
const DOS_TIME = 0;                                   /* 00:00:00 */
const DOS_DATE = (((2026 - 1980) << 9) | (1 << 5) | 1) >>> 0; /* 2026-01-01 */
function zipWrite(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const method = e.deflate ? 8 : 0;
    const comp = e.deflate ? zlib.deflateRawSync(data, { level: 9 }) : data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10); ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14);
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

/* ---------- Potongan DOCX ---------- */
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
function contentTypes(extra) {
  let s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>';
  if (extra && extra.styles) s += '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>';
  if (extra && extra.numbering) s += '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>';
  return s + "</Types>";
}
function documentXml(body) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    "<w:document " + W_NS + "><w:body>" + body + "</w:body></w:document>";
}
const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  "<w:styles " + W_NS + ">" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>' +
  "</w:styles>";
const NUMBERING_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  "<w:numbering " + W_NS + ">" +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  "</w:numbering>";
const DOC_RELS_LINK = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://saksara.vercel.app" TargetMode="External"/></Relationships>';

function docx(body, opts) {
  opts = opts || {};
  const entries = [
    { name: "[Content_Types].xml", data: contentTypes(opts), deflate: opts.deflate },
    { name: "_rels/.rels", data: ROOT_RELS, deflate: opts.deflate },
    { name: "word/document.xml", data: documentXml(body), deflate: opts.deflate },
  ];
  if (opts.styles) entries.push({ name: "word/styles.xml", data: STYLES_XML, deflate: opts.deflate });
  if (opts.numbering) entries.push({ name: "word/numbering.xml", data: NUMBERING_XML, deflate: opts.deflate });
  if (opts.rels) entries.push({ name: "word/_rels/document.xml.rels", data: DOC_RELS_LINK, deflate: opts.deflate });
  return zipWrite(entries);
}
const P = (inner) => "<w:p>" + inner + "</w:p>";
const R = (t) => '<w:r><w:t xml:space="preserve">' + t + "</w:t></w:r>";

/* ---------- Isi fixtures ---------- */
const FIXTURES = {};

/* Paragraf sederhana (memuat dua kesalahan yang dikenali WI agar QA hidup) */
FIXTURES["simple.docx"] = docx(
  P(R("Aktifitas ini di lakukan setiap hari Senin.")) +
  P(R("Paragraf kedua berisi kalimat biasa tanpa masalah.")) +
  P(R("Paragraf ketiga ") + R("menyambung kalimat yang sama."))
);

/* Heading lewat pStyle + styles.xml */
FIXTURES["headings.docx"] = docx(
  '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' + R("Bab Satu Pendahuluan") + "</w:p>" +
  P(R("Isi pendahuluan menjelaskan latar belakang penelitian.")) +
  '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' + R("Latar Belakang") + "</w:p>" +
  P(R("Isi latar belakang ditulis di sini.")),
  { styles: true }
);

/* Run berformat: tebal, miring, garis bawah, tebal+miring, font+ukuran, hyperlink */
FIXTURES["formatting.docx"] = docx(
  P(
    R("Teks biasa ") +
    '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">tebal</w:t></w:r>' +
    R(" dan ") +
    '<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">miring</w:t></w:r>' +
    R(" dan ") +
    '<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">garis bawah</w:t></w:r>' +
    R(" dan ") +
    '<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>tebal miring</w:t></w:r>' +
    R(".")
  ) +
  P('<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr><w:t>Teks Georgia dua belas poin.</w:t></w:r>') +
  P(
    R("Kunjungi ") +
    '<w:hyperlink r:id="rId5"><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>situs Saksara</w:t></w:r></w:hyperlink>' +
    R(" untuk info.")
  ),
  { rels: true }
);

/* Daftar bullet + bernomor lewat numbering.xml */
const LI = (numId, t) =>
  '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + numId + '"/></w:numPr></w:pPr>' + R(t) + "</w:p>";
FIXTURES["lists.docx"] = docx(
  LI(1, "Butir pertama daftar bullet.") + LI(1, "Butir kedua daftar bullet.") + LI(1, "Butir ketiga daftar bullet.") +
  LI(2, "Langkah pertama bernomor.") + LI(2, "Langkah kedua bernomor."),
  { numbering: true }
);

/* Tabel 2x2 dengan sel gabungan horizontal (gridSpan) + tabel kedua dengan vMerge */
FIXTURES["table.docx"] = docx(
  P(R("Tabel berikut merangkum data.")) +
  "<w:tbl>" +
    "<w:tr>" +
      '<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>' + P(R("Sel gabungan membentang dua kolom.")) + "</w:tc>" +
    "</w:tr>" +
    "<w:tr>" +
      "<w:tc>" + P(R("Kolom satu.")) + "</w:tc>" +
      "<w:tc>" + P(R("Kolom dua.")) + "</w:tc>" +
    "</w:tr>" +
  "</w:tbl>" +
  "<w:tbl>" +
    "<w:tr>" +
      '<w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr>' + P(R("Sel vertikal.")) + "</w:tc>" +
      "<w:tc>" + P(R("Baris satu kanan.")) + "</w:tc>" +
    "</w:tr>" +
    "<w:tr>" +
      '<w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>' +
      "<w:tc>" + P(R("Baris dua kanan.")) + "</w:tc>" +
    "</w:tr>" +
  "</w:tbl>" +
  P(R("Paragraf sesudah tabel."))
);

/* Rumus OMML di tengah paragraf */
FIXTURES["equation.docx"] = docx(
  P(
    R("Rumus pecahan berikut dipakai dalam perhitungan, yaitu ") +
    '<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>' +
    R(" untuk setiap percobaan.")
  )
);

/* Unicode & simbol Bahasa Indonesia */
FIXTURES["unicode.docx"] = docx(
  P(R("Simbol: ✓ → ± × ÷ dan “kutip lengkung” serta ‘tunggal’.")) +
  P(R("Harga Rp15.000,00 untuk Jum'at berkah; huruf é è dan emoji 😀 selesai."))
);

/* Campuran Bahasa Indonesia + istilah teknis */
FIXTURES["mixed.docx"] = docx(
  P(R("Sistem menggunakan API berbasis JSON untuk mengambil data dari endpoint server.")) +
  P(R("Pipeline CI/CD menjalankan unit test sebelum deployment ke production."))
);

/* Track changes: sisipan diterima, penghapusan dibuang */
FIXTURES["tracked.docx"] = docx(
  P(
    R("Kalimat awal ") +
    '<w:ins w:id="1" w:author="Penguji" w:date="2026-11-22T00:00:00Z">' + R("sisipan baru ") + "</w:ins>" +
    '<w:del w:id="2" w:author="Penguji" w:date="2026-11-22T00:00:00Z"><w:r><w:delText xml:space="preserve">teks lama terhapus </w:delText></w:r></w:del>' +
    R("tetap ada.")
  )
);

/* Dokumen kosong: satu paragraf kosong + satu hanya spasi */
FIXTURES["empty.docx"] = docx("<w:p/>" + P(R("   ")));

/* Semua entri ter-deflate (jalur inflate) */
FIXTURES["deflated.docx"] = docx(
  P(R("Dokumen ini seluruh entrinya terkompresi deflate.")) + P(R("Paragraf kedua deflate.")),
  { deflate: true }
);

/* Bom dekompresi untuk uji batas (dengan caps diturunkan): teks besar ter-deflate rapat */
FIXTURES["bomb.docx"] = docx(P(R("kata ".repeat(40000))), { deflate: true });

/* ZIP valid tanpa [Content_Types].xml maupun document.xml */
FIXTURES["notdocx.zip"] = zipWrite([{ name: "readme.txt", data: "Ini zip biasa, bukan dokumen Word." }]);

/* Ada [Content_Types].xml tetapi tidak ada word/document.xml */
FIXTURES["nodocument.docx"] = zipWrite([
  { name: "[Content_Types].xml", data: contentTypes({}) },
  { name: "word/styles.xml", data: STYLES_XML },
]);

/* D3: dokumen untuk uji pemetaan & penerapan saran (doc-apply.docx).
   Setiap blok dirancang memicu saran WI yang terverifikasi (lihat D3_REPORT):
   heading baku, paragraf biasa, run tebal, kata terbelah dua run (cross-run),
   butir daftar, rumus OMML dengan saran aman di run tetangga, rumus OMML
   dengan spasi ganda melintasinya (protected), dan sel tabel. */
const OMML_FRAC = '<m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath>';
FIXTURES["doc-apply.docx"] = docx(
  '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' + R("Aktifitas kelompok tani") + "</w:p>" +
  P(R("Aktifitas ini di lakukan setiap hari Senin.")) +
  P(
    R("Kata ") +
    '<w:r><w:rPr><w:b/></w:rPr><w:t>aktifitas</w:t></w:r>' +
    R(" pada run tebal ini harus baku.")
  ) +
  P(R("Aktifi") + R("tas") + R(" kelompok dicatat dengan rapi.")) +
  LI(1, "Aktifitas rutin di lakukan tiap pekan.") +
  P(R("Hasilnya di hitung dengan rumus") + OMML_FRAC + R(" secara teliti.")) +
  P(R("Nilai akhir yaitu ") + OMML_FRAC + R(" untuk semua siswa.")) +
  "<w:tbl><w:tr>" +
    "<w:tc>" + P(R("Data ini di lakukan kemarin.")) + "</w:tc>" +
    "<w:tc>" + P(R("Sel biasa tanpa masalah.")) + "</w:tc>" +
  "</w:tr></w:tbl>" +
  P(R("Paragraf penutup tanpa masalah apa pun.")),
  { styles: true, numbering: true }
);

/* Korup: simple.docx terpotong */
FIXTURES["corrupt.docx"] = FIXTURES["simple.docx"].subarray(0, Math.floor(FIXTURES["simple.docx"].length * 0.55));

/* ---------- Tulis semua ---------- */
const outDir = __dirname;
for (const name of Object.keys(FIXTURES)) {
  fs.writeFileSync(path.join(outDir, name), FIXTURES[name]);
  console.log("fixture:", name, FIXTURES[name].length, "byte");
}
