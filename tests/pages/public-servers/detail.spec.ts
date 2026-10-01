import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useAuthStore } from "~/stores/AuthStore";

const state = vi.hoisted(() => ({
  server: null as Record<string, unknown> | null,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        next({ data: { servers_by_pk: state.server } });
        return { unsubscribe() {} };
      },
    }),
  }),
}));

import PublicServerPage from "~/pages/public-servers/[id].vue";
import ServerActivityChart from "~/components/community/ServerActivityChart.vue";

const ME = "76561198000000099";

function entry(rank: number, steamId: string, name: string, seconds: number) {
  return {
    rank,
    steam_id: steamId,
    name,
    avatar_url: null,
    country: null,
    seconds,
    kills: Math.round(seconds / 90),
    deaths: 10,
    sessions: 4,
  };
}

const TOP = [
  entry(1, "76561198000000001", "Mika", 36660),
  entry(2, "76561198000000002", "Vex", 31200),
  entry(3, "76561198000000003", "nyx", 28200),
];

function hourly() {
  const now = Date.now();
  const top = now - (now % (60 * 60 * 1000));

  return Array.from({ length: 168 }, (_, index) => ({
    hour: new Date(top - (167 - index) * 60 * 60 * 1000).toISOString(),
    seconds: index === 100 ? 7200 : 600,
    players: index === 100 ? 9 : 1,
  }));
}

let mounted: { unmount: () => void } | null = null;
let leaderboardCalls: Array<Record<string, unknown>> = [];

function mockQueries(you: Record<string, unknown> | null) {
  leaderboardCalls = [];

  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "query",
  ).mockImplementation(async ({ query, variables }: any) => {
    const name = query.definitions[0]?.name?.value;

    if (name === "PublicServerInfo") {
      return {
        data: {
          getDedicatedServerInfo: [
            { id: "server-1", map: "de_mirage", players: 7, lastPing: null },
          ],
        },
      };
    }

    if (name === "ServerCommunityStats") {
      return {
        data: {
          getServerCommunityStats: {
            server_id: "server-1",
            online: 7,
            max_players: 12,
            week_players: 218,
            week_seconds: 1069200,
            all_time_players: 3412,
            tracked_since: "2026-08-14T00:00:00.000Z",
            hourly: hourly(),
          },
        },
      };
    }

    if (name === "ServerLeaderboard") {
      leaderboardCalls.push(variables);

      return {
        data: { getServerLeaderboard: { entries: TOP, you } },
      };
    }

    return { data: {} };
  });
}

async function mountPage(you: Record<string, unknown> | null) {
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  state.server = {
    id: "server-1",
    label: "Retake #1",
    type: "Retake",
    game: "cs2",
    region: "US-East",
    connected: true,
    connection_link: null,
    connection_string: null,
    max_players: 12,
    game_mode: null,
  };
  mockQueries(you);

  const wrapper = await mountSuspended(PublicServerPage, {
    route: "/public-servers/server-1",
  });
  mounted = wrapper;
  await flushPromises();

  return wrapper;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  useAuthStore().me = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("public server page", () => {
  it("shows the server, its weekly tiles and the activity chart", async () => {
    const wrapper = await mountPage(null);

    expect(wrapper.find("h1").text()).toBe("Retake #1");
    expect(wrapper.find('[data-testid="server-status"]').text()).toContain(
      "7/12",
    );
    expect(wrapper.text()).toContain("Mirage");
    expect(
      wrapper.find('[data-tile="week-players"]').text().replace(/\s/g, ""),
    ).toContain("218");
    expect(wrapper.findAll("[data-day]")).toHaveLength(7);
    expect(wrapper.findAll("[data-peak]")).toHaveLength(1);
  });

  it("pins the signed-in player's own row under the list when they rank outside it", async () => {
    const wrapper = await mountPage(
      entry(14, ME, "kestrel", 3720) as Record<string, unknown>,
    );

    const rows = wrapper.find('[data-testid="leaderboard-rows"]');
    expect(rows.findAll("[data-steam-id]")).toHaveLength(3);
    expect(rows.find("[data-you]").exists()).toBe(false);

    const pinned = wrapper.find('[data-testid="leaderboard-pinned"]');
    expect(pinned.exists()).toBe(true);
    expect(pinned.text()).toContain("· · ·");

    const you = pinned.find(`[data-steam-id="${ME}"]`);
    expect(you.attributes("data-you")).toBe("");
    expect(you.text()).toContain("14");
    expect(you.text()).toContain("kestrel");
    expect(you.text()).toContain("You");
  });

  it("highlights the player's row in place instead of pinning it when they made the list", async () => {
    const wrapper = await mountPage({
      ...TOP[1],
    } as Record<string, unknown>);

    expect(wrapper.find('[data-testid="leaderboard-pinned"]').exists()).toBe(
      false,
    );
    const rows = wrapper.find('[data-testid="leaderboard-rows"]');
    expect(rows.find("[data-you]").attributes("data-steam-id")).toBe(
      "76561198000000002",
    );
  });

  it("asks the api for the period and metric the viewer picks", async () => {
    const wrapper = await mountPage(null);

    expect(leaderboardCalls[0]).toMatchObject({
      serverId: "server-1",
      period: "week",
      metric: "time",
    });

    const kills = wrapper
      .findAll("button")
      .filter((button) => button.text() === "Kills")
      .at(-1);
    await kills!.trigger("click");
    await flushPromises();

    expect(leaderboardCalls.at(-1)).toMatchObject({
      period: "week",
      metric: "kills",
    });
  });

  it("refreshes the leaderboard every two minutes while the page is open", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    await mountPage(null);
    const before = leaderboardCalls.length;

    vi.advanceTimersByTime(2 * 60 * 1000);
    await flushPromises();

    expect(leaderboardCalls).toHaveLength(before + 1);
    expect(leaderboardCalls.at(-1)).toMatchObject({
      period: "week",
      metric: "time",
    });

    mounted?.unmount();
    mounted = null;
    vi.advanceTimersByTime(10 * 60 * 1000);
    await flushPromises();

    expect(leaderboardCalls).toHaveLength(before + 1);
  });
});

describe("server activity chart", () => {
  it("keeps a readable axis for a server with only minutes of play", async () => {
    const wrapper = await mountSuspended(ServerActivityChart, {
      props: {
        hourly: [
          { hour: new Date().toISOString(), seconds: 180, players: 1 },
        ],
        serverLabel: "Retake #1",
      },
    });
    mounted = wrapper;

    const ticks = wrapper
      .findAll('g[aria-hidden="true"] text')
      .map((text) => text.text());

    expect(ticks).toEqual(["0h", "30m", "1h"]);
  });
});
