#!/usr/bin/env node
// Applies a flat {key: value} patch to a locale file and rewrites it in en.json
// key order, dropping keys en.json no longer has.
// Usage: node scripts/i18n-patch.mjs <locale> <patch.json>
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.resolve(__dirname, "../i18n/locales");

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

const [locale, patchPath] = process.argv.slice(2);
if (!locale || !patchPath) {
  console.error("usage: node scripts/i18n-patch.mjs <locale> <patch.json>");
  process.exit(1);
}

const enFlat = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, "en.json"), "utf8")));
const target = path.join(LOCALES, `${locale}.json`);
const cur = flatten(JSON.parse(fs.readFileSync(target, "utf8")));
const patch = flatten(JSON.parse(fs.readFileSync(patchPath, "utf8")));

const unknown = Object.keys(patch).filter((k) => !(k in enFlat));
if (unknown.length) {
  console.error(`${locale}: patch has ${unknown.length} keys not in en.json:\n  ${unknown.join("\n  ")}`);
  process.exit(1);
}

const merged = { ...cur, ...patch };
const nested = {};
const missing = [];
for (const key of Object.keys(enFlat)) {
  const value = merged[key];
  if (typeof value !== "string") {
    missing.push(key);
    continue;
  }
  const parts = key.split(".");
  let node = nested;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

fs.writeFileSync(target, JSON.stringify(nested, null, 2) + "\n");
const dropped = Object.keys(cur).filter((k) => !(k in enFlat));
console.log(
  `${locale}: +${Object.keys(patch).filter((k) => !(k in cur)).length} keys, -${dropped.length} stale, ${missing.length} still missing`,
);
if (missing.length) process.exitCode = 1;
