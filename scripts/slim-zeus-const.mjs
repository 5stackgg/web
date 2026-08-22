#!/usr/bin/env node
/**
 * Rewrites generated/zeus/const.ts down to the part Zeus actually consults at runtime.
 *
 * `Zeus()` reads AllTypesProps/ReturnTypes for exactly one reason: ResolveFromPath has to
 * answer, for an inline argument literal, "emit this bare or quoted?". The answer space is
 * 'enum' | 'scalar.X' | 'not', and because nothing in this app ever registers a `scalars`
 * coder, 'scalar.X' returns JSON.stringify(a) -- byte-identical to the 'not' fallthrough for
 * strings and numbers. So every scalar terminal except json/jsonb is dead weight, and the
 * types that exist only to reach one can go with them.
 *
 * json/jsonb are kept because JSON.stringify({a:1}) is `{"a":1}` (quoted keys, invalid as a
 * GraphQL literal) where the fallthrough emits `{a: 1}`. Date is handled directly in arb()
 * by the patch script, so timestamptz does not need to survive here.
 *
 * Reads  generated/zeus/const.full.ts  (verbatim codegen output)
 * Writes generated/zeus/const.ts       (what ships)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FULL = path.join(ROOT, "generated/zeus/const.full.ts");
const OUT = path.join(ROOT, "generated/zeus/const.ts");

// Scalars whose serialization differs from the 'not' fallthrough for a value the app can pass.
const KEEP_SCALARS = new Set(["scalar.json", "scalar.jsonb"]);

export async function loadConst(tsPath) {
  const { transform } = await import(path.join(ROOT, "node_modules/esbuild/lib/main.js"));
  const code = (await transform(fs.readFileSync(tsPath, "utf8"), { loader: "ts", format: "esm" })).code;
  const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  return { AllTypesProps: mod.AllTypesProps, ReturnTypes: mod.ReturnTypes, Ops: mod.Ops };
}

const isKeptTerminal = (v) => v === "enum" || (typeof v === "string" && KEEP_SCALARS.has(v));

/** Every type name that can transitively reach a kept terminal. */
function reachable(A) {
  const rev = new Map();
  for (const [name, body] of Object.entries(A)) {
    if (typeof body !== "object" || body === null) continue;
    for (const v of Object.values(body)) {
      const targets = typeof v === "string" ? [v] : Object.values(v).filter((x) => typeof x === "string");
      for (const t of targets) {
        if (!rev.has(t)) rev.set(t, new Set());
        rev.get(t).add(name);
      }
    }
  }
  const seen = new Set(Object.keys(A).filter((k) => isKeptTerminal(A[k])));
  const stack = [...seen];
  while (stack.length) {
    const n = stack.pop();
    for (const p of rev.get(n) || []) if (!seen.has(p)) { seen.add(p); stack.push(p); }
  }
  return seen;
}

