#!/usr/bin/env node
/*
 * Legacy harness adapter for the modular Saksara refactor.
 *
 * The production candidate is modular (index.html + assets/*). Several
 * historical test suites extract cores from a single HTML file. This adapter
 * inlines the local CSS/JS assets back into one HTML file, in the exact load
 * order used by index.html, so those suites can run without weakened
 * assertions. It fails if the reconstructed file is not byte-identical to
 * baseline/index.html.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");
const baselinePath = path.join(root, "baseline", "index.html");
const outPath = path.join(root, "dist", "test-single-file.html");
const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex");

let html = fs.readFileSync(indexPath, "utf8");
html = html.replace(/<link rel="stylesheet" href="(assets\/css\/[^"]+)">/g, (_m, rel) => {
  return "<style>" + fs.readFileSync(path.join(root, rel), "utf8") + "</style>";
});
html = html.replace(/<script src="(assets\/js\/[^"]+)"><\/script>/g, (_m, rel) => {
  return "<script>" + fs.readFileSync(path.join(root, rel), "utf8") + "</script>";
});
if (/assets\/(css|js)\//.test(html)) {
  console.error("FAIL: local asset reference remains after adapter inline");
  process.exit(1);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
const got = md5(Buffer.from(html, "utf8"));
const want = md5(fs.readFileSync(baselinePath));
console.log("adapter:", path.relative(root, outPath));
console.log("adapter md5:", got);
console.log("baseline md5:", want);
if (got !== want) {
  console.error("FAIL: adapter reconstruction is not byte-identical to baseline");
  process.exit(1);
}
console.log("PASS: adapter reconstruction byte-identical to baseline");
