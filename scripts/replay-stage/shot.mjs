#!/usr/bin/env node
// Screenshots the replay stage headless, one PNG per --shot.
//
//   node scripts/replay-stage/shot.mjs --out /tmp/shots \
//     --shot "name=overview&t=6.8" \
//     --shot "name=site&t=7&cam=600,-1200,900,-300,-1900,-170" \
//     [--size 1600x1000]
//
// Each --shot is the harness query string (see harness/main.ts) plus `name`,
// the file it is saved as. `scenario=blob&fixture=<name>` plays a real demo
// blob from node_modules/.cache/replay-stage-fixtures (build-fixture.mjs).
// The harness is built with Vite into a temp dir of its own (so runs can
// overlap), served on a free local port with the map assets (cached under
// node_modules/.cache/replay-stage-assets), and driven over the DevTools
// protocol in a headless Chrome on SwiftShader, so it runs without a GPU.
// Console errors from the page are printed after each shot.
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const ASSETS_ROOT = "https://demo-dl.5stack.gg/maps";

const args = process.argv.slice(2);
const shots = [];
let out = path.join(tmpdir(), "replay-stage-shots");
let size = [1600, 1000];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--shot") shots.push(args[++i]);
  else if (args[i] === "--out") out = path.resolve(args[++i]);
  else if (args[i] === "--size") size = args[++i].split("x").map(Number);
}
if (!shots.length) {
  console.error('usage: shot.mjs --out <dir> --shot "name=a&t=3" [--shot ...]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const cacheDir = path.join(webRoot, "node_modules/.cache/replay-stage-assets");
mkdirSync(cacheDir, { recursive: true });
const fixturesDir = path.join(webRoot, "node_modules/.cache/replay-stage-fixtures");
const distDir = mkdtempSync(path.join(tmpdir(), "replay-stage-dist-"));

async function ensureMapAssets(map) {
  const want = [".tri.gz", ".view.bin.gz", ".callouts.json"];
  if (want.every((ext) => existsSync(path.join(cacheDir, map + ext)))) return;
  const latest = await (await fetch(`${ASSETS_ROOT}/latest.json`)).json();
  const manifest = await (await fetch(`${ASSETS_ROOT}/${latest.manifest}`)).json();
  const entry = manifest.maps[map];
  if (!entry) throw new Error(`no assets for ${map}`);
  for (const [kind, ext] of [["tri", ".tri.gz"], ["view", ".view.bin.gz"], ["callouts", ".callouts.json"]]) {
    if (!entry[kind]) continue;
    const res = await fetch(`${ASSETS_ROOT}/${entry[kind]}`);
    if (!res.ok) throw new Error(`${entry[kind]}: ${res.status}`);
    writeFileSync(path.join(cacheDir, map + ext), Buffer.from(await res.arrayBuffer()));
  }
}

async function buildHarness() {
  const { build: viteBuild } = await import("vite");
  await viteBuild({
    root: path.join(here, "harness"),
    base: "./",
    logLevel: "warn",
    resolve: { alias: { "~": webRoot } },
    build: { outDir: distDir, emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 4000 },
  });
}

function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file;
    if (url.pathname.startsWith("/assets/") && !existsSync(path.join(distDir, url.pathname))) {
      file = path.join(cacheDir, path.basename(url.pathname));
    } else if (url.pathname.startsWith("/fixtures/")) {
      file = path.join(fixturesDir, path.basename(url.pathname));
    } else if (url.pathname.startsWith("/public/")) {
      file = path.join(webRoot, url.pathname);
    } else if (url.pathname.startsWith("/fonts/")) {
      // Where the app serves public/fonts; the stage loads its face from here.
      file = path.join(webRoot, "public", url.pathname);
    } else {
      file = path.join(distDir, url.pathname === "/" ? "index.html" : url.pathname);
    }
    const allowed = [webRoot, distDir, cacheDir, fixturesDir].some((root) => file.startsWith(root));
    if (!allowed || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("no Chrome found; set CHROME_PATH");
  return found;
}

function launchChrome() {
  const profile = mkdtempSync(path.join(tmpdir(), "replay-stage-chrome-"));
  const chrome = spawn(chromePath(), [
    "--headless=new",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${size[0]},${size[1]}`,
    "about:blank",
  ]);
  return new Promise((resolve, reject) => {
    let stderr = "";
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve({ chrome, profile, browserWs: match[1] });
    });
    chrome.on("exit", (code) => reject(new Error(`chrome exited ${code}: ${stderr}`)));
  });
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const msgId = ++id;
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
      return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
    },
    on(fn) {
      listeners.push(fn);
    },
    close() {
      ws.close();
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const maps = new Set(["de_mirage"]);
  for (const shot of shots) {
    const params = new URLSearchParams(shot);
    const map = params.get("map");
    if (map) maps.add(map);
    if (params.get("scenario") === "blob") {
      const file = path.join(fixturesDir, `${params.get("fixture") ?? "inferno"}.json`);
      if (!existsSync(file)) throw new Error(`${file} missing: run scripts/replay-stage/build-fixture.mjs`);
      const blobMap = JSON.parse(readFileSync(file, "utf8")).map_name;
      if (blobMap) maps.add(blobMap);
    }
  }
  for (const map of maps) await ensureMapAssets(map);
  await buildHarness();

  const server = await serve();
  const port = server.address().port;
  const { chrome, profile, browserWs } = await launchChrome();
  const client = cdp(browserWs);
  await client.ready;
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.enable", {}, sessionId);
  await client.send("Emulation.setDeviceMetricsOverride", { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false }, sessionId);
  const logs = [];
  client.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  });

  let failed = false;
  try {
    for (const shot of shots) {
      const params = new URLSearchParams(shot);
      const name = params.get("name") ?? `shot-${shots.indexOf(shot)}`;
      params.delete("name");
      logs.length = 0;
      const started = Date.now();
      await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html?${params}` }, sessionId);
      let state = null;
      for (let i = 0; i < 600; i++) {
        await sleep(100);
        const { result } = await client.send("Runtime.evaluate", { expression: "JSON.stringify({ready: !!window.__stageReady, error: window.__stageError ?? null})", returnByValue: true }, sessionId).catch(() => ({ result: {} }));
        state = result.value ? JSON.parse(result.value) : null;
        if (state?.ready) break;
      }
      const { data } = await client.send("Page.captureScreenshot", { format: "png" }, sessionId);
      const file = path.join(out, `${name}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${file}  (${secs}s${state?.ready ? "" : ", NOT READY"})`);
      if (state?.error) {
        failed = true;
        console.log(`  page error: ${state.error}`);
      }
      for (const line of logs) console.log(`  ${line}`);
    }
  } finally {
    client.close();
    // Chrome can still be writing its profile for a moment after the kill.
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill("SIGKILL");
    await Promise.race([exited, sleep(2000)]);
    server.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(distDir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
