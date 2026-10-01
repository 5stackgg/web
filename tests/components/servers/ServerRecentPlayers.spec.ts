import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerRecentPlayers from "~/components/servers/ServerRecentPlayers.vue";

const MINUTE = 60 * 1000;

function recent(
  steamId: string,
  name: string,
  ip: string,
  extra: Record<string, unknown> = {},
) {
  return {
    server_id: "server-1",
    player_steam_id: steamId,
    name,
    ip,
    sessions: 3,
    seconds_played: 3720,
    kills: 40,
    first_seen_at: new Date(Date.now() - 3 * 24 * 60 * MINUTE).toISOString(),
    last_seen_at: new Date(Date.now() - 38 * MINUTE).toISOString(),
    online: false,
    player: null,
    ...extra,
  };
}

const NYX = recent("76561198000000011", "nyx", "203.0.113.24", {
  online: true,
  player: {
    steam_id: "76561198000000011",
    name: "nyx",
    avatar_url: null,
    is_registered: true,
  },
});
const FLICK = recent("76561198000000012", "lil_flick", "192.0.2.201");
const QUILL = recent("76561198000000013", "Quill", "198.51.100.140");

const state = vi.hoisted(() => ({
  firstPage: [] as Array<Record<string, unknown>>,
  nextPage: [] as Array<Record<string, unknown>>,
  searchHold: null as Promise<void> | null,
}));

let mounted: { unmount: () => void } | null = null;
let calls: Array<{ name: string; variables: any }> = [];

function mockQueries() {
  calls = [];

  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "query",
  ).mockImplementation(async ({ query, variables }: any) => {
    const name = query.definitions[0]?.name?.value;
    calls.push({ name, variables });

    if (name === "ServerRecentPlayers") {
      const searching = variables.where._and.length > 1;

      if (searching && state.searchHold) {
        await state.searchHold;
      }

      return {
        data: {
          server_recent_players:
            variables.offset > 0
              ? state.nextPage
              : searching
                ? [QUILL]
                : state.firstPage,
          server_recent_players_aggregate: {
            aggregate: { count: searching ? 1 : 218 },
          },
        },
      };
    }

    if (name === "ServerRecentPlayerTotals") {
      return {
        data: {
          day: { aggregate: { count: 41 } },
          week: {
            aggregate: {
              count: 218,
              sum: { sessions: 637, seconds_played: 1452600 },
            },
          },
        },
      };
    }

    if (name === "ServerSessionsOnIps") {
      return {
        data: {
          server_player_sessions: [
            {
              ip: "203.0.113.24",
              player_steam_id: "76561198000000011",
              name: "nyx",
              player: null,
            },
            {
              ip: "203.0.113.24",
              player_steam_id: "76561199077712345",
              name: "cheatyboi",
              player: {
                steam_id: "76561199077712345",
                name: "cheatyboi",
                is_registered: true,
              },
            },
          ],
        },
      };
    }

    return { data: {} };
  });
}

async function mountCard(props: Record<string, unknown> = {}) {
  mockQueries();

  const wrapper = await mountSuspended(ServerRecentPlayers, {
    props: { serverId: "server-1", rosterRevision: 0, ...props },
  });
  mounted = wrapper;
  await flushPromises();

  return wrapper;
}

function callsOf(name: string) {
  return calls.filter((call) => call.name === name);
}

function loadMoreButton(wrapper: Awaited<ReturnType<typeof mountCard>>) {
  return wrapper.findAll("button").find((b) => b.text() === "Load More");
}

