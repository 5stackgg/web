#!/usr/bin/env node
// Bakes 5Stack's own radar images from the replay stage's map: each map
// straight down through an orthographic camera, framed by the calibration in
// public/radars/metadata.json so the existing projection lands on the same
// pixels (maps without one get a calibration of their own).
//
//   node scripts/replay-stage/bake-radars.mjs [de_mirage de_nuke ...] \
//     [--out public/radars/stage] [--work <dir>] [--size 4096] [--line 1.1] \
//     [--composite-only] [--check <dir>]
//
// Writes, per map, into --out:
//   <map>.png / <map>@2x.png          1024 / 2048, set in the stage's dunes,
//                                     what lies outside play washed toward sand
//   <map>_cut.png / <map>_cut@2x.png  transparent outside the playable area
//   <map>_<volume>[_cut][@2x].png     per-room radars, for volumes whose
//                                     bounds carry minZ/maxZ (rooms stack)
// and metadata.json beside them, in the same shape as public/radars'.
// Without map names it bakes every map the asset manifest has a view mesh for.
//
// Nuke and Vertigo stack two storeys on one image: each split is drawn cut
// at the main level's lowest floor and set where its `offset` puts it. The
// raw renders stay in --work, so --composite-only re-runs the compositing
// alone. --check writes the alignment report (old radar vs new, see
// `alignment`) and side-by-sides into <dir>.
//
// The harness (harness/radar.html) is built with Vite and driven in headless
// Chrome on SwiftShader like shot.mjs, so it needs no GPU: about ten seconds
// a map. Run it outside the sandbox (Chrome will not start inside it).
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { bestShift, distanceTo, footprint } from "./radar-raster.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const ASSETS_ROOT = "https://demo-dl.5stack.gg/maps";
const RADAR_PX = 1024;
const OUT_PX = 2048;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const VALUE_FLAGS = new Set(["--out", "--work", "--size", "--line", "--check"]);
const only = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));
const outDir = path.resolve(flag("--out", path.join(webRoot, "public/radars/stage")));
const workDir = path.resolve(flag("--work", path.join(tmpdir(), "radar-bake")));
const size = Number(flag("--size", 4096));
const line = Number(flag("--line", 1.1));
const checkDir = flag("--check", null) && path.resolve(flag("--check"));
const compositeOnly = args.includes("--composite-only");

const cacheDir = path.join(webRoot, "node_modules/.cache/replay-stage-assets");
const legacy = JSON.parse(readFileSync(path.join(webRoot, "public/radars/metadata.json"), "utf8"));
const metadataPath = path.join(outDir, "metadata.json");

async function manifestMaps() {
  const latest = await (await fetch(`${ASSETS_ROOT}/latest.json`)).json();
  const manifest = await (await fetch(`${ASSETS_ROOT}/${latest.manifest}`)).json();
  return manifest.maps;
}

