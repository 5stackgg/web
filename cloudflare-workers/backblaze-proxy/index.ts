import { AwsClient } from "aws4fetch";

const UNSIGNABLE_HEADERS = [
  "x-forwarded-proto",
  "x-real-ip",
  "accept-encoding",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  // Strip Range so B2 returns the full 200 once; CF caches it and
  // slices 206s out of cache for every <video> seek.
  "range",
];

function filterHeaders(headers: Headers, env: { ALLOWED_HEADERS?: string }) {
  return new Headers(
    Array.from(headers.entries()).filter(
      (pair) =>
        !(
          UNSIGNABLE_HEADERS.includes(pair[0]) ||
          pair[0].startsWith("cf-") ||
          (env.ALLOWED_HEADERS != null &&
            !env.ALLOWED_HEADERS.includes(pair[0]))
        ),
    ),
  );
}

// Path-style (/clips/<user>/<uuid>.mp4) or query-style (?file=<key>).
function resolveKey(url: URL): string | null {
  const fromQuery = url.searchParams.get("file");
  if (fromQuery) {
    // Older callers built `?file=foo.mp4?dl=1` which parses as
    // file=foo.mp4?dl=1; drop anything past the first `?`.
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

    // cacheEverything is required for MP4/dem responses; per-status
    // TTL keeps 4xx/5xx from getting pinned for 30d.
    const upstream = await fetch(signedRequest.url, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      cf: {
        cacheEverything: true,
        cacheTtl: 2592000,
        cacheTtlByStatus: { "200-299": 2592000, "404": 60, "500-599": 0 },
      },
    });

    const headers = new Headers(upstream.headers);

    const requestedNameRaw = url.searchParams.get("name") ?? "";
    let requestedName = requestedNameRaw;
    try {
      requestedName = decodeURIComponent(requestedNameRaw);
    } catch {
      requestedName = requestedNameRaw;
    }
    const fallbackName = key.split("/").pop() ?? key;
    const sanitize = (s: string) => s.replace(/[\\\/"\r\n]/g, "").trim();
    const filename =
      sanitize(requestedName) || sanitize(fallbackName) || "clip.mp4";

    // Default to inline so pasting a clip URL plays in the browser;
    // ?dl=1 opts into attachment.
    const wantDownload =
      url.searchParams.get("dl") === "1" ||
      url.searchParams.get("download") === "1";
    headers.set(
      "Content-Disposition",
      `${wantDownload ? "attachment" : "inline"}; filename="${filename}"`,
    );

    if (!headers.has("Accept-Ranges")) {
      headers.set("Accept-Ranges", "bytes");
    }
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "public, max-age=2592000, immutable");
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
  // Expose-Headers is required so cross-origin <video> can see
  // Content-Range / Content-Length and seek without rebuffering.
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, If-Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
  };
}
