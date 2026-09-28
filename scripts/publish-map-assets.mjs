// Upload built map assets to the 5stack bucket, behind the existing Cloudflare
// worker (cloudflare-workers/backblaze-proxy in 5stack-panel).
//
// WHY NOT jsDelivr ANY MORE. It refuses any file over ~20MiB with a 403 (not a
// 404), which the 3D viewer reads as "no mesh" and silently answers with the
// flat radar. Fitting under it meant decimating every large map hard. The
// worker in front of B2 has no such cap, already sets
// `Cache-Control: public, max-age=2592000, immutable`, and already serves
// Ranges -- so the only thing that had to change was where the bytes live.
//
// EVERY URL IS IMMUTABLE, keyed by CS2 build: maps/<build>/<map>.tri. Bump the
// build and the URL changes, which is the whole cache-busting story -- exactly
// what the tag did on jsDelivr. Never overwrite a published build in place.
//
// MESHES ARE PUBLISHED AS `<map>.tri.gz` AND DECOMPRESSED BY THE CONSUMER.
// Storing them with `Content-Encoding: gzip` and letting the CDN handle it does
// NOT work, measured: a Worker's `fetch` auto-decompresses a gzip subresponse
// and strips the header, and Cloudflare's edge only re-compresses MIME types on
// its compressible list -- `application/octet-stream` is not one. Inferno came
// back 18.6 MB on the wire instead of 2.4 MB. So the mesh carries its own gzip,
// the same way the replay blob does (see `fetchReplayBlob`, which pipes through
// a DecompressionStream). Callouts stay plain `.json`, where `Content-Encoding`
// DOES survive because the edge compresses JSON itself (8,971 -> 1,295 bytes).
//
// THIS IS THE MANUAL PATH. The automatic one is build-map-assets.mjs, which
// also writes the manifest and moves maps/latest.json; this script only puts
// files under maps/<build>/ and leaves both alone.
//
//   S3_ACCESS_KEY=... S3_SECRET=... node scripts/publish-map-assets.mjs --build 24957633
//   ... --build 24957633 --dry-run
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bucketFromEnv } from "./lib-bucket.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BUILD = value("--build", process.env.CS2_BUILD ?? "");
const DRY = has("--dry-run");

if (!BUILD || !/^\d+$/.test(BUILD)) {
  console.error("--build <cs2 build id> is required (digits only)");
  process.exit(1);
}

const bucket = DRY ? null : bucketFromEnv();

if (!DRY && !bucket) {
  console.error(
    "S3_ACCESS_KEY and S3_SECRET are required.\n" +
      "  Locally they are in web/.dev.vars; in prod they are worker secrets.",
  );
  process.exit(1);
}

const sources = [
  {
    dir: join(root, ".cache", "meshes"),
    match: /\.(tri|view\.bin)$/,
    // The gzip IS the artifact here, not a transfer encoding.
    suffix: ".gz",
    type: "application/gzip",
    encoding: null,
  },
  {
    dir: join(root, ".cache", "callouts"),
    match: /\.callouts\.json$/,
    suffix: "",
    type: "application/json",
    encoding: "gzip",
  },
];

async function main() {
  let files = 0;
  let raw = 0;
  let sent = 0;

  for (const source of sources) {
    if (!existsSync(source.dir)) {
      console.warn(`• nothing staged in ${source.dir}`);
      continue;
    }

    for (const name of readdirSync(source.dir).filter((f) => source.match.test(f)).sort()) {
      const body = readFileSync(join(source.dir, name));
      const packed = gzipSync(body, { level: 9 });
      const key = `maps/${BUILD}/${name}${source.suffix}`;

      files += 1;
      raw += body.length;
      sent += packed.length;

      if (DRY) {
        console.log(
          `  would put ${key.padEnd(46)} ${(body.length / 1e6).toFixed(1)} MB -> ${(packed.length / 1e6).toFixed(1)} MB`,
        );
        continue;
      }

      // The same x-amz-meta-sha256 (of the uncompressed bytes) that
      // build-map-assets.mjs writes, so either publisher recognises the
      // other's file and neither ever overwrites one.
      const sha256 = createHash("sha256").update(body).digest("hex");
      const existing = await bucket.head(key);
      if (existing && existing.sha256 === sha256) {
        console.log(`  kept ${key} (already published, same sha256)`);
        continue;
      }
      if (existing) {
        throw new Error(
          `${key} is already published -- builds are immutable, never overwritten`,
        );
      }
      await bucket.put(key, packed, {
        type: source.type,
        encoding: source.encoding,
        sha256,
      });
      console.log(
        `  ${key.padEnd(46)} ${(body.length / 1e6).toFixed(1)} MB -> ${(packed.length / 1e6).toFixed(1)} MB`,
      );
    }
  }

  console.log(
    `\n${DRY ? "(dry run) " : ""}${files} file(s), ${(raw / 1e6).toFixed(0)} MB raw, ${(sent / 1e6).toFixed(0)} MB stored`,
  );
  console.log(`base URL: https://demo-dl.5stack.gg/maps/${BUILD}`);
}

await main();
