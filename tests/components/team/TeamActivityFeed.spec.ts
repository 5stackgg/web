import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TeamActivityFeed from "~/components/team/TeamActivityFeed.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ClipTile from "~/components/clips/ClipTile.vue";
import type { Clip } from "~/types/clip";

const { query, playClips, mobile } = vi.hoisted(() => ({
  query: vi.fn(),
  playClips: vi.fn(),
  mobile: { value: false },
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query } }),
}));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasField: async () => false,
}));

vi.mock("~/composables/useClipModal", () => ({
  useClipModal: () => ({ playClips }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(mobile.value) }),
}));

function match(id: string, opponent: string, endedAt: string) {
  return {
    id,
    status: "Finished",
    ended_at: endedAt,
    winning_lineup_id: "l-1",
    lineup_1_id: "l-1",
    lineup_2_id: "l-2",
    lineup_1: { team_id: "team-1", name: "Alpha" },
    lineup_2: { team_id: `team-${opponent}`, name: opponent },
    options: { best_of: 1, type: "Competitive" },
    match_maps: [
      {
        lineup_1_score: 13,
        lineup_2_score: 9,
        winning_lineup_id: "l-1",
        map: { name: "de_inferno", label: "Inferno" },
      },
    ],
  };
}

const team = {
  id: "team-1",
  name: "Alpha",
  can_invite: false,
  roster: [{ player: { steam_id: "1" } }, { player: { steam_id: "2" } }],
  matches: [
    match("m-1", "Bravo", "2026-10-01T00:00:00Z"),
    match("m-2", "Charlie", "2026-09-28T00:00:00Z"),
  ],
};

function clip(id: string, matchId: string, kills: number, seconds: number) {
  return {
    id,
    title: `Best Round (${kills}K)`,
    kills_count: kills,
    round: 4,
    duration_ms: seconds * 1000,
    views_count: 0,
    target: { steam_id: "1", name: `player-${id}`, avatar_url: null },
    match_map: {
      map: { name: "de_mirage", label: "Mirage", poster: null },
      match: { id: matchId },
    },
  } as unknown as Clip;
}

function answerWith(clips: Clip[]) {
  query.mockImplementation(async ({ query: document }) =>
    print(document).includes("match_clips")
      ? { data: { match_clips: clips } }
      : { data: { league_teams: [] } },
  );
}

const CLIPS = [
  clip("a", "m-1", 3, 12),
  clip("b", "m-2", 5, 30),
  clip("c", "m-1", 4, 25),
  clip("d", "m-2", 4, 18),
  clip("e", "m-1", 2, 10),
];

async function mountFeed() {
  const wrapper = await mountSuspended(TeamActivityFeed, {
    props: { team, teamAwards: [] },
  });
  await flushPromises();
  return wrapper;
}

const tiles = (wrapper: Awaited<ReturnType<typeof mountFeed>>) =>
  wrapper.findAll("a[href^='/clips/']");

beforeEach(() => {
  mobile.value = false;
  query.mockReset();
  playClips.mockReset();
});

describe("TeamActivityFeed", () => {
  it("leads with the feed's top plays, four across, and drops each result's clip rail", async () => {
    answerWith(CLIPS);
    const wrapper = await mountFeed();

    expect(tiles(wrapper).map((tile) => tile.attributes("href"))).toEqual([
      "/clips/b",
      "/clips/d",
      "/clips/c",
      "/clips/a",
    ]);
    expect(tiles(wrapper)[0].text()).toContain("player-b");
    expect(tiles(wrapper)[0].text()).toContain("vs Charlie · Mirage");
    expect(wrapper.findComponent(HorizontalScrollRow).exists()).toBe(false);
    expect(wrapper.findComponent(ClipTile).exists()).toBe(false);
  });

  it("keeps to three plays on a phone", async () => {
    mobile.value = true;
    answerWith(CLIPS);
    const wrapper = await mountFeed();

    expect(tiles(wrapper)).toHaveLength(3);
  });

  it("plays a tile with the top plays as the queue", async () => {
    answerWith(CLIPS);
    const wrapper = await mountFeed();

    await tiles(wrapper)[1].trigger("click");

    expect(playClips).toHaveBeenCalledTimes(1);
    const [queue, startId, scope] = playClips.mock.calls[0];
    expect(queue.map((c: Clip) => c.id)).toEqual(["b", "d", "c", "a"]);
    expect(startId).toBe("d");
    expect(scope).toBe("team-activity:team-1");
  });

  it("asks for the team's highlights from the top plays header", async () => {
    answerWith(CLIPS);
    const wrapper = await mountFeed();

    const seeAll = wrapper
      .findAll("button")
      .find((button) => button.text() === "See all");
    await seeAll!.trigger("click");

    expect(wrapper.emitted("all-highlights")).toHaveLength(1);
  });

  it("hides the top plays without public highlights and still lists the results", async () => {
    answerWith([]);
    const wrapper = await mountFeed();

    expect(tiles(wrapper)).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Top plays");
    expect(wrapper.findAll("a[href^='/matches/']")).toHaveLength(2);
  });
});
