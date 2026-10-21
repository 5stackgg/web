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
});