beforeEach(() => {
  state.firstPage = [NYX, FLICK];
  state.nextPage = [];
  state.searchHold = null;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServerRecentPlayers", () => {
  it("hands the week's totals to the page and labels the per-player figures as 7-day ones", async () => {
    const wrapper = await mountCard();

    const totals = wrapper.emitted("totals") ?? [];
    expect(totals[totals.length - 1]?.[0]).toEqual({
      day: 41,
      week: 218,
      sessions: 637,
      seconds: 1452600,
    });
    expect(wrapper.find("[data-tile]").exists()).toBe(false);

    const headers = wrapper.findAll("th").map((th) => th.text());
    expect(headers).toContain("Sessions · 7d");
    expect(headers).toContain("Time Played · 7d");

    const rows = wrapper.findAll("tr[data-steam-id]");
    expect(rows[0].text()).toContain("Online");
    expect(rows[1].text()).toContain("lil_flick");
    expect(rows[1].text()).toContain("Steam only");
    expect(wrapper.text()).toContain("Showing 2 of 218");
    expect(loadMoreButton(wrapper)).toBeDefined();
  });

  it("flags an IP any other account used on this server in the last 7 days", async () => {
    const wrapper = await mountCard();

    const shared = wrapper.find(
      '[data-steam-id="76561198000000011"] [data-shared-ip]',
    );
    expect(shared.text()).toContain("×2");
    expect(shared.attributes("aria-label")).toContain(
      "Same IP in the last 7 days: cheatyboi",
    );
    expect(
      wrapper
        .find('[data-steam-id="76561198000000012"] [data-shared-ip]')
        .exists(),
    ).toBe(false);

    const lookup = callsOf("ServerSessionsOnIps").at(-1)!.variables;
    expect(lookup.ips).toEqual(["203.0.113.24", "192.0.2.201"]);
    expect(lookup.serverId).toBe("server-1");
  });

  it("appends the next page without repeating a player already listed", async () => {
    const wrapper = await mountCard();
    state.nextPage = [FLICK, QUILL];

    await loadMoreButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(callsOf("ServerRecentPlayers").at(-1)!.variables.offset).toBe(2);
    expect(
      wrapper
        .findAll("tr[data-steam-id]")
        .map((row) => row.attributes("data-steam-id")),
    ).toEqual(["76561198000000011", "76561198000000012", "76561198000000013"]);
  });

  it("ignores Load More while a search is still loading, so pages never mix filters", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountCard();

    let release!: () => void;
    state.searchHold = new Promise((resolve) => {
      release = resolve;
    });
    state.nextPage = [QUILL];

    await wrapper.find('input[type="search"]').setValue("Quill");
    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(loadMoreButton(wrapper)!.attributes("disabled")).toBeDefined();
    await loadMoreButton(wrapper)!.trigger("click");

    release();
    await flushPromises();

    expect(
      callsOf("ServerRecentPlayers").some((call) => call.variables.offset > 0),
    ).toBe(false);
    expect(
      wrapper
        .findAll("tr[data-steam-id]")
        .map((row) => row.attributes("data-steam-id")),
    ).toEqual(["76561198000000013"]);
  });

  it("searches names and IPs, and matches a numeric query as a Steam ID", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountCard();

    await wrapper.find('input[type="search"]').setValue("76561198000000012");
    vi.advanceTimersByTime(300);
    await flushPromises();

    const where = callsOf("ServerRecentPlayers").at(-1)!.variables.where;
    const search = where._and[1]._or;

    expect(where.server_id).toEqual({ _eq: "server-1" });
    expect(search).toContainEqual({ name: { _ilike: "%76561198000000012%" } });
    expect(search).toContainEqual({ ip: { _ilike: "%76561198000000012%" } });
    expect(search).toContainEqual({
      player_steam_id: { _eq: "76561198000000012" },
    });
  });

  it("refetches a couple of seconds after the live roster changes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountCard();
    const before = callsOf("ServerRecentPlayers").length;

    await wrapper.setProps({ rosterRevision: 1 });
    await wrapper.setProps({ rosterRevision: 2 });
    vi.advanceTimersByTime(1999);
    await flushPromises();
    expect(callsOf("ServerRecentPlayers")).toHaveLength(before);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(callsOf("ServerRecentPlayers")).toHaveLength(before + 1);
    expect(callsOf("ServerRecentPlayers").at(-1)!.variables.limit).toBe(25);
  });

  it("still refetches on a busy server whose roster never stops changing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountCard();
    const before = callsOf("ServerRecentPlayers").length;

    for (let revision = 1; revision <= 4; revision++) {
      await wrapper.setProps({ rosterRevision: revision });
      vi.advanceTimersByTime(1500);
      await flushPromises();
    }

    expect(callsOf("ServerRecentPlayers")).toHaveLength(before + 1);
  });

  it("drops a pending refetch when the card goes away", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = await mountCard();
    const before = calls.length;

    await wrapper.setProps({ rosterRevision: 1 });
    mounted?.unmount();
    mounted = null;
    vi.advanceTimersByTime(10000);
    await flushPromises();

    expect(calls).toHaveLength(before);
  });
});
