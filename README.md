# Saksara modular refactor — review checkpoint

Baseline: production v0.24.3-beta `index.html`, md5 `8dcc9f3877358e0bf70b00d9241df446`, copied read-only to `baseline/index.html`.

## Layout

- `index.html` — document shell and markup. It loads local assets in the same order as the original inline blocks.
- `assets/css/01-main.css` — original head `<style>` body, byte-identical.
- `assets/js/01-detector-ui.js` — original first `<script>` body, byte-identical.
- `assets/css/02-save-panel.css` — original save-panel `<style>` body, byte-identical, linked at the same body position.
- `assets/js/02-save-panel.js` — original save-panel `<script>` body, byte-identical.
- `assets/js/03-app.js` — original main app `<script>` body, byte-identical.
- `assets/js/04-presentation-glue.js` — original final presentation `<script>` body, byte-identical.

All scripts remain classic scripts with no `defer`/`async`, preserving parser-blocking execution order and globals.

## Legacy test adapter

Run:

```bash
node tools/build-test-adapter.mjs
```

This writes `dist/test-single-file.html` by inlining the local assets in load order. The adapter fails unless the reconstructed file is byte-identical to `baseline/index.html`. Historical suites that extract cores from one HTML file run against that adapter file; browser QA runs against the modular `index.html` over HTTP.

## Security phase inventory

Run:

```bash
node tools/inventory-security.mjs
```

This writes `notes/security-inventory.json`. It only inventories `innerHTML` sinks and external domains for the later CSP/SRI/header phase; it does not change app behavior.

## Stop point

This directory is a local review checkpoint only. It is not merged, deployed, or published by this refactor step.
