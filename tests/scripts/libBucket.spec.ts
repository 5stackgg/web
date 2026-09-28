// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openBucket } from "~/scripts/lib-bucket.mjs";

type Handler = (method: string, url: URL, headers: Headers) => Response;

describe("lib-bucket", () => {
  let handler: Handler;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init: { method?: string; headers?: HeadersInit } = {}) => {
        const url = new URL(input);
        const method = init.method ?? "GET";
        calls.push(`${method} ${url.pathname}${url.search}`);
        return handler(method, url, new Headers(init.headers));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const bucket = () =>
    openBucket({ accessKey: "k", secret: "s", bucket: "b", endpoint: "s3.example.test" });
  const isList = (url: URL) => url.searchParams.get("list-type") === "2";
  const listing = (keys: string[]) => {
    const contents = keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("");
    return new Response(`<ListBucketResult>${contents}</ListBucketResult>`);
  };

  it("reads a 404 as absent without listing", async () => {
    handler = () => new Response(null, { status: 404 });
    expect(await bucket().head("maps/1/a.tri.gz")).toBeNull();
    expect(await bucket().get("maps/latest.json")).toBeNull();
    expect(calls.some((c) => c.includes("list-type"))).toBe(false);
  });

  it("returns the stored sha256 of an existing key", async () => {
    handler = () => new Response(null, { status: 200, headers: { "x-amz-meta-sha256": "abc" } });
    expect(await bucket().head("maps/1/a.tri.gz")).toEqual({ sha256: "abc" });
  });

  it("settles a 403 by listing the exact key", async () => {
    handler = (_, url) =>
      isList(url) ? listing(["maps/1/a.tri.gz.old"]) : new Response(null, { status: 403 });
    expect(await bucket().head("maps/1/a.tri.gz")).toBeNull();
    expect(await bucket().get("maps/1/a.tri.gz")).toBeNull();

    handler = (_, url) =>
      isList(url) ? listing(["maps/1/a.tri.gz"]) : new Response(null, { status: 403 });
    expect(await bucket().head("maps/1/a.tri.gz")).toEqual({ sha256: null });
    await expect(bucket().get("maps/1/a.tri.gz")).rejects.toThrow(/403/);
  });

  it("fails closed when a 403 cannot be settled", async () => {
    handler = () => new Response(null, { status: 403 });
    await expect(bucket().head("maps/1/a.tri.gz")).rejects.toThrow(/listFiles/);
    await expect(bucket().exists("maps/1/a.tri.gz")).rejects.toThrow(/listFiles/);
    await expect(bucket().get("maps/latest.json")).rejects.toThrow(/listFiles/);
  });

  it("fails closed on a persistent 5xx", async () => {
    handler = () => new Response(null, { status: 503 });
    await expect(bucket().head("maps/1/a.tri.gz")).rejects.toThrow(/503/);
    await expect(bucket().get("maps/latest.json")).rejects.toThrow(/503/);
  });

  it("stores the sha256 it is given as object metadata", async () => {
    let sent: Headers | null = null;
    handler = (method, _, headers) => {
      sent = headers;
      return new Response(null, { status: method === "PUT" ? 200 : 404 });
    };
    await bucket().put("maps/1/a.tri.gz", Buffer.from("x"), {
      type: "application/gzip",
      sha256: "abc",
    });
    expect(sent!.get("x-amz-meta-sha256")).toBe("abc");
  });
});