export function slim(A, R) {
  const keep = reachable(A);
  const props = {};

  // Keys are never deleted, only retargeted at NONE.
  //
  // ResolvePropsType short-circuits on the *presence* of a key: with `matches.lineup_counts`
  // listed, a 2-part path returns 'not' immediately. Delete the key and resolution falls through
  // to ResolveReturnType instead, which walks matches -> lineup_counts -> json and answers
  // scalar.json -- so an empty `lineup_counts: [{}, true]` arg set started serializing as
  // `lineup_counts({})` and the document stopped parsing. NONE is an empty object type, so
  // rpp(NONE) is 'not' at any depth and never reaches ReturnTypes.
  const NONE = "__zeus_none";

  for (const [name, body] of Object.entries(A)) {
    if (typeof body !== "object" || body === null) {
      if (isKeptTerminal(body)) props[name] = body;
      continue;
    }
    if (!keep.has(name)) continue;
    const kept = {};
    for (const [field, v] of Object.entries(body)) {
      if (typeof v === "string") {
        kept[field] = keep.has(v) ? v : NONE;
      } else if (v && typeof v === "object") {
        const args = {};
        for (const [ak, av] of Object.entries(v)) {
          if (typeof av === "string") args[ak] = keep.has(av) ? av : NONE;
        }
        kept[field] = args;
      }
    }
    props[name] = kept;
  }
  props[NONE] = {};

  // ReturnTypes exists so ResolveFromPath can walk *through* nested selection fields to reach an
  // argument position. A field is only droppable if nothing downstream still resolves, and
  // "downstream" is transitive -- `my_friends -> player -> player_lineup(where:)` needs every hop
  // kept even though only the last carries the arg. Take the fixpoint. A type dropped from props
  // is dropped here too, so rpp() on it cannot answer via a route props no longer knows about.
  const bare = (v) => v.replace(/[[\]!]/g, "");
  const needed = new Set(Object.keys(props));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, body] of Object.entries(R)) {
      if (needed.has(name) || typeof body !== "object" || body === null) continue;
      for (const v of Object.values(body)) {
        if (typeof v === "string" && needed.has(bare(v))) { needed.add(name); changed = true; break; }
      }
    }
  }
  const returns = {};
  for (const [name, body] of Object.entries(R)) {
    if (typeof body !== "object" || body === null || !needed.has(name)) continue;
    const kept = {};
    for (const [field, v] of Object.entries(body)) if (typeof v === "string" && needed.has(bare(v))) kept[field] = v;
    if (Object.keys(kept).length) returns[name] = kept;
  }

  // Same short-circuit rule as for keys, one level up: a type that survives in ReturnTypes must
  // also exist in props, or ResolvePropsType stops matching and rpp() falls through to
  // ResolveReturnType. clip_render_jobs was dropped from props but kept in returns for walking,
  // so `clip_render_jobs|spec` stopped short-circuiting at 'not' and resolved through to
  // scalar.jsonb. Give every such type its full key set, retargeted at NONE -- it reached no kept
  // terminal by construction, so NONE is the right answer for all of them.
  for (const name of Object.keys(returns)) {
    if (props[name] !== undefined) continue;
    const body = A[name];
    if (!body || typeof body !== "object") continue;
    const kept = {};
    for (const [field, v] of Object.entries(body)) {
      if (typeof v === "string") kept[field] = keep.has(v) ? v : NONE;
      else if (v && typeof v === "object") {
        const args = {};
        for (const [ak, av] of Object.entries(v)) if (typeof av === "string") args[ak] = keep.has(av) ? av : NONE;
        kept[field] = args;
      }
    }
    props[name] = kept;
  }

  return { props, returns };
}

function emit(props, returns, Ops) {
  const j = (o) => JSON.stringify(o, null, 0);
  return `/* eslint-disable */
// GENERATED by scripts/slim-zeus-const.mjs from const.full.ts -- do not edit by hand.
// Only the entries ResolveFromPath can still answer 'enum' (or json/jsonb) with are kept;
// see the header of that script for why the rest is unreachable at runtime.
// A "*X" value means "every field of this type resolves to X".

export const AllTypesProps: Record<string,any> = ${j(props)}

export const ReturnTypes: Record<string,any> = ${j(returns)}

export const Ops = ${j(Ops)}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!fs.existsSync(FULL)) {
    console.error(`missing ${path.relative(ROOT, FULL)} -- run yarn codegen (patch-zeus-codegen.sh stages it)`);
    process.exit(1);
  }
  const { AllTypesProps, ReturnTypes, Ops } = await loadConst(FULL);
  const { props, returns } = slim(AllTypesProps, ReturnTypes);
  const out = emit(props, returns, Ops);
  fs.writeFileSync(OUT, out);
  const before = fs.statSync(FULL).size, after = Buffer.byteLength(out);
  console.log(
    `slim-zeus-const: AllTypesProps ${Object.keys(AllTypesProps).length} -> ${Object.keys(props).length} types, ` +
    `ReturnTypes ${Object.keys(ReturnTypes).length} -> ${Object.keys(returns).length}`,
  );
  console.log(`slim-zeus-const: ${before.toLocaleString()} -> ${after.toLocaleString()} bytes (${(100 * (1 - after / before)).toFixed(1)}% smaller)`);
}
