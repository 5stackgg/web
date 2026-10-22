import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import LeaderboardBoard from "~/components/leaderboard/LeaderboardBoard.vue";
import type { LeaderboardEntry } from "~/utilities/leaderboard";

const entry = (
  rank: number,
  value: number,
  extra: Partial<LeaderboardEntry> = {},
): LeaderboardEntry => ({
  rank,
  player_steam_id: `p${rank}`,
  player_name: `Player ${rank}`,
  player_avatar_url: null,
  player_custom_avatar_url: null,
  player_country: null,
  value,
  secondary_value: 10,
  tertiary_value: 2,
  matches_played: 7,
  ...extra,
});

function mountBoard(
  props: { entries: LeaderboardEntry[] } & Record<string, unknown>,
) {
  return mountSuspended(LeaderboardBoard, {
    props: {
      category: "elo",
      leaderValue: null,
      selectedSteamId: null,
      meSteamId: null,
      highlightedSteamId: null,
      ...props,
    },
  });
}

describe("LeaderboardBoard", () => {
  it("stands the top three on a podium, leader in the middle", async () => {
    const wrapper = await mountBoard({
      entries: [6000, 5800, 5600, 5400, 5200].map((v, i) => entry(i + 1, v)),
    });

    const pods = wrapper.findAll(".lb-pod");
    expect(pods.map((p) => p.attributes("data-steam-id"))).toEqual([
      "p2",
      "p1",
      "p3",
    ]);
    expect(
      wrapper
        .findAll(".lb-row[data-steam-id]")
        .map((r) => r.attributes("data-steam-id")),
    ).toEqual(["p4", "p5"]);
  });

  it("draws ELO distance to #1 from the 5000 start", async () => {
    const wrapper = await mountBoard({
      entries: [6000, 5800, 5600, 5500].map((v, i) => entry(i + 1, v)),
    });

    const fill = wrapper.find('.lb-row[data-steam-id="p4"] .lb-track i');
    expect(fill.attributes("style")).toContain("width: 50.0%");
  });

  it("measures later pages against the board's leader", async () => {
    const wrapper = await mountBoard({
      category: "best_kdr",
      leaderValue: 2,
      entries: [entry(11, 1), entry(12, 0.5)],
    });

    expect(wrapper.findAll(".lb-pod")).toHaveLength(0);
    const fill = wrapper.find('.lb-row[data-steam-id="p11"] .lb-track i');
    expect(fill.attributes("style")).toContain("width: 50.0%");
  });

  it("shows medals instead of a bar on the awards board", async () => {
    const wrapper = await mountBoard({
      category: "awards",
      entries: [1, 2, 3, 4].map((rank) =>
        entry(rank, 4 - rank, { secondary_value: 1, tertiary_value: 0 }),
      ),
    });

    const row = wrapper.find('.lb-row[data-steam-id="p4"]');
    expect(row.find(".lb-track").exists()).toBe(false);
    expect(row.find(".lb-medals").text()).toBe("010");
  });

  it("selects a player from a row or a podium card", async () => {
    const wrapper = await mountBoard({
      entries: [6000, 5800, 5600, 5400].map((v, i) => entry(i + 1, v)),
    });

    await wrapper.find('.lb-row[data-steam-id="p4"]').trigger("click");
    await wrapper.find('.lb-pod[data-steam-id="p1"]').trigger("keydown", {
      key: "Enter",
    });

    expect(
      wrapper.emitted("select")?.map(([e]) => (e as LeaderboardEntry).rank),
    ).toEqual([4, 1]);
  });
});
