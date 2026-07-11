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
  // Strip Range so B2/edge cache always hold one full 200; the worker
  // slices 206s out of it itself (sliceBody).
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

const VIEW_FRACTION = 0.5;
const BOT_UA =
  /bot|crawl|spider|facebookexternalhit|slack|discord|telegram|whatsapp|preview|unfurl|embed|scrape|metainspector|skype|vkshare|redditbot|pinterest|googlebot|bingbot/i;

// Fires the view when delivered bytes cross the file's VIEW_FRACTION
// position (range start + bytes streamed). Responses starting past the
// threshold never count — those are end-of-file moov probes or tail seeks,
// not a watched first half. Repeat beacons are deduped API-side per viewer.
function countingBody(
  body: ReadableStream<Uint8Array>,
  size: number,
  startOffset: number,
  onEnough: () => void,
): ReadableStream<Uint8Array> {
  if (!Number.isFinite(size) || size <= 0) {
    return body;
  }
  const threshold = size * VIEW_FRACTION;
  if (startOffset >= threshold) {
    return body;
  }
  let position = startOffset;
  let fired = false;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        if (fired) {
          return;
        }
        position += chunk.byteLength;
        if (position >= threshold) {
          fired = true;
          onEnough();
        }
      },
    }),
  );
}

// Single-range parser; null (incl. multi-range) → serve the full 200,
// which the spec permits.
function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header || !Number.isFinite(size) || size <= 0) {
    return null;
  }
  const match = /^bytes\s*=\s*(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return null;
  }
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) {
      return "unsatisfiable";
    }
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  if (start >= size) {
    return "unsatisfiable";
  }
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (end < start) {
    return null;
  }
  return { start, end };
}

// Cuts [start, end] out of a full-object stream; terminate() cancels the
// source so a 2-byte probe doesn't drain a 50 MB body.
function sliceBody(
  body: ReadableStream<Uint8Array>,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  let position = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (position > end) {
          controller.terminate();
          return;
        }
        const chunkStart = position;
        position += chunk.byteLength;
        if (position <= start) {
          return;
        }
        controller.enqueue(
          chunk.subarray(
            Math.max(0, start - chunkStart),
            Math.min(chunk.byteLength, end + 1 - chunkStart),
          ),
        );
        if (position > end) {
          controller.terminate();
        }
      },
    }),
  );
}

async function viewerKey(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}\n${ua}`),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Whether this request is a viewable clip stream we should track. The
// actual increment is gated on bytes delivered (see countingBody).
function shouldTrackView(
  request: Request,
  url: URL,
  key: string | null,
  env: { API_URL?: string },
): boolean {
  if (!env.API_URL || request.method !== "GET" || !key) {
    return false;
  }
  if (!/^clips\/.+\.mp4$/.test(key)) {
    return false;
  }
  if (
    url.searchParams.get("dl") === "1" ||
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("noview") === "1"
  ) {
    return false;
  }
  if (BOT_UA.test(request.headers.get("user-agent") ?? "")) {
    return false;
  }
  return true;
}

function registerView(
  request: Request,
  key: string,
  env: { S3_SECRET: string; API_URL?: string },
  ctx: ExecutionContext,
) {
  ctx.waitUntil(
    viewerKey(request)
      .then((clientKey) =>
        fetch(`${env.API_URL!.replace(/\/+$/, "")}/clip-views/play`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.S3_SECRET}`,
          },
          body: JSON.stringify({ file: key, clientKey }),
        }),
      )
      .catch(() => {}),
  );
}

