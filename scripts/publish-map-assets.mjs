// Upload built map assets to the 5stack bucket, behind the existing Cloudflare
// worker (cloudflare-workers/backblaze-proxy).
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
// Objects are stored GZIPPED with `Content-Encoding: gzip`. The worker copies
// upstream B2 headers through untouched, so browsers and Go's http client both
// decompress transparently and no consumer needs a change. It is worth a lot:
// inferno is 18.6 MB raw and 2.4 MB on the wire.
//
//   S3_ACCESS_KEY=... S3_SECRET=... node scripts/publish-map-assets.mjs --build 24957633
//   ... --build 24957633 --dry-run
import { AwsClient } from "aws4fetch";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BUILD = value("--build", process.env.CS2_BUILD ?? "");
const DRY = has("--dry-run");
const BUCKET = process.env.BUCKET_NAME || "5stack";
const ENDPOINT = process.env.S3_ENDPOINT || "s3.us-east-005.backblazeb2.com";
const ACCESS = process.env.S3_ACCESS_KEY;
const SECRET = process.env.S3_SECRET;

if (!BUILD || !/^\d+$/.test(BUILD)) {
  console.error("--build <cs2 build id> is required (digits only)");
  process.exit(1);
}

if (!DRY && (!ACCESS || !SECRET)) {
  console.error(
    "S3_ACCESS_KEY and S3_SECRET are required.\n" +
      "  Locally they are in web/.dev.vars; in prod they are worker secrets.",
  );
  process.exit(1);
}

const client = DRY
  ? null
  : new AwsClient({ accessKeyId: ACCESS, secretAccessKey: SECRET, service: "s3" });

const sources = [
  { dir: join(root, ".cache", "meshes"), match: /\.tri$/, type: "application/octet-stream" },
  {
    dir: join(root, ".cache", "callouts"),
    match: /\.callouts\.json$/,
    type: "application/json",
  },
];

async function put(key, body, contentType) {
  const url = `https://${BUCKET}.${ENDPOINT}/${key}`;
  const signed = await client.sign(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Encoding": "gzip",
      "Content-Length": String(body.length),
    },
    body,
  });

  const response = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text().catch(() => "")}`);
  }
}

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
      const key = `maps/${BUILD}/${name}`;

      files += 1;
      raw += body.length;
      sent += packed.length;

      if (DRY) {
        console.log(
          `  would put ${key.padEnd(46)} ${(body.length / 1e6).toFixed(1)} MB -> ${(packed.length / 1e6).toFixed(1)} MB`,
        );
        continue;
      }

      await put(key, packed, source.type);
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
