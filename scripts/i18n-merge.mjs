#!/usr/bin/env node
// Rebuilds i18n/locales/<file>.json from translated flat chunks, in en.json key order.
// Usage: node scripts/i18n-merge.mjs <locale-file-basename> <chunkOutDir>
//   e.g. node scripts/i18n-merge.mjs de_DE /tmp/i18n/out/de_DE
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.resolve(__dirname, "../i18n/locales");

const [locale, chunkDir] = process.argv.slice(2);
if (!locale || !chunkDir) {
  console.error("usage: node scripts/i18n-merge.mjs <locale> <chunkOutDir>");
  process.exit(1);
}

const flatten = (obj, prefix = "") => {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
};

const en = JSON.parse(fs.readFileSync(path.join(LOCALES, "en.json"), "utf8"));
const enFlat = flatten(en);

const translated = {};
const files = fs
  .readdirSync(chunkDir)
  .filter((f) => f.endsWith(".json") && f !== "chunks.index.json")
  .sort();
for (const f of files) {
  const body = JSON.parse(fs.readFileSync(path.join(chunkDir, f), "utf8"));
  // Accept either a flat map or one nested a single level under "translations".
  const map = body.translations && typeof body.translations === "object" ? body.translations : body;
  Object.assign(translated, flatten(map));
}

const missing = [];
const nested = {};
for (const key of Object.keys(enFlat)) {
  let value = translated[key];
  if (typeof value !== "string" || value === "") {
    missing.push(key);
    value = enFlat[key];
  }
  const parts = key.split(".");
  let node = nested;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

const extra = Object.keys(translated).filter((k) => !(k in enFlat));

const target = path.join(LOCALES, `${locale}.json`);
fs.writeFileSync(target, JSON.stringify(nested, null, 2) + "\n");

console.log(`${locale}: wrote ${Object.keys(enFlat).length} keys from ${files.length} chunks`);
if (missing.length) console.log(`  MISSING ${missing.length} (filled from en): ${missing.slice(0, 20).join(", ")}`);
if (extra.length) console.log(`  IGNORED ${extra.length} unknown keys: ${extra.slice(0, 20).join(", ")}`);
if (missing.length) process.exitCode = 1;
