#!/usr/bin/env node
// Splits i18n/locales/en.json into ordered, flat translation chunks.
// Usage: node scripts/i18n-chunk.mjs <outDir> [--maxChars=12000] [--maxKeys=500]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.resolve(__dirname, "../i18n/locales");

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--"));
if (!outDir) {
  console.error("usage: node scripts/i18n-chunk.mjs <outDir>");
  process.exit(1);
}
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : def;
};
const MAX_CHARS = opt("maxChars", 12000);
const MAX_KEYS = opt("maxKeys", 500);

export function flatten(obj, prefix = "") {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(LOCALES, "en.json"), "utf8"));
const flat = flatten(en);
const keys = Object.keys(flat);

// Group by second-level namespace so a chunk stays topically coherent.
const groups = [];
let current = null;
for (const key of keys) {
  const parts = key.split(".");
  const ns = parts.length > 2 ? `${parts[0]}.${parts[1]}` : parts[0];
  if (!current || current.ns !== ns) {
    current = { ns, keys: [], chars: 0 };
    groups.push(current);
  }
  current.keys.push(key);
  current.chars += key.length + String(flat[key]).length;
}

// Pack groups into chunks; oversized groups are split across sequential chunks.
const chunks = [];
let chunk = null;
const push = () => {
  if (chunk && chunk.keys.length) chunks.push(chunk);
  chunk = { keys: [], chars: 0, labels: [] };
};
push();
for (const g of groups) {
  if (chunk.keys.length && (chunk.chars + g.chars > MAX_CHARS || chunk.keys.length + g.keys.length > MAX_KEYS)) push();
  if (g.chars > MAX_CHARS || g.keys.length > MAX_KEYS) {
    for (const key of g.keys) {
      const cost = key.length + String(flat[key]).length;
      if (chunk.keys.length && (chunk.chars + cost > MAX_CHARS || chunk.keys.length + 1 > MAX_KEYS)) push();
      chunk.keys.push(key);
      chunk.chars += cost;
      if (!chunk.labels.includes(g.ns)) chunk.labels.push(g.ns);
    }
    continue;
  }
  chunk.keys.push(...g.keys);
  chunk.chars += g.chars;
  chunk.labels.push(g.ns);
}
push();
if (chunk && chunk.keys.length) chunks.push(chunk);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith(".json")) fs.unlinkSync(path.join(outDir, f));

const index = [];
chunks.forEach((c, i) => {
  const id = String(i + 1).padStart(2, "0");
  const label = c.labels[0].replace(/[^a-z0-9]+/gi, "-") + (c.labels.length > 1 ? "-plus" : "");
  const file = `${id}-${label}.json`;
  const body = {};
  for (const k of c.keys) body[k] = flat[k];
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(body, null, 2) + "\n");
  index.push({ id, file, keys: c.keys.length, chars: c.chars, sections: c.labels });
});
fs.writeFileSync(
  path.join(outDir, "chunks.index.json"),
  JSON.stringify({ totalKeys: keys.length, chunks: index }, null, 2) + "\n",
);

console.log(`${keys.length} keys -> ${chunks.length} chunks in ${outDir}`);
for (const c of index) console.log(`  ${c.file}  ${String(c.keys).padStart(4)} keys  ${String(c.chars).padStart(6)} chars`);
