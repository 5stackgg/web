// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "~/cloudflare-workers/backblaze-proxy/index";

const env = {
  S3_ACCESS_KEY: "key",
  S3_SECRET: "secret",
  BUCKET_NAME: "5stack",
  S3_ENDPOINT: "s3.example.test",
};
const ORIGIN = "https://5stack.gg";

describe("backblaze-proxy map assets", () => {
  let upstream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upstream = vi.fn(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", upstream);
    vi.stubGlobal("caches", {
      default: { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function get(path: string) {
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
    const response = await worker.fetch(
      new Request(`https://demo-dl.5stack.gg/${path}`, { headers: { Origin: ORIGIN } }),
      env,
      ctx as unknown as ExecutionContext,
    );
    const init = upstream.mock.calls[0][1] as { cf: { cacheTtlByStatus: Record<string, number> } };
    return { response, edgeTtl: init.cf.cacheTtlByStatus["200-299"] };
  }

  it("lets latest.json go stale within a minute, at the edge and in the browser", async () => {
    const { response, edgeTtl } = await get("maps/latest.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(edgeTtl).toBe(60);
    expect(upstream.mock.calls[0][0]).toContain("/maps/latest.json");
  });

  it.each(["maps/25537370/manifest.json", "maps/25537370/de_mirage.view.bin.gz"])(
    "keeps %s immutable",
    async (path) => {
      const { response, edgeTtl } = await get(path);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=2592000, immutable",
      );
      expect(edgeTtl).toBe(2592000);
    },
  );

  it.each([
    "maps/latest.json",
    "maps/25537370/manifest.json",
    "maps/25537370/de_mirage.tri.gz",
  ])("answers %s with the same CORS headers", async (path) => {
    const { response } = await get(path);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Content-Length");
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});
