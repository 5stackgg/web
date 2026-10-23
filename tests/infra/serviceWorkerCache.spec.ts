// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// The service worker and the scripts it imports keep their URLs across
// deploys, so any cache in front of them keeps handing out the old worker.
vi.stubGlobal("defineNuxtConfig", (config: unknown) => config);
const { default: config } = (await import("../../nuxt.config")) as {
  default: any;
};

const workerScripts = [
  `/${config.pwa.filename ?? "sw.js"}`,
  ...config.pwa.workbox.importScripts,
].map((script: string) => new URL(script, "https://5stack.gg").pathname);

describe("service worker caching", () => {
  it.each(workerScripts)("serves %s with no-store", (path) => {
    expect(config.routeRules?.[path]?.headers?.["Cache-Control"]).toBe(
      "no-store",
    );
  });

  // Nuxt's new build check stamps every request with the time, so each one
  // would be stored as its own entry and push real chunks out of the cache.
  it("leaves the new build check out of the asset cache", () => {
    const assets = config.pwa.workbox.runtimeCaching.find(
      ({ options }: any) => options?.cacheName === "nuxt-assets",
    );
    const cached = (path: string) =>
      assets.urlPattern({ url: new URL(path, "https://5stack.gg") });

    expect(cached("/_nuxt/entry.CtE3kM1a.js")).toBe(true);
    expect(cached(`/_nuxt/builds/latest.json?${Date.now()}`)).toBe(false);
    expect(cached("/_nuxt/builds/meta/3f2c1b.json")).toBe(false);
  });
});
