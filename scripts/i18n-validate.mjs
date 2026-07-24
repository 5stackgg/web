#!/usr/bin/env node
// Validates locale files against en.json: key parity, placeholder parity,
// plural-segment parity, empty values, and untranslated (identical-to-en) values.
// Usage: node scripts/i18n-validate.mjs [locale ...]   (default: all non-en locales)
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

const placeholders = (s) => (String(s).match(/\{[^}]*\}/g) || []).sort();
const segments = (s) => String(s).split("|").length;

const en = JSON.parse(fs.readFileSync(path.join(LOCALES, "en.json"), "utf8"));
const enFlat = flatten(en);
const enKeys = Object.keys(enFlat);

let targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!targets.length) {
  targets = fs
    .readdirSync(LOCALES)
    .filter((f) => f.endsWith(".json") && f !== "en.json")
    .map((f) => f.replace(/\.json$/, ""));
}

let failed = 0;
for (const locale of targets) {
  const file = path.join(LOCALES, `${locale}.json`);
  const issues = [];
  let flat;
  try {
    flat = flatten(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (e) {
    console.log(`\n${locale}: FAIL — unparseable (${e.message})`);
    failed++;
    continue;
  }

  const missing = enKeys.filter((k) => !(k in flat));
  const extra = Object.keys(flat).filter((k) => !(k in enFlat));
  const empty = [];
  const badPlaceholder = [];
  const badPlural = [];
  const identical = [];

  for (const k of enKeys) {
    const v = flat[k];
    if (typeof v !== "string") continue;
    if (v.trim() === "") empty.push(k);
    if (placeholders(v).join(",") !== placeholders(enFlat[k]).join(",")) badPlaceholder.push(k);
    if (segments(v) !== segments(enFlat[k])) badPlural.push(k);
    if (v === enFlat[k]) identical.push(k);
  }

  const show = (label, arr, hard = true) => {
    if (!arr.length) return;
    issues.push({ hard, line: `  ${label}: ${arr.length} — ${arr.slice(0, 10).join(", ")}${arr.length > 10 ? " …" : ""}` });
  };
  show("MISSING keys", missing);
  show("EXTRA keys", extra);
  show("EMPTY values", empty);
  show("PLACEHOLDER mismatch", badPlaceholder);
  show("PLURAL segment mismatch", badPlural);
  show("identical to en", identical, false);

  const hardIssues = issues.filter((i) => i.hard);
  const status = hardIssues.length ? "FAIL" : "ok";
  if (hardIssues.length) failed++;
  console.log(`\n${locale}: ${status} (${Object.keys(flat).length}/${enKeys.length} keys)`);
  for (const i of issues) console.log(i.line);
}

console.log(`\n${targets.length - failed}/${targets.length} locales passed`);
if (failed) process.exitCode = 1;
