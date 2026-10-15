// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VIDEO =
  "https://cf.5stack.gg/clips/76561198000000001/0b7c.mp4?name=ace.mp4&v=1&exp=1760400000&sig=abc";

let clip: Record<string, unknown> | null = null;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NUXT_PUBLIC_API_DOMAIN", "api.5stack.gg");
  vi.stubEnv("HASURA_GRAPHQL_ADMIN_SECRET", "secret");
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("$fetch", async () => ({
    data: { match_clips_by_pk: clip },
  }));
  vi.stubGlobal("getRouterParam", (event: any) => event.id);
  vi.stubGlobal("getRequestProtocol", () => "https");
  vi.stubGlobal("getRequestHost", () => "5stack.gg");
  vi.stubGlobal("sendRedirect", (_event: unknown, location: string) => ({
    redirect: location,
  }));
  vi.stubGlobal("setResponseHeader", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function unfurl(visibility: string) {
  clip = {
    id: "c1",
    title: "Ace on B",
    download_url: VIDEO,
    thumbnail_download_url: null,
    duration_ms: 20000,
    visibility,
    target: { name: "Player" },
    match_map: null,
  };
  const handler = (await import("~/server/routes/clips/[id].get"))
    .default as any;
  return handler({ id: "c1" });
}

// The share card is fetched with the admin secret and served to anyone, so the
// signed link it carries is a grant to whoever asks for /clips/<id>.
describe("the clip share card", () => {
  it("embeds a public clip's video", async () => {
    expect(await unfurl("public")).toContain(
      `<meta property="og:video" content="${VIDEO.replaceAll("&", "&amp;")}" />`,
    );
  });

  it.each(["private", "match"])(
    "hands out nothing of a %s clip, only the redirect into the app",
    async (visibility) => {
      expect(await unfurl(visibility)).toEqual({
        redirect: "/highlights?clip=c1",
      });
    },
  );
});
