import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

// Stands in for Source2Viewer-CLI. FAKE_S2V maps each --vpk_filepath to the
// files it "exports" (relative to -o), or to "FAIL" to exit non-zero; a .glb
// or .gltf target is only written when --gltf_export_format asks for that
// format. FAKE_S2V_OUTPUT maps `<filepath>` or `<filepath>#<format>` to
// `{ stdout, stderr, repeat }`, printed before exiting (stdout `repeat`
// times), with stderr also appended to ./exceptions.txt the way the real CLI
// logs what it swallows. FAKE_S2V_VERSION is what --version reports; every
// export is appended to FAKE_S2V_LOG, and the directory it ran in to
// FAKE_S2V_CWD_LOG, when set.
const FAKE_CLI = `
import { appendFileSync, copyFileSync, mkdirSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("Version: " + (process.env.FAKE_S2V_VERSION ?? "fake-1"));
  console.log("OS: whatever the machine is");
  process.exit(0);
}
const at = (flag) => args[args.indexOf(flag) + 1];
const filepath = at("--vpk_filepath");
const format = args.includes("--gltf_export_format") ? at("--gltf_export_format") : null;
if (process.env.FAKE_S2V_LOG) {
  appendFileSync(process.env.FAKE_S2V_LOG, filepath + "\\n");
}
if (process.env.FAKE_S2V_CWD_LOG) {
  appendFileSync(process.env.FAKE_S2V_CWD_LOG, process.cwd() + "\\n");
}
const outputs = JSON.parse(process.env.FAKE_S2V_OUTPUT ?? "{}");
const said = outputs[filepath + "#" + format] ?? outputs[filepath] ?? {};
for (let i = 0; i < (said.repeat ?? 1) && said.stdout; i++) {
  writeSync(1, said.stdout);
}
if (said.stderr) {
  writeSync(2, said.stderr);
  appendFileSync("exceptions.txt", said.stderr);
}
const plan = JSON.parse(process.env.FAKE_S2V)[filepath];
if (plan === "FAIL") {
  process.stderr.write("simulated export failure\\n");
  process.exit(3);
}
for (const [target, source] of Object.entries(plan ?? {})) {
  const kind = /\\.(glb|gltf)$/.exec(target)?.[1];
  if (kind && format && kind !== format) {
    continue;
  }
  const path = join(at("-o"), target);
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(source, path);
}
`;

/** Writes the fake CLI into `dir` and returns its path. */
export function installFakeSourceViewer(dir: string) {
  const script = join(dir, "fake-s2v.mjs");
  const cli = join(dir, "s2v");
  writeFileSync(script, FAKE_CLI);
  writeFileSync(cli, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
  chmodSync(cli, 0o755);
  return cli;
}

export type StoredObject = { body: Buffer; sha256: string | null };

type FetchInit = { method?: string; headers?: HeadersInit; body?: Buffer };

/**
 * An in-memory B2 behind a stubbed global fetch, answering the signed S3
 * calls lib-bucket makes (404 for a missing key). `puts` records every write
 * in order.
 */
export function fakeBucket(host: string) {
  const objects = new Map<string, StoredObject>();
  const puts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: FetchInit = {}) => {
      const url = new URL(input);
      if (url.host !== host) {
        throw new Error(`unexpected fetch to ${url}`);
      }
      const method = init.method ?? "GET";
      const key = decodeURIComponent(url.pathname.slice(1));
      if (method === "PUT") {
        const headers = new Headers(init.headers);
        objects.set(key, {
          body: Buffer.from(init.body as Buffer),
          sha256: headers.get("x-amz-meta-sha256"),
        });
        puts.push(key);
        return new Response(null, { status: 200 });
      }
      const object = objects.get(key);
      if (!object) {
        return new Response(null, { status: 404 });
      }
      const headers = object.sha256 ? { "x-amz-meta-sha256": object.sha256 } : undefined;
      return new Response(method === "HEAD" ? null : object.body, { status: 200, headers });
    }),
  );
  const json = (key: string) => JSON.parse(objects.get(key)!.body.toString("utf8"));
  return { objects, puts, json };
}
