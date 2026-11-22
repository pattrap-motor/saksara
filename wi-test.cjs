/* Phase 8.1 — Node tests for the Writing Intelligence core (extracted from index.html). */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");

const coreRaw = html.split("WI-CORE-START")[1].split("/* WI-CORE-END */")[0];
const core = coreRaw.slice(coreRaw.indexOf("*/") + 2);

const sandbox = {};
new Function("sandbox", core +
  "\nsandbox.wiAnalyze = wiAnalyze; sandbox.wiApply = wiApply; sandbox.WI_MAX_CHARS = WI_MAX_CHARS;")(sandbox);
const wiAnalyze = sandbox.wiAnalyze, wiApply = sandbox.wiApply;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra === undefined ? "" : "-> " + JSON.stringify(extra)); }
}
function kinds(r) { return r.suggestions.map(s => s.kind); }
function joinRes(r, paras) {
  const ps = paras || r.paragraphs;
  let out = "";
  ps.forEach((p, i) => { out += p; if (i < r.separators.length) out += r.separators[i]; });
  return out;
}
function invariantsHold(r) {
  const by = {};
  for (const s of r.suggestions) {
    if (r.paragraphs[s.pIdx].slice(s.start, s.end) !== s.original) return "original mismatch: " + s.id;
    (by[s.pIdx] = by[s.pIdx] || []).push(s);
  }
  for (const k in by) {
    const a = by[k].slice().sort((x, y) => x.start - y.start);
    for (let i = 1; i < a.length; i++) if (a[i].start < a[i - 1].end) return "overlap in paragraph " + k;
  }
  return true;
}

console.log("1) Input kosong / hanya spasi");
check("empty string -> 0 suggestions", wiAnalyze("").suggestions.length === 0);
check("whitespace only -> 0 suggestions", wiAnalyze("   \n\n  ").suggestions.length === 0);
check("null -> 0 suggestions", wiAnalyze(null).suggestions.length === 0);

console.log("2) Tiap aturan memicu pada contoh positif");
const rep = wiAnalyze("Saya pergi ke ke pasar.");
check("repeated-word fires", rep.suggestions.length === 1 && rep.suggestions[0].kind === "repeated-word", kinds(rep));
check("repeated-word span/replacement", rep.suggestions[0].original === "ke ke" && rep.suggestions[0].replacement === "ke", rep.suggestions[0]);
const dsp = wiAnalyze("Ini adalah  kalimat.");
check("double-space (multi) fires", dsp.suggestions.length === 1 && dsp.suggestions[0].kind === "double-space" && dsp.suggestions[0].replacement === " ", kinds(dsp));
const sbp = wiAnalyze("Ini kalimat .");
check("space-before-punctuation fires", sbp.suggestions.length === 1 && sbp.suggestions[0].kind === "double-space" && sbp.suggestions[0].original === " ." && sbp.suggestions[0].replacement === ".", sbp.suggestions);
const mis = wiAnalyze("Dia sehat.Selanjutnya dia pergi.");
check("missing-space fires", mis.suggestions.length === 1 && mis.suggestions[0].kind === "missing-space-after-punctuation" && mis.suggestions[0].replacement === ". ", kinds(mis));
const cap = wiAnalyze("dia pergi ke pasar. lalu pulang.");
check("sentence-capital fires at paragraph start + after '. '", cap.suggestions.length === 2 && cap.suggestions.every(s => s.kind === "sentence-capital"), kinds(cap));

console.log("3) Teks bersih -> tidak ada saran");
const clean = wiAnalyze("Dia pergi ke pasar. Lalu, dia pulang ke rumah dan beristirahat.");
check("clean text -> 0 suggestions", clean.suggestions.length === 0, kinds(clean));
const boundary = wiAnalyze("Dia masuk rumah. Rumah itu besar.");
check("same word across sentence boundary -> no repeated-word", !kinds(boundary).includes("repeated-word"), kinds(boundary));

console.log("4) Penjaga: desimal, singkatan, domain, daftar");
check("decimal 3.14 -> no missing-space", !kinds(wiAnalyze("Nilai pi adalah 3.14 dan tetap. Selanjutnya kita bahas.")).includes("missing-space-after-punctuation"));
check("abbreviation dll. -> no capital on next word", !kinds(wiAnalyze("Kami membeli buku, pensil, dll. lalu pulang.")).includes("sentence-capital"));
check("abbreviation dll. -> no missing-space", !kinds(wiAnalyze("Daftar isi: buku, dll.Semua ada.")).includes("missing-space-after-punctuation"));
check("domain -> no missing-space", !kinds(wiAnalyze("Kunjungi saksara.vercel.app untuk info. Lalu coba lagi.")).includes("missing-space-after-punctuation"));
check("dotted token (laporan.v2.Final) -> no missing-space", !kinds(wiAnalyze("File bernama laporan.v2.Final tersedia.")).includes("missing-space-after-punctuation"));
check("list paragraph -> no capital", !kinds(wiAnalyze("- item pertama\n- item kedua")).includes("sentence-capital"));
check("URL paragraph -> no capital", !kinds(wiAnalyze("lihat https://saksara.vercel.app sekarang.")).includes("sentence-capital"));
check("numbered sentence end -> no capital (digit guard)", !kinds(wiAnalyze("Ada 3. kemudian kami pulang.")).includes("sentence-capital"));

