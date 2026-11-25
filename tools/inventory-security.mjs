#!/usr/bin/env node
/* Inventory only: list innerHTML sinks and external domains for the later
 * security-hardening phase. This tool changes nothing in the app. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["index.html", ...fs.readdirSync(path.join(root, "assets/js")).sort().map((f) => "assets/js/" + f), ...fs.readdirSync(path.join(root, "assets/css")).sort().map((f) => "assets/css/" + f)];
const sinks = [];
const domains = new Map();
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    if (/\.innerHTML\b/.test(line)) sinks.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 220) });
  });
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\\]+/g)) {
    try { const d = new URL(m[0]).hostname; if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) domains.set(d, (domains.get(d) || 0) + 1); } catch {}
  }
}
const out = { generated_from: files, innerHTML_total: sinks.length, innerHTML_sinks: sinks, external_domains: [...domains.entries()].sort((a,b)=>b[1]-a[1]).map(([domain,count])=>({domain,count})) };
fs.mkdirSync(path.join(root, "notes"), { recursive: true });
fs.writeFileSync(path.join(root, "notes/security-inventory.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ innerHTML_total: out.innerHTML_total, external_domains: out.external_domains }, null, 2));
