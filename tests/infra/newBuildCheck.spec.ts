// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadNuxtConfig } from "@nuxt/kit";
import { describe, expect, it } from "vitest";

// Nuxt fetches builds/latest.json on this interval and, when it names another
// build, reloads the tab at its next navigation.
const { experimental } = await loadNuxtConfig({ cwd: process.cwd() });

describe("new build check", () => {
  it("looks for a new build every 5 minutes", () => {
    expect(experimental.checkOutdatedBuildInterval).toBe(5 * 60 * 1000);
  });

  it("keeps the build manifest the check compares against", () => {
    expect(experimental.appManifest).toBe(true);
  });

  it("leaves Nuxt reloading a stale tab at its next navigation", () => {
    expect(experimental.emitRouteChunkError).toBe("automatic");
  });

  // Loaded on demand, it would be a chunk of the build the deploy replaced, and
  // a chunk that fails to load reloads the page (plugins/chunkReload.client.ts).
  it("ships the notice with the app rather than loading it when needed", () => {
    const app = readFileSync(join(process.cwd(), "app.vue"), "utf8");

    expect(app).toMatch(
      /^import AppUpdateNotice from "~\/components\/AppUpdateNotice\.vue";$/m,
    );
    expect(app).toContain("<AppUpdateNotice />");
  });
});