console.log("5) Toleransi tanda baca pada kata berulang");
const commaRep = wiAnalyze("Belajar, belajar itu penting.");
check("repeated across comma fires", commaRep.suggestions.length === 1 && commaRep.suggestions[0].kind === "repeated-word", kinds(commaRep));
check("apply comma-repeat", joinRes(commaRep, wiApply(commaRep.paragraphs, commaRep.suggestions, commaRep.suggestions.map(s => s.id))) === "Belajar itu penting.");

console.log("6) Saran tidak pernah tumpang tindih");
const messy = wiAnalyze("pergi  pergi ke pasar.Hari ini cerah .");
check("invariants on messy text", invariantsHold(messy) === true, invariantsHold(messy));
check("overlap resolved: 'kata  kata' keeps repeated-word only", (() => { const r = wiAnalyze("kata  kata"); return r.suggestions.length === 1 && r.suggestions[0].kind === "repeated-word"; })());
check("invariants on multi-paragraph text", invariantsHold(wiAnalyze("dia pergi.\n\nke ke pasar  ramai .")) === true);

console.log("7) wiApply: terima semua / sebagian / tidak sama sekali");
const src = "Saya ke ke pasar. lalu pulang.";
const r7 = wiAnalyze(src);
const all = wiApply(r7.paragraphs, r7.suggestions, r7.suggestions.map(s => s.id));
check("apply all -> revised text", joinRes(r7, all) === "Saya ke pasar. Lalu pulang.", joinRes(r7, all));
const capOnly = r7.suggestions.find(s => s.kind === "sentence-capital");
const partial = wiApply(r7.paragraphs, r7.suggestions, [capOnly.id]);
check("apply subset -> unaccepted untouched", joinRes(r7, partial) === "Saya ke ke pasar. Lalu pulang.", joinRes(r7, partial));
const none = wiApply(r7.paragraphs, r7.suggestions, []);
check("apply none -> original unchanged", JSON.stringify(none) === JSON.stringify(r7.paragraphs));
check("apply does not mutate input", r7.paragraphs[0] === src);

console.log("8) Struktur paragraf dipertahankan");
const multi = "Satu.\n\nDua dua.\n\n\nTiga.";
const r8 = wiAnalyze(multi);
check("3 paragraphs, separators kept", r8.paragraphs.length === 3 && JSON.stringify(r8.separators) === JSON.stringify(["\n\n", "\n\n\n"]), r8.separators);
const r8all = joinRes(r8, wiApply(r8.paragraphs, r8.suggestions, r8.suggestions.map(s => s.id)));
check("revised keeps exact separators", r8all === "Satu.\n\nDua.\n\n\nTiga.", r8all);
check("blank-line count identical", (r8all.match(/\n\n/g) || []).length === (multi.match(/\n\n/g) || []).length);
const crlf = wiAnalyze("Satu baris.\r\n\r\nDua dua.");
check("CRLF normalized -> 2 paragraphs + repeat in pIdx 1", crlf.paragraphs.length === 2 && crlf.suggestions.some(s => s.pIdx === 1 && s.kind === "repeated-word"), kinds(crlf));

console.log("9) Unicode aman (emoji + diakritik, offset kode-unit)");
const uni = "Hari ini cerah ☀️ dan dan menyenangkan.";
const r9 = wiAnalyze(uni);
check("repeat after emoji fires", r9.suggestions.some(s => s.kind === "repeated-word"), kinds(r9));
check("unicode round-trip exact", joinRes(r9, wiApply(r9.paragraphs, r9.suggestions, r9.suggestions.map(s => s.id))) === "Hari ini cerah ☀️ dan menyenangkan.");
const dia = wiAnalyze("Dia di kafé. kafé itu ramai.");
check("diacritic word capital applies", joinRes(dia, wiApply(dia.paragraphs, dia.suggestions, dia.suggestions.map(s => s.id))) === "Dia di kafé. Kafé itu ramai.");

console.log("10) Batas 50.000 karakter di inti");
check("over-limit input truncated + flagged", (() => { const r = wiAnalyze("a".repeat(50001)); return r.truncated === true && r.paragraphs.join("").length === 50000; })());
check("exactly-at-limit not truncated", wiAnalyze("a".repeat(50000)).truncated === false);

console.log("\nWI TESTS:", pass, "passed,", fail, "failed");
process.exit(fail ? 1 : 0);
