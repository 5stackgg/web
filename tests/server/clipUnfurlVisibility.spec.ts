// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let record: any = null;
const redirects: Array<string> = [];

beforeEach(() => {
  vi.resetModules();
  redirects.length = 0;
  vi.stubEnv("NUXT_PUBLIC_API_DOMAIN", "api.5stack.gg");
  vi.stubEnv("HASURA_GRAPHQL_ADMIN_SECRET", "secret");
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("$fetch", async () => ({ data: record }));
  vi.stubGlobal("getRequestProtocol", () => "https");
  vi.stubGlobal("getRequestHost", () => "5stack.gg");
  vi.stubGlobal("getRouterParam", (event: any) => event.id);
  vi.stubGlobal("sendRedirect", (_event: unknown, location: string) => {
    redirects.push(location);
    return "redirected";
  });
  vi.stubGlobal("setResponseHeader", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// The card is built with the admin secret for whoever asks, a crawler
// included, so it may only describe a clip anyone signed out could watch.
describe("the clip share card's visibility", () => {
  async function card(visibility: string) {
    record = {
      match_clips_by_pk: {
        id: "c1",
        title: "secret strat",
        download_url: "https://demos.5stack.gg/clips/c1?name=c1.mp4&v=1",
        thumbnail_download_url:
          "https://demos.5stack.gg/clips/c1/thumbnail?v=1",
        duration_ms: 12000,
        visibility,
        target: { name: "ropz" },
        match_map: {
          map: { name: "de_ancient", label: null },
          match: { lineup_1: { name: "Alpha" }, lineup_2: { name: "Bravo" } },
        },
      },
    };
    const handler = (await import("~/server/routes/clips/[id].get"))
      .default as any;
    return handler({ id: "c1" });
  }

  it.each(["private", "match"])(
    "sends a %s clip to the app without a card",
    async (visibility) => {
      const result = await card(visibility);

      expect(result).toBe("redirected");
      expect(redirects).toEqual(["/highlights?clip=c1"]);
    },
  );

  it("still unfurls a public clip as an inline video", async () => {
    const html = await card("public");

    expect(html).toContain(
      '<meta property="og:video" content="https://demos.5stack.gg/clips/c1?name=c1.mp4&amp;v=1" />',
    );
    expect(html).toContain("<title>secret strat</title>");
    expect(redirects).toEqual([]);
  });
});