// Client response from a full-object 200: mp4 Content-Type fix, 206
// slicing, view counting. baseHeaders is not mutated — the caller may
// still cache.put the full object with them.
function clientResponse(
  status: number,
  statusText: string,
  baseHeaders: Headers,
  body: ReadableStream<Uint8Array> | null,
  opts: {
    rangeHeader: string | null;
    key: string;
    track: boolean;
    request: Request;
    env: { S3_SECRET: string; API_URL?: string };
    ctx: ExecutionContext;
  },
): Response {
  const headers = new Headers(baseHeaders);
  if (/\.mp4$/i.test(opts.key)) {
    // B2 stored old clips as binary/octet-stream; players refuse non-video/*.
    headers.set("Content-Type", "video/mp4");
  }
  if (status !== 200 || !body) {
    return new Response(body, { status, statusText, headers });
  }
  headers.set("Accept-Ranges", "bytes");

  const size = Number(baseHeaders.get("content-length"));
  const range = parseRange(opts.rangeHeader, size);
  if (range === "unsatisfiable") {
    opts.ctx.waitUntil(body.cancel());
    headers.delete("Content-Length");
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers,
    });
  }

  let stream = body;
  let startOffset = 0;
  if (range) {
    stream = sliceBody(stream, range.start, range.end);
    startOffset = range.start;
    status = 206;
    statusText = "Partial Content";
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
  }
  if (opts.track) {
    stream = countingBody(stream, size, startOffset, () =>
      registerView(opts.request, opts.key, opts.env, opts.ctx),
    );
  }
  if (range) {
    // Gives the 206 a real Content-Length (streamed bodies otherwise go
    // chunked) and hard-asserts the slice math.
    stream = stream.pipeThrough(
      new FixedLengthStream(range.end - range.start + 1),
    );
  }
  return new Response(stream, { status, statusText, headers });
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
      API_URL?: string;
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

    const url = new URL(request.url);
    const key = resolveKey(url);
    const track = shouldTrackView(request, url, key, env);
    const rangeHeader =
      request.method === "GET" ? request.headers.get("range") : null;

    // Edge cache stores only full 200s; Range requests slice a 206 out of
    // the cached object. Origin is in the cache key so each caller gets its
    // own Access-Control-Allow-Origin (credentialed fetches can't take `*`).
    const cache = caches.default;
    const cacheKey = new Request(`${request.url}#origin=${reqOrigin ?? ""}`, {
      method: "GET",
    });
    const skipEdgeCache = request.method !== "GET";
    if (!skipEdgeCache) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return clientResponse(
          cached.status,
          cached.statusText,
          cached.headers,
          cached.body,
          { rangeHeader, key: key ?? "", track, request, env, ctx },
        );
      }
    }

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

    const willCache = !skipEdgeCache && upstream.status === 200;

    // Tee before slicing/counting: the cache copy must drain the FULL
    // object even for a 2-byte range, and the counter must only see bytes
    // the client actually pulls.
    let clientStream = upstream.body;
    let cacheStream: ReadableStream<Uint8Array> | null = null;
    if (willCache && clientStream) {
      const tees = clientStream.tee();
      clientStream = tees[0];
      cacheStream = tees[1];
    }

    const response = clientResponse(
      upstream.status,
      upstream.statusText,
      headers,
      clientStream,
      { rangeHeader, key, track, request, env, ctx },
    );

    if (willCache && cacheStream) {
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(cacheStream, {
            headers: new Headers(headers),
            status: upstream.status,
            statusText: upstream.statusText,
          }),
        ),
      );
    }

    return response;
  },
};

// Every write is still individually authorized by the API-minted HMAC token
// below; the prefix list only bounds which trees are writable at all.
const UPLOAD_PREFIXES = ["demo-uploads/", "events/"];
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
  },
  reqOrigin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/+/, "");
  const partNumber = url.searchParams.get("partNumber");
  const uploadId = url.searchParams.get("uploadId");
  const token = url.searchParams.get("token");

  if (
    !UPLOAD_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
    !partNumber ||
    !uploadId ||
    !token
  ) {
    return new Response("forbidden", {
      status: 403,
      headers: corsHeaders(reqOrigin),
    });
  }
  if (
    !env.BUCKET_NAME ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY ||
    !env.S3_SECRET
  ) {
    return new Response("Worker misconfigured", {
      status: 500,
      headers: corsHeaders(reqOrigin),
    });
  }

  // Authorize the part write: the API mints this token (HMAC over key+uploadId
  // keyed on the shared S3_SECRET) only for authenticated admins. Without this
  // check the worker would sign arbitrary writes for anyone with a valid
  // uploadId.
  if (!(await verifyUploadToken(env.S3_SECRET, token, key, uploadId))) {
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
