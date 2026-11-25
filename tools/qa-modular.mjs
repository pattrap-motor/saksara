#!/usr/bin/env node
/* Browser QA for the modular refactor: serves the workdir over HTTP, compares
 * the modular index.html with baseline/index.html, and fails on pageerror,
 * route-render mismatch, or detector-example output drift. */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.HOME + "/workspace/shots-tool/");
const { firefox } = require("playwright-core");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port;
const exe = process.env.HOME + "/.cache/ms-playwright/firefox-1572/firefox/firefox";
const browser = await firefox.launch({ executablePath: exe, headless: true });
let pass = 0, fail = 0;
const ok = (c, label, extra = "") => { if (c) { pass++; console.log("PASS", label); } else { fail++; console.log("FAIL", label, extra); } };
const routes = ["home", "detector", "forensik", "compare", "tulis", "ocr", "history", "benchmark", "cara-kerja", "metode", "posisi"];

async function inspect(label, pagePath) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE + pagePath + "#/home", { waitUntil: "load" });
  await page.waitForTimeout(800);
  const routeResults = {};
  for (const route of routes) {
    await page.evaluate((r) => { location.hash = "#/" + r; }, route);
    await page.waitForTimeout(180);
    routeResults[route] = await page.evaluate(() => {
      const visible = [...document.querySelectorAll("[data-view]")].filter((el) => !el.hidden).map((el) => el.getAttribute("data-view"));
      return { visible, title: document.title, versionCount: (document.documentElement.innerHTML.match(/v0\.24\.3-beta/g) || []).length };
    });
  }
  await page.evaluate(() => { location.hash = "#/detector"; });
  await page.waitForFunction(() => [...document.querySelectorAll("[data-view]")].some((el) => !el.hidden && el.getAttribute("data-view") === "detector"), null, { timeout: 10000 });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector("#ex2").click());
  await page.waitForFunction(() => {
    const s = document.querySelector("#score-num");
    const v = document.querySelector("#verdict");
    return s && v && s.textContent.trim() !== "0" && v.textContent.trim() !== "—";
  }, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const detector = await page.evaluate(() => ({
    score: document.querySelector("#score-num")?.textContent.trim(),
    verdict: document.querySelector("#verdict")?.textContent.trim(),
    note: document.querySelector("#score-note")?.textContent.trim(),
    summary: document.querySelector("#sent-summary-line")?.textContent.trim(),
    pcts: ["pct-burst", "pct-vocab", "pct-phrase", "pct-stylo", "pct-md", "pct-sym", "pct-rep", "pct-clf"].map((id) => document.getElementById(id)?.textContent.trim()),
    inputWords: (document.querySelector("#input-teks")?.value || "").trim().split(/\s+/).filter(Boolean).length,
  }));
  await ctx.close();
  console.log(label, JSON.stringify({ pageErrors, detector }));
  return { pageErrors, routeResults, detector };
}

const baseline = await inspect("BASELINE", "/baseline/index.html");
const modular = await inspect("MODULAR", "/index.html");
ok(baseline.pageErrors.length === 0, "baseline 0 pageerror", baseline.pageErrors.join(" | "));
ok(modular.pageErrors.length === 0, "modular 0 pageerror", modular.pageErrors.join(" | "));
for (const route of routes) {
  const b = baseline.routeResults[route], m = modular.routeResults[route];
  ok(m.visible.length > 0 && m.visible.every((v) => v === route), `route ${route} renders modular`, JSON.stringify(m.visible));
  ok(JSON.stringify(m.visible) === JSON.stringify(b.visible), `route ${route} visible blocks match baseline`, JSON.stringify({ b: b.visible, m: m.visible }));
  ok(m.versionCount === 3, `route ${route} version strings = 3`, String(m.versionCount));
}
ok(JSON.stringify(modular.detector) === JSON.stringify(baseline.detector), "detector example output identical", JSON.stringify({ baseline: baseline.detector, modular: modular.detector }));
await browser.close();
server.close();
console.log(`TOTAL: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
