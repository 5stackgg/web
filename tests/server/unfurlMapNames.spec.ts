// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOT_UA,
  renderUnfurl,
  truncate,
  unfurlCacheHeaders,
} from "~/server/utils/unfurl";

let record: any = null;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NUXT_PUBLIC_API_DOMAIN", "api.5stack.gg");
  vi.stubEnv("HASURA_GRAPHQL_ADMIN_SECRET", "secret");
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("$fetch", async () => ({ data: record }));
  vi.stubGlobal("getRequestURL", (event: any) => new URL(event.url));
  vi.stubGlobal("getRequestHeader", () => "Discordbot/2.0");
  vi.stubGlobal("getRequestProtocol", () => "https");
  vi.stubGlobal("getRequestHost", () => "5stack.gg");
  vi.stubGlobal("getRouterParam", (event: any) => event.id);
  vi.stubGlobal("sendRedirect", () => "redirected");
  vi.stubGlobal("setResponseHeader", () => {});
  vi.stubGlobal("setResponseHeaders", () => {});
  vi.stubGlobal("BOT_UA", BOT_UA);
  vi.stubGlobal("renderUnfurl", renderUnfurl);
  vi.stubGlobal("truncate", truncate);
  vi.stubGlobal("unfurlCacheHeaders", unfurlCacheHeaders);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function description(html: string) {
  return html.match(/<meta name="description" content="([^"]*)"/)?.[1];
}

describe("the match share card", () => {
  async function card(map: { name: string; label: string | null }) {
    record = {
      matches_by_pk: {
        id: "m1",
        status: "Finished",
        lineup_1_id: "l1",
        lineup_2_id: "l2",
        winning_lineup_id: "l1",
        e_match_status: { description: "Finished" },
        options: { best_of: 1, type: "Competitive" },
        lineup_1: { name: "Alpha", team: null },
        lineup_2: { name: "Bravo", team: null },
        match_maps: [
          {
            is_current_map: false,
            lineup_1_score: 13,
            lineup_2_score: 7,
            winning_lineup_id: "l1",
            map: { ...map, poster: null },
          },
        ],
        tournament_brackets: [],
      },
    };
    const handler = (await import("~/server/middleware/matches-unfurl"))
      .default as any;
    return handler({ method: "GET", url: "https://5stack.gg/matches/m1" });
  }

  it("names an official map by its label, never its de_ name", async () => {
    expect(description(await card({ name: "de_ancient", label: null }))).toBe(
      "Finished · Ancient",
    );
  });

  it("keeps a workshop map's own label", async () => {
    expect(
      description(await card({ name: "3070923343", label: "Rooftops" })),
    ).toBe("Finished · Rooftops");
  });
});

describe("the clip share card", () => {
  async function card(map: { name: string; label: string | null }) {
    record = {
      match_clips_by_pk: {
        id: "c1",
        title: null,
        download_url: "https://cf.5stack.gg/clips/c1.mp4",
        thumbnail_download_url: null,
        duration_ms: 12000,
        visibility: "public",
        target: { name: "ropz" },
        match_map: {
          map,
          match: { lineup_1: { name: "Alpha" }, lineup_2: { name: "Bravo" } },
        },
      },
    };
    const handler = (await import("~/server/routes/clips/[id].get")).default as any;
    return handler({ id: "c1" });
  }

  it("names an official map by its label, never its de_ name", async () => {
    const html = await card({ name: "de_ancient", label: null });

    expect(html).toContain("<title>ropz — Ancient</title>");
    expect(description(html)).toBe("Alpha vs Bravo · Ancient");
  });
});
