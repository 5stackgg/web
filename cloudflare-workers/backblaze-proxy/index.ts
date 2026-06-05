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
      UPLOAD_TOKEN_SECRET?: string;
    },
    ctx: ExecutionContext,
  ) {
    const reqOrigin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(reqOrigin),
      });
    }

    if (request.method === "PUT") {
      return handleUpload(request, env, reqOrigin);
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(null, {
        status: 405,
        statusText: "Method Not Allowed",
      });
    }

    // Edge-cache short-circuit: serve repeat hits without re-running SigV4
    // or making a B2 subrequest. Range requests fall through so the existing
    // cf.cacheEverything path handles slicing from the cached full object.
    // The cache key includes Origin so each calling origin gets a response
    // with its own Access-Control-Allow-Origin — required for credentialed
    // fetches, which can't accept `*`.
    const cache = caches.default;
    const cacheKey = new Request(`${request.url}#origin=${reqOrigin ?? ""}`, {
      method: "GET",
    });
    const skipEdgeCache =
      request.method !== "GET" || request.headers.has("range");
    if (!skipEdgeCache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
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
    // Force long browser cache regardless of what B2 returned — second view
    // of a clip serves from the user's disk cache and never hits the Worker.
    headers.set("Cache-Control", "public, max-age=2592000, immutable");
    for (const [k, v] of Object.entries(corsHeaders(reqOrigin))) {
      headers.set(k, v);
    }

    const response = new Response(upstream.body, {
      headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });

    if (!skipEdgeCache && response.status === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};

const UPLOAD_PREFIX = "demo-uploads/";
// B2 multipart part ceiling we accept; the API chunks at 64MiB so anything
// larger is a malformed/abusive request.
const MAX_PART_BYTES = 64 * 1024 * 1024;

async function handleUpload(
  request: Request,
  env: {
    S3_ACCESS_KEY: string;
    S3_SECRET: string;
    BUCKET_NAME: string;
    S3_ENDPOINT: string;
    UPLOAD_TOKEN_SECRET?: string;
  },
  reqOrigin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/+/, "");
  const partNumber = url.searchParams.get("partNumber");
  const uploadId = url.searchParams.get("uploadId");
  const token = url.searchParams.get("token");

  if (!key.startsWith(UPLOAD_PREFIX) || !partNumber || !uploadId || !token) {
    return new Response("forbidden", {
      status: 403,
      headers: corsHeaders(reqOrigin),
    });
  }
  if (
    !env.BUCKET_NAME ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY ||
    !env.S3_SECRET ||
    !env.UPLOAD_TOKEN_SECRET
  ) {
    return new Response("Worker misconfigured", {
      status: 500,
      headers: corsHeaders(reqOrigin),
    });
  }

  // Authorize the part write: the API mints this token (HMAC over key+uploadId
  // with the shared UPLOAD_TOKEN_SECRET) only for authenticated admins. Without
  // this check the worker would sign arbitrary writes for anyone with a valid
  // uploadId.
  if (!(await verifyUploadToken(env.UPLOAD_TOKEN_SECRET, token, key, uploadId))) {
    return new Response("forbidden", {
      status: 403,
      headers: corsHeaders(reqOrigin),
    });
  }

  // The streamed body needs an explicit, bounded Content-Length — we forward
  // the client's value but never trust it blindly.
  const contentLengthRaw = request.headers.get("content-length");
  if (
    !contentLengthRaw ||
    !/^\d+$/.test(contentLengthRaw) ||
    Number(contentLengthRaw) > MAX_PART_BYTES
  ) {
    return new Response("invalid content-length", {
      status: 413,
      headers: corsHeaders(reqOrigin),
    });
  }

  const target = `https://${env.BUCKET_NAME}.${env.S3_ENDPOINT}/${key}?partNumber=${encodeURIComponent(
    partNumber,
  )}&uploadId=${encodeURIComponent(uploadId)}`;

  const signed = await new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET,
    service: "s3",
  }).sign(target, {
    method: "PUT",
    headers: { "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
  });

  const headers = new Headers(signed.headers);
  headers.set("content-length", contentLengthRaw);

  const upstream = await fetch(target, {
    method: "PUT",
    headers,
    body: request.body,
  });

  const responseHeaders = new Headers(corsHeaders(reqOrigin));
  const etag = upstream.headers.get("etag");
  if (etag) {
    responseHeaders.set("ETag", etag);
  }

  if (upstream.ok) {
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function base64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Verifies the API-minted token: HMAC-SHA256 over the `payload` segment, then
// confirms the payload is bound to this exact key+uploadId and not expired.
// crypto.subtle.verify is constant-time, avoiding signature-timing leaks.
async function verifyUploadToken(
  secret: string,
  token: string,
  key: string,
  uploadId: string,
): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const message = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let signatureBytes: Uint8Array;
  let payloadBytes: Uint8Array;
  try {
    signatureBytes = base64urlToBytes(signature);
    payloadBytes = base64urlToBytes(message);
  } catch {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    signatureBytes,
    new TextEncoder().encode(message),
  );
  if (!valid) return false;

  let payload: { k?: unknown; u?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return false;
  }
  if (payload.k !== key || payload.u !== uploadId) return false;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return false;
  }
  return true;
}

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  // Reflect the request's Origin so credentialed fetches (which can't
  // accept Allow-Origin: *) work. Non-CORS requests (no Origin header)
  // fall back to `*` — same as before, keeps anon <video>/<a> usage
  // unchanged. Vary: Origin keeps shared caches from leaking the wrong
  // value to a different origin.
  const allowOrigin = reqOrigin ?? "*";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Range, If-Range, Content-Type, Content-Length",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
    Vary: "Origin",
  };
  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
