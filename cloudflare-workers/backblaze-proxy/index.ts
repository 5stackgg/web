import { AwsClient } from "aws4fetch";

// Headers we don't carry through to the signed S3 request. Conditional
// request headers complicate the v4 signature without buying us much
// (the worker isn't a write proxy), and the cf-/proto/ip headers are
// edge-only metadata that backblaze rejects when present.
const UNSIGNABLE_HEADERS = [
  "x-forwarded-proto",
  "x-real-ip",
  "accept-encoding",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
];

function filterHeaders(headers: Headers, env: { ALLOWED_HEADERS?: string }) {
  return new Headers(
    Array.from(headers.entries()).filter(
      (pair) =>
        !(
          UNSIGNABLE_HEADERS.includes(pair[0]) ||
          pair[0].startsWith("cf-") ||
          (env.ALLOWED_HEADERS != null && !env.ALLOWED_HEADERS.includes(pair[0]))
        ),
    ),
  );
}

// Resolve which S3 object the caller wants. Two URL forms are supported:
//
//   1. Path-style:  https://<worker>/clips/<user>/<uuid>.mp4
//   2. Query-style: https://<worker>/?file=clips/<user>/<uuid>.mp4
//
// Path-style is the friendlier one — the URL ends in a real filename
// so browsers + chat apps render the right thing in previews, and it
// matches the shape the api stores on `match_clips.s3_url`. Query-style
// is preserved so anything still pointing at the old `?file=` URLs (or
// callers building them manually) keeps working.
function resolveKey(url: URL): string | null {
  const fromQuery = url.searchParams.get("file");
  if (fromQuery) {
    // Defensive: strip any stray query suffix that snuck into the
    // value. Older callers built URLs like `?file=foo.mp4?dl=1`
    // (a `?` after a URL that already had a query string), which
    // browsers parse as `file=foo.mp4?dl=1` — meaning the key we'd
    // ask Backblaze for ends in `?dl=1` and 404s. Anything past the
    // first `?` in the key isn't part of an S3 key anyway.
    const cleaned = fromQuery.split("?")[0];
    return cleaned ? decodeURIComponent(cleaned) : null;
  }
  const fromPath = url.pathname.replace(/^\/+/, "");
  return fromPath ? decodeURIComponent(fromPath) : null;
}

export default {
  async fetch(
    request: Request,
    env: {
      S3_ACCESS_KEY: string;
      S3_SECRET: string;
      BUCKET_NAME: string;
      S3_ENDPOINT: string;
      ALLOWED_HEADERS?: string;
    },
  ) {
    // CORS preflight. <video crossorigin> + Range requests trigger
    // preflights for `Range` cross-origin; respond before doing any
    // work so we don't burn cpu signing for an OPTIONS noop.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(null, {
        status: 405,
        statusText: "Method Not Allowed",
      });
    }

    const url = new URL(request.url);
    const key = resolveKey(url);
    if (!key) {
      return new Response("No file provided", { status: 400 });
    }

    // Bail loudly when env vars are missing instead of letting
    // aws4fetch sign a URL with empty hostname segments (which
    // surfaces as a Cloudflare 1016 "origin DNS" error and is hard
    // to diagnose from the outside).
    if (!env.BUCKET_NAME || !env.S3_ENDPOINT) {
      return new Response(
        "Worker misconfigured: BUCKET_NAME / S3_ENDPOINT not set",
        { status: 500 },
      );
    }
    if (!env.S3_ACCESS_KEY || !env.S3_SECRET) {
      return new Response(
        "Worker misconfigured: S3_ACCESS_KEY / S3_SECRET not set",
        { status: 500 },
      );
    }

    const signedRequest = await new AwsClient({
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET,
      service: "s3",
    }).sign(`https://${env.BUCKET_NAME}.${env.S3_ENDPOINT}/${key}`, {
      method: request.method,
      headers: filterHeaders(request.headers, env),
    });

    const upstream = await fetch(signedRequest.url, {
      method: signedRequest.method,
      headers: signedRequest.headers,
    });

    const headers = new Headers(upstream.headers);

    // Only force a download when the caller explicitly asked. Default
    // behaviour is `inline` so <video src> on the clip detail page (and
    // pasting a clip URL into a new tab) plays the file instead of
    // dumping it to the user's downloads folder. The web's "Download"
    // button appends ?dl=1 to opt in.
    const wantDownload =
      url.searchParams.get("dl") === "1" ||
      url.searchParams.get("download") === "1";
    if (wantDownload) {
      const filename = key.split("/").pop() ?? key;
      headers.set(
        "Content-Disposition",
        `attachment; filename="${filename.replace(/"/g, "")}"`,
      );
    } else {
      // Strip any attachment disposition Backblaze might have set so
      // <video> playback isn't blocked by Chromium's "Save As" path.
      headers.delete("Content-Disposition");
    }

    // Streaming + seeking for <video src>:
    //   - Backblaze already responds 206 + Content-Range when the
    //     browser sends Range; that flows through unchanged because we
    //     reuse upstream.status / upstream.body.
    //   - Some Backblaze responses omit Accept-Ranges on the initial
    //     200; set it explicitly so the player knows it can issue
    //     range requests for seeks.
    //   - Cross-origin <video> can't see Content-Range / Content-Length
    //     unless they're in Access-Control-Expose-Headers — without
    //     that the player buffers the whole file before any seek works.
    if (!headers.has("Accept-Ranges")) {
      headers.set("Accept-Ranges", "bytes");
    }
    for (const [k, v] of Object.entries(corsHeaders())) {
      headers.set(k, v);
    }

    return new Response(upstream.body, {
      headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, If-Range, Content-Type",
    // Without these the <video> element gets an opaque response and
    // can't read Content-Range / Content-Length — which means it
    // can't seek without re-buffering the whole file.
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
  };
}
