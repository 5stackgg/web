import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerMatchScoreboard from "~/components/player/PlayerMatchScoreboard.vue";

const lineup = (id: string, steamId: string, withStats: boolean) => ({
  id,
  name: `Team ${id}`,
  lineup_players: [
    {
      steam_id: steamId,
      player: {
        steam_id: steamId,
        match_stats: withStats ? [{ kills: 10, deaths: 8 }] : [],
      },
    },
  ],
});

function match(withStats: boolean) {
  return {
    id: "m1",
    started_at: null,
    ended_at: null,
    match_maps: [],
    lineup_1: lineup("l1", "1", withStats),
    lineup_2: lineup("l2", "2", withStats),
  };
}

const baseProps = {
  focusSteamId: "1",
  activeTab: "overview",
  selectedMapId: null,
  matchRanks: {},
  rankMove: null,
  seasonBest: null,
  score: { player: 13, opponent: 10 },
  result: "won" as const,
  typeLabel: "Competitive",
  sourceLabel: "5Stack",
  clipsCount: 0,
};

const stubs = {
  LineupOverview: true,
  LineupUtility: true,
  LineupTradeStats: true,
  LineupAimStats: true,
  MatchRankBadge: true,
};

function placeholder(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.find('[aria-busy="true"]');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlayerMatchScoreboard loading", () => {
  it("never shows the skeleton when the data lands fast", async () => {
    const wrapper = await mountSuspended(PlayerMatchScoreboard, {
      props: { ...baseProps, match: match(false), loading: true },
      global: { stubs },
    });

    // Reserves the tables' space, but invisibly.
    expect(placeholder(wrapper).exists()).toBe(true);
    expect(placeholder(wrapper).classes()).toContain("opacity-0");

    vi.advanceTimersByTime(150);
    await wrapper.setProps({ match: match(true), loading: false });

    expect(placeholder(wrapper).exists()).toBe(false);
    vi.advanceTimersByTime(500);
    await nextTick();
    expect(placeholder(wrapper).exists()).toBe(false);
  });

  it("shows the skeleton on a slow load and holds it long enough to read", async () => {
    const wrapper = await mountSuspended(PlayerMatchScoreboard, {
      props: { ...baseProps, match: match(false), loading: true },
      global: { stubs },
    });

    vi.advanceTimersByTime(250);
    await nextTick();
    expect(placeholder(wrapper).classes()).toContain("opacity-100");

    // Shown at 200ms; the data lands at 300ms. It stays up for its 350ms
    // minimum, so until 550ms.
    vi.advanceTimersByTime(50);
    await wrapper.setProps({ match: match(true), loading: false });
    expect(placeholder(wrapper).exists()).toBe(true);

    vi.advanceTimersByTime(249);
    await nextTick();
    expect(placeholder(wrapper).exists()).toBe(true);

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(placeholder(wrapper).exists()).toBe(false);
  });
});
