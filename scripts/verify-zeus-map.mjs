#!/usr/bin/env node
/**
 * Gate for scripts/slim-zeus-const.mjs. Fails the build if the slim map could ever make
 * Zeus serialize an argument differently from the full map.
 *
 * Two independent checks:
 *
 *  1. STRUCTURAL (exhaustive). For every (type, field) transition in the full map, either the
 *     slim map kept it verbatim, or the subtree behind it provably contains no kept terminal.
 *     Resolution is a chain of single transitions, so agreeing on every transition and every
 *     terminal means agreeing on every path -- no path enumeration required.
 *
 *  2. BEHAVIOURAL (sampled, from the roots). Walks real argument paths out of query_root /
 *     mutation_root / subscription_root and runs both maps through a faithful port of
 *     ResolveFromPath, asserting the answers are equivalent. 'scalar.<dropped>' -> 'not' is the
 *     one allowed divergence and is asserted explicitly rather than tolerated, because that is
 *     the whole reduction: with no `scalars` coder registered, both emit JSON.stringify(a).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConst } from "./slim-zeus-const.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEEP_SCALARS = new Set(["scalar.json", "scalar.jsonb"]);
const NONE = "__zeus_none";
const isKept = (v) => v === "enum" || (typeof v === "string" && KEEP_SCALARS.has(v));
const isScalar = (v) => typeof v === "string" && v.startsWith("scalar.");

// ---- faithful port of generated/zeus/index.ts ResolveFromPath, with the "*" sentinel ----
const SEP = "|";
const mapPart = (p) => { const [a, f] = p.split("<>"); return f ? { v: f, __type: "field" } : { v: a, __type: "arg" }; };
function makeResolver(props, returns, ops) {
  const rpp = (pathStr) => {
    const mp = pathStr.split(SEP).filter(Boolean).map(mapPart);
    const a = propsType(mp); if (a) return a;
    const b = returnType(mp); if (b) return b;
    return "not";
  };
  const propsType = (mp) => {
    if (!mp.length) return "not";
    const oKey = ops[mp[0].v];
    const p1 = oKey ? props[oKey] : props[mp[0].v];
    if (p1 === "enum" && mp.length === 1) return "enum";
    if (typeof p1 === "string" && p1.startsWith("scalar.") && mp.length === 1) return p1;
    if (typeof p1 === "object" && p1 !== null) {
      if (mp.length < 2) return "not";
      const p2 = p1[mp[1].v];
      if (typeof p2 === "string") return rpp([p2, ...mp.slice(2).map((m) => m.v)].join(SEP));
      if (typeof p2 === "object" && p2 !== null) {
        if (mp.length < 3) return "not";
        const p3 = p2[mp[2].v];
        if (p3 && mp[2].__type === "arg") return rpp([p3, ...mp.slice(3).map((m) => m.v)].join(SEP));
      }
    }
  };
  const returnType = (mp) => {
    if (!mp.length) return "not";
    const oKey = ops[mp[0].v];
    const r1 = oKey ? returns[oKey] : returns[mp[0].v];
    if (typeof r1 === "object" && r1 !== null) {
      if (mp.length < 2) return "not";
      const r2 = r1[mp[1].v];
      if (r2) return rpp([r2, ...mp.slice(2).map((m) => m.v)].join(SEP));
    }
  };
  return rpp;
}

// ---- check 1: structural ----
function subtreeHasKeptTerminal(A, start, memo = new Map()) {
  if (memo.has(start)) return memo.get(start);
  memo.set(start, false); // cycle guard: assume false until proven
  const body = A[start];
  let found = false;
  if (isKept(body)) found = true;
  else if (body && typeof body === "object") {
    for (const v of Object.values(body)) {
      const targets = typeof v === "string" ? [v] : Object.values(v).filter((x) => typeof x === "string");
      for (const t of targets) if (subtreeHasKeptTerminal(A, t, memo)) { found = true; break; }
      if (found) break;
    }
  }
  memo.set(start, found);
  return found;
}

function structural(A, props) {
  const errs = [];
  const memo = new Map();
  for (const [name, body] of Object.entries(A)) {
    if (name === NONE) continue;
    if (!body || typeof body !== "object") {
      if (isKept(body) && props[name] !== body) errs.push(`terminal ${name}: kept terminal missing from slim map`);
      continue;
    }
    const slimBody = props[name];
    if (slimBody && typeof slimBody === "object") {
      for (const k of Object.keys(slimBody)) {
        if (!(k in body)) errs.push(`${name}.${k}: present in slim map but not in full map`);
      }
      for (const k of Object.keys(body)) {
        if (!(k in slimBody)) errs.push(`${name}.${k}: key deleted from slim map -- deleting a key removes a ResolvePropsType short-circuit`);
      }
    } else if (typeof slimBody === "string") {
      errs.push(`${name}: slim map replaced an object body with the string ${slimBody} -- would answer for unlisted keys`);
    }
    for (const [field, v] of Object.entries(body)) {
      const targets = typeof v === "string" ? [[field, v]] : Object.entries(v).filter(([, x]) => typeof x === "string").map(([a, x]) => [`${field}.${a}`, x]);
      for (const [label, target] of targets) {
        let slimTarget;
        if (typeof slimBody === "string" && slimBody.startsWith("*")) slimTarget = slimBody.slice(1);
        else if (slimBody && typeof slimBody === "object") {
          const sv = slimBody[label.includes(".") ? label.split(".")[0] : field];
          slimTarget = typeof sv === "string" ? sv : sv && typeof sv === "object" ? sv[label.split(".")[1]] : undefined;
        }
        if (slimTarget === target) continue;                       // kept verbatim
        if (slimTarget === NONE || slimTarget === undefined) {      // retargeted at the dead end
          if (subtreeHasKeptTerminal(A, target, memo))
            errs.push(`${name}.${label} -> ${target}: retargeted at ${NONE} but its subtree reaches a kept terminal`);
        } else {                                                    // rewritten -> would invent answers
          errs.push(`${name}.${label}: full -> ${target} but slim -> ${slimTarget}`);
        }
      }
    }
  }
  return errs;
}

// ---- check 2: behavioural walk from the roots ----
function behavioural(A, R, Ops, full, slim, maxDepth = 5, budget = 150000) {
  const errs = [];
  let checked = 0, divergences = 0;
  const seen = new Set();
  const visit = (parts, depth) => {
    if (depth > maxDepth || seen.size >= budget) return;
    const p = parts.join(SEP);
    if (seen.has(p)) return;
    seen.add(p);
    const f = full(p), s = slim(p);
    checked++;
    if (f !== s) {
      divergences++;
      // the ONLY divergence the reduction permits
      if (!(isScalar(f) && !KEEP_SCALARS.has(f) && s === "not")) {
        errs.push(`path ${p}: full=${f} slim=${s}`);
      }
    }
    // expand using the full map's structure
    const mp = parts.map(mapPart);
    const oKey = Ops[mp[0].v];
    const rootName = oKey || mp[0].v;
    let node = A[rootName];
    for (let i = 1; i < mp.length && node; i++) {
      if (typeof node === "string") { node = A[node]; i--; continue; }
      node = node[mp[i].v];
    }
    if (typeof node === "string") node = A[node];
    if (node && typeof node === "object") {
      for (const k of Object.keys(node).slice(0, 12)) visit([...parts, k], depth + 1);
    }
  };
  for (const op of Object.keys(Ops)) {
    const rootType = A[Ops[op]];
    if (!rootType || typeof rootType !== "object") continue;
    for (const rootField of Object.keys(rootType)) visit([`field<>${op}`, rootField], 1);
  }
  return { errs, checked, divergences };
}

// Refuse to run against an unslimmed const.ts. `yarn codegen` rewrites const.ts wholesale, so a
// run that lands between codegen and the slimmer would diff the full map against itself and pass
// vacuously -- which is exactly how the lineup_counts bug reached the browser. Fail loudly instead.
{
  const fullPath = path.join(ROOT, "generated/zeus/const.full.ts");
  const slimPath = path.join(ROOT, "generated/zeus/const.ts");
  for (const f of [fullPath, slimPath]) {
    if (!fs.existsSync(f)) { console.error(`verify-zeus-map: missing ${path.relative(ROOT, f)} -- run yarn codegen`); process.exit(1); }
  }
  const slimSrc = fs.readFileSync(slimPath, "utf8");
  if (!slimSrc.includes("GENERATED by scripts/slim-zeus-const.mjs")) {
    console.error("verify-zeus-map: generated/zeus/const.ts is not the slimmed map (missing generator header).");
    console.error("  It was probably overwritten by `yarn codegen`. Re-run scripts/patch-zeus-codegen.sh.");
    process.exit(1);
  }
  if (fs.statSync(slimPath).size >= fs.statSync(fullPath).size) {
    console.error("verify-zeus-map: const.ts is not smaller than const.full.ts -- refusing to verify a map against itself.");
    process.exit(1);
  }
}

const fullMap = await loadConst(path.join(ROOT, "generated/zeus/const.full.ts"));
const slimMap = await loadConst(path.join(ROOT, "generated/zeus/const.ts"));
const resolveFull = makeResolver(fullMap.AllTypesProps, fullMap.ReturnTypes, fullMap.Ops);
const resolveSlim = makeResolver(slimMap.AllTypesProps, slimMap.ReturnTypes, slimMap.Ops);

// ---- check 3: exhaustive transitions ----
// Every type name as a 1-part path, and every (type, key) pair in both maps as a 2-part path.
// Resolution is a chain of these, so agreeing on all of them plus the terminals means agreeing
// everywhere. This is the check that catches short-circuit loss: ResolvePropsType matching on the
// *presence* of a type or a key, where an absence falls through to ResolveReturnType and gets a
// confidently wrong answer instead of 'not'. Both bugs that reached the browser were this shape.
function transitions(F, S, resolveFull, resolveSlim) {
  const errs = [];
  let checked = 0;
  const ok = (f, s) => f === s || (isScalar(f) && !KEEP_SCALARS.has(f) && s === "not");
  const cmp = (p) => {
    checked++;
    const f = resolveFull(p), s = resolveSlim(p);
    if (!ok(f, s)) errs.push(`${p}: full=${f} slim=${s}`);
  };
  for (const T of Object.keys(F.AllTypesProps)) cmp(T);
  for (const map of [F.AllTypesProps, F.ReturnTypes]) {
    for (const [T, body] of Object.entries(map)) {
      if (!body || typeof body !== "object") continue;
      for (const k of Object.keys(body)) cmp(`${T}|${k}`);
    }
  }
  return { errs, checked };
}

const sErrs = structural(fullMap.AllTypesProps, slimMap.AllTypesProps);
console.log(`[structural]  ${sErrs.length === 0 ? "PASS -- every dropped transition proven to reach no kept terminal" : `FAIL -- ${sErrs.length} unsafe transition(s)`}`);
for (const e of sErrs.slice(0, 15)) console.log(`   ${e}`);
if (sErrs.length > 15) console.log(`   ... and ${sErrs.length - 15} more`);

const { errs: bErrs, checked, divergences } = behavioural(fullMap.AllTypesProps, fullMap.ReturnTypes, fullMap.Ops, resolveFull, resolveSlim);
console.log(`[behavioural] ${bErrs.length === 0 ? `PASS -- ${checked.toLocaleString()} paths walked, ${divergences.toLocaleString()} divergences, all of them scalar->not` : `FAIL -- ${bErrs.length} unsafe divergence(s) of ${divergences.toLocaleString()}`}`);
for (const e of bErrs.slice(0, 15)) console.log(`   ${e}`);
if (bErrs.length > 15) console.log(`   ... and ${bErrs.length - 15} more`);

const { errs: tErrs, checked: tChecked } = transitions(fullMap, slimMap, resolveFull, resolveSlim);
console.log(`[transitions] ${tErrs.length === 0 ? `PASS -- ${tChecked.toLocaleString()} type/key transitions, none lose a short-circuit` : `FAIL -- ${tErrs.length} unsafe transition(s)`}`);
for (const e of tErrs.slice(0, 15)) console.log(`   ${e}`);
if (tErrs.length > 15) console.log(`   ... and ${tErrs.length - 15} more`);

if (sErrs.length || bErrs.length || tErrs.length) { console.error("\nverify-zeus-map: FAILED"); process.exit(1); }
console.log("\nverify-zeus-map: OK");