async function ensureMapAssets(map, entry) {
  for (const [kind, ext] of [["view", ".view.bin.gz"], ["callouts", ".callouts.json"]]) {
    const file = path.join(cacheDir, map + ext);
    if (existsSync(file) || !entry[kind]) continue;
    const res = await fetch(`${ASSETS_ROOT}/${entry[kind]}`);
    if (!res.ok) throw new Error(`${entry[kind]}: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

async function buildHarness(distDir) {
  const { build: viteBuild } = await import("vite");
  await viteBuild({
    root: path.join(here, "harness"),
    base: "./",
    logLevel: "warn",
    resolve: { alias: { "~": webRoot } },
    build: {
      outDir: distDir,
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: path.join(here, "harness/radar.html") },
    },
  });
}

function serve(distDir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "POST" && url.pathname.startsWith("/out/")) {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        writeFileSync(path.join(workDir, path.basename(url.pathname)), Buffer.concat(chunks));
        res.writeHead(204).end();
      });
      return;
    }
    const file = url.pathname.startsWith("/assets/") && !existsSync(path.join(distDir, url.pathname))
      ? path.join(cacheDir, path.basename(url.pathname))
      : path.join(distDir, url.pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function launchChrome() {
  const chromePath = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => p && existsSync(p));
  if (!chromePath) throw new Error("no Chrome found; set CHROME_PATH");
  const profile = mkdtempSync(path.join(tmpdir(), "radar-bake-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
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
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Renders every level of each map into workDir; returns what the page reported. */
async function renderMaps(maps) {
  const distDir = mkdtempSync(path.join(tmpdir(), "radar-bake-dist-"));
  await buildHarness(distDir);
  const server = await serve(distDir);
  const port = server.address().port;
  const { chrome, profile, browserWs } = await launchChrome();
  const client = cdp(browserWs);
  await client.ready;
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  await client.send("Runtime.enable", {}, sessionId);
  const logs = [];
  client.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      logs.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  });
  const reports = {};
  try {
    for (const map of maps) {
      const started = Date.now();
      logs.length = 0;
      const job = { map, size, line, calib: legacy[map] ?? null };
      const query = Buffer.from(JSON.stringify(job)).toString("base64");
      await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/radar.html?job=${encodeURIComponent(query)}` }, sessionId);
      let state = null;
      for (let i = 0; i < 6000 && !state?.ready; i++) {
        await sleep(200);
        const { result } = await client
          .send("Runtime.evaluate", { expression: "JSON.stringify({ ready: !!window.__radarReady, error: window.__radarError ?? null, radar: window.__radar ?? null })", returnByValue: true }, sessionId)
          .catch(() => ({ result: {} }));
        state = result.value ? JSON.parse(result.value) : null;
      }
      for (const entry of logs) console.log(`  ${entry}`);
      if (!state?.radar) throw new Error(`${map}: ${state?.error ?? "timed out"}`);
      reports[map] = state.radar;
      writeFileSync(path.join(workDir, `${map}.json`), JSON.stringify(state.radar, null, 2));
      console.log(`${map}: rendered ${state.radar.levels.length} level(s) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  } finally {
    client.close();
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill("SIGKILL");
    await Promise.race([exited, sleep(2000)]);
    server.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    rmSync(distDir, { recursive: true, force: true });
  }
  return reports;
}

const N = OUT_PX;
const work = (map, level, kind) => path.join(workDir, `${map}.${level}.${kind}.png`);

async function loadLevel(map, level) {
  const color = await sharp(work(map, level.name, "color")).resize(N, N, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
  // Green is walkable floor inside the playable area; red takes in the rest.
  const floor = await sharp(work(map, level.name, "floor")).resize(N, N).extractChannel(1).raw().toBuffer();
  return { color, floor };
}

async function blurred(alpha, sigma) {
  const bytes = Buffer.alloc(N * N);
  for (let i = 0; i < N * N; i++) bytes[i] = Math.round(alpha[i] * 255);
  return sharp(bytes, { raw: { width: N, height: N, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
}

// A 256-colour palette with dithering is indistinguishable here at a third
// of the size of truecolour.
const PNG = { palette: true, colours: 256, dither: 1, compressionLevel: 9 };

async function save(file, raw, channels) {
  const image = () => sharp(raw, { raw: { width: N, height: N, channels } });
  await image().png(PNG).toFile(`${file}@2x.png`);
  await image().resize(RADAR_PX, RADAR_PX, { kernel: "lanczos3" }).png(PNG).toFile(`${file}.png`);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * One radar image from its levels, main first: in the dunes (each lower
 * storey set on the main render as an inset with a soft shadow) and cut out
 * of transparency. The playable area gets a thin ink rim where it is cut,
 * and in the dunes what lies outside it is washed toward the sand, so the
 * edge of play reads at a glance. Returns the levels' playable floor.
 */
async function composeImage(name, map, levels, resolution, palette) {
  const px = N / (RADAR_PX * resolution);
  const rim = N / RADAR_PX;
  const ink = rgb(palette.outline);
  const sand = rgb(palette.sand);
  const layers = [];
  for (const level of levels) {
    const { color, floor } = await loadLevel(map, level);
    const alpha = footprint(floor, N, { close: 64 * px, grow: 24 * px, minIsland: (192 * px) ** 2 });
    layers.push({ color, floor, alpha });
  }
  // Where storeys would overlap the main level keeps its place.
  const taken = new Float32Array(N * N);
  for (const layer of layers) {
    for (let i = 0; i < N * N; i++) {
      layer.alpha[i] *= 1 - taken[i];
      taken[i] += layer.alpha[i];
    }
    const inside = distanceTo(layer.alpha.map((a) => (a < 0.5 ? 1 : 0)), N);
    layer.rim = inside.map((d) => (d > 0 ? Math.min(1, Math.max(0, rim + 0.5 - d)) : 0));
  }
  const dune = Buffer.from(layers[0].color);
  const main = layers[0];
  for (let i = 0; i < N * N; i++) {
    const wash = 0.3 * (1 - main.alpha[i]);
    const edge = 0.35 * main.rim[i];
    for (let c = 0; c < 3; c++) {
      const v = dune[i * 3 + c];
      dune[i * 3 + c] = Math.round(v + (sand[c] - v) * wash + (ink[c] - v) * edge);
    }
  }
  for (const layer of layers.slice(1)) {
    // Down and right, as the map's own sun throws it.
    const shadow = await blurred(layer.alpha, 6 * px);
    const drop = Math.round(10 * px);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const s = x >= drop && y >= drop ? shadow[(y - drop) * N + x - drop] / 255 : 0;
        const a = layer.alpha[i];
        for (let c = 0; c < 3; c++) {
          const under = dune[i * 3 + c] * (1 - 0.4 * s);
          const over = layer.color[i * 3 + c] + (ink[c] - layer.color[i * 3 + c]) * 0.55 * layer.rim[i];
          dune[i * 3 + c] = Math.round(under + (over - under) * a);
        }
      }
    }
  }
  const cut = Buffer.alloc(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const a = Math.min(1, taken[i]);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (const layer of layers) {
        const v = layer.color[i * 3 + c];
        sum += (v + (ink[c] - v) * 0.55 * layer.rim[i]) * layer.alpha[i];
      }
      cut[i * 4 + c] = Math.round(sum / taken[i]);
    }
    cut[i * 4 + 3] = Math.round(a * 255);
  }
  await save(path.join(outDir, name), dune, 3);
  await save(path.join(outDir, `${name}_cut`), cut, 4);
  const floor = new Uint8Array(N * N);
  for (const layer of layers) for (let i = 0; i < N * N; i++) floor[i] |= layer.floor[i] >= 128;
  return { name, dune, cut, floor };
}

/** Where `projectWithCalibration` puts a world point on a 1024px radar. */
function project(p, calib) {
  const split = (calib.splits ?? []).find((s) => p.z > s.bounds.bottom && p.z < s.bounds.top);
  const dx = split ? split.offset.x : 0;
  const dy = split ? split.offset.y : 0;
  return {
    x: (p.x + calib.offset.x) / calib.resolution + (dx / 100) * RADAR_PX,
    y: RADAR_PX - ((p.y + calib.offset.y) / calib.resolution + (dy / 100) * RADAR_PX),
  };
}

const KEY_CALLOUTS = /^(Bombsite[AB]|CTSpawn|TSpawn)$/;

/**
 * Lines the new playable floor up against the old radar's drawn area (both
 * 1024px masks): the best shift over the whole image, and over a 3x3 grid of
 * windows, whose shifts are fitted to a scale about the centre plus a
 * residual. Shifts are pixels of the 1024px radar, positive right / down.
 * Each key callout's centre, projected as the app projects players, is
 * checked to land on floor in both images.
 */
async function alignment(map, calib, image) {
  const n = RADAR_PX;
  const floor = await sharp(Buffer.from(image.floor.map((v) => v * 255)), { raw: { width: N, height: N, channels: 1 } }).resize(n, n).extractChannel(0).raw().toBuffer();
  const b = Uint8Array.from(floor, (v) => (v > 127 ? 1 : 0));
  const oldFile = path.join(webRoot, "public/radars", `${image.name}.png`);
  const old = existsSync(oldFile) ? await sharp(oldFile).resize(n, n).ensureAlpha().raw().toBuffer() : null;
  // Drawn: opaque and not the black some of Valve's own radars sit on.
  const a = old && Uint8Array.from({ length: n * n }, (_, i) => (old[i * 4 + 3] > 127 && Math.max(old[i * 4], old[i * 4 + 1], old[i * 4 + 2]) > 16 ? 1 : 0));
  const round = (v) => Math.round(v * 100) / 100;
  const near = (mask, x, y) => {
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (mask[(y + oy) * n + x + ox]) return true;
    return false;
  };
  const callouts = [];
  const calloutsFile = path.join(cacheDir, `${map}.callouts.json`);
  for (const callout of existsSync(calloutsFile) && image.name === map ? JSON.parse(readFileSync(calloutsFile, "utf8")).callouts : []) {
    if (!KEY_CALLOUTS.test(callout.name)) continue;
    const box = callout.boxes[0];
    const at = project({ x: (box.min[0] + box.max[0]) / 2, y: (box.min[1] + box.max[1]) / 2, z: box.min[2] + 32 }, calib);
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    callouts.push({ name: callout.name, x, y, old: a ? near(a, x, y) : null, new: near(b, x, y) });
  }
  if (!a) return { callouts };

  const whole = bestShift(a, b, n, 8);
  const cell = n / 3;
  const windows = [];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const window = [gx * cell, gy * cell, gx * cell + cell, gy * cell + cell].map(Math.round);
      let both = 0;
      for (let y = window[1]; y < window[3]; y++) for (let x = window[0]; x < window[2]; x++) both += a[y * n + x] & b[y * n + x];
      if (both < cell * cell * 0.05) continue;
      const shift = bestShift(a, b, n, 8, window);
      // An optimum on the edge of the search is no optimum.
      if (Math.max(Math.abs(shift.dx), Math.abs(shift.dy)) < 7.5) {
        windows.push({ x: (gx + 0.5) * cell - n / 2, y: (gy + 0.5) * cell - n / 2, ...shift });
      }
    }
  }
  const mean = (key) => windows.reduce((sum, w) => sum + w[key], 0) / windows.length;
  const mx = mean("dx");
  const my = mean("dy");
  let num = 0;
  let den = 0;
  for (const w of windows) {
    num += w.x * (w.dx - mx) + w.y * (w.dy - my);
    den += w.x * w.x + w.y * w.y;
  }
  const scale = den ? num / den : 0;
  const residual = Math.max(0, ...windows.map((w) => Math.hypot(w.dx - mx - scale * w.x, w.dy - my - scale * w.y)));
  return {
    dx: round(whole.dx),
    dy: round(whole.dy),
    overlap: round(whole.iou0),
    windows: windows.length,
    scalePercent: round(scale * 100),
    residual: round(residual),
    callouts,
  };
}

/** Old radar, new, new cut, and new under the old radar's outline, 2x2. */
async function comparison(image, calib, report) {
  const n = RADAR_PX;
  const card = { r: 24, g: 24, b: 27 };
  const tile = (input) => sharp(input).resize(n, n).flatten({ background: card }).raw().toBuffer();
  const oldFile = path.join(webRoot, "public/radars", `${image.name}.png`);
  const old = existsSync(oldFile) ? await sharp(oldFile).resize(n, n).ensureAlpha().raw().toBuffer() : null;
  const dune = await tile(path.join(outDir, `${image.name}.png`));
  const overlay = Buffer.from(dune);
  if (old) {
    const inside = (x, y) => x >= 0 && y >= 0 && x < n && y < n && old[(y * n + x) * 4 + 3] > 127;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (inside(x, y) !== inside(x + 1, y) || inside(x, y) !== inside(x, y + 1)) {
          overlay.set([255, 0, 255], (y * n + x) * 3);
        }
      }
    }
  }
  const marks = (report?.callouts ?? [])
    .map((c) => `<circle cx="${c.x}" cy="${c.y}" r="7" fill="none" stroke="#00e5ff" stroke-width="3"/><text x="${c.x + 10}" y="${c.y - 8}" fill="#00e5ff" font-size="20" font-family="sans-serif">${c.name}</text>`)
    .join("");
  const label = (text) => Buffer.from(`<svg width="${n}" height="${n}"><rect x="12" y="12" width="${text.length * 13 + 24}" height="36" rx="6" fill="#000a"/><text x="24" y="38" fill="#fff" font-size="22" font-family="sans-serif">${text}</text>${text === "overlay" ? marks : ""}</svg>`);
  const panel = async (raw, text) =>
    sharp(raw, { raw: { width: n, height: n, channels: 3 } }).composite([{ input: label(text) }]).png().toBuffer();
  const panels = [
    old ? await panel(await tile(oldFile), "old") : null,
    await panel(dune, "new"),
    await panel(await tile(path.join(outDir, `${image.name}_cut.png`)), "new cut"),
    await panel(overlay, "overlay"),
  ];
  await sharp({ create: { width: n * 2, height: n * 2, channels: 3, background: card } })
    .composite(panels.map((input, i) => input && { input, left: (i % 2) * n, top: (i >> 1) * n }).filter(Boolean))
    .png()
    .toFile(path.join(checkDir, `${image.name}_compare.png`));
}

async function compose(map, report) {
  const { calib } = report;
  const stacked = report.levels.filter((level) => !level.xy);
  const images = [await composeImage(map, map, stacked, calib.resolution, report.palette)];
  for (const level of report.levels.filter((l) => l.xy)) {
    const volume = calib.volumes.find((v) => v.name === level.name);
    images.push(await composeImage(`${map}_${level.name}`, map, [level], volume.resolution, report.palette));
  }
  const checks = {};
  if (checkDir) {
    mkdirSync(checkDir, { recursive: true });
    for (const image of images) {
      checks[image.name] = await alignment(map, calib, image);
      await comparison(image, calib, checks[image.name]);
    }
  }
  return checks;
}

function writeMetadata(reports) {
  const existing = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf8")) : {};
  const { _comment, ...entries } = existing;
  for (const [map, report] of Object.entries(reports)) {
    // Only the rooms that were baked: the viewer would ask for the rest.
    const { volumes, ...calib } = report.calib;
    const baked = volumes?.filter((v) => report.levels.some((level) => level.xy && level.name === v.name));
    entries[map] = baked?.length ? { ...calib, volumes: baked } : calib;
  }
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((map) => [map, entries[map]]));
  const comment =
    "5Stack's own radars, baked from the replay stage's map by scripts/replay-stage/bake-radars.mjs. Same shape and meaning as ../metadata.json; maps that have a radar there keep its calibration unchanged, so either image can be drawn under the same projection. <map>.png is 1024px in the stage's dunes, <map>_cut.png transparent outside the playable area, @2x the 2048px versions.";
  writeFileSync(metadataPath, `${JSON.stringify({ _comment: comment, ...sorted }, null, 2)}\n`);
}

async function main() {
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  let maps = only;
  if (!compositeOnly) {
    const entries = await manifestMaps();
    if (!maps.length) maps = Object.keys(entries).filter((map) => entries[map].view).sort();
    for (const map of maps) {
      if (!entries[map]?.view) throw new Error(`${map} has no published view mesh`);
      await ensureMapAssets(map, entries[map]);
    }
    await renderMaps(maps);
  } else if (!maps.length) {
    maps = readdirSync(workDir).filter((f) => /^[^.]+\.json$/.test(f)).map((f) => f.slice(0, -5)).sort();
  }
  const reports = {};
  const checks = {};
  for (const map of maps) {
    reports[map] = JSON.parse(readFileSync(path.join(workDir, `${map}.json`), "utf8"));
    Object.assign(checks, await compose(map, reports[map]));
    console.log(`${map}: composed`);
  }
  writeMetadata(reports);
  if (checkDir) {
    writeFileSync(path.join(checkDir, "alignment.json"), JSON.stringify(checks, null, 2));
    for (const [name, check] of Object.entries(checks)) {
      const floors = check.callouts.map((c) => `${c.name}${c.new ? "" : " (off new floor)"}${c.old === false ? " (off old floor)" : ""}`).join(", ");
      const versus = "dx" in check
        ? `shift ${check.dx},${check.dy}px, overlap ${check.overlap}, scale ${check.scalePercent}%, ${check.windows} windows within ${check.residual}px`
        : "no old radar";
      console.log(`${name}: ${versus}; callouts ${floors || "none"}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
