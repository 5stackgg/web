// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTeamActivity, topPlays } from "~/components/team/teamActivity";
import type { Clip } from "~/types/clip";

const NOW = new Date("2026-10-22T12:00:00Z");

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
      { lineup_1_score: 13, lineup_2_score: 9, map: { name: "de_inferno" } },
    ],
  };
}

function clip(
  id: string,
  matchId: string,
  kills: number,
  seconds: number,
  map = "Inferno",
): Clip {
  return {
    id,
    kills_count: kills,
    duration_ms: seconds * 1000,
    views_count: 0,
    match_map: { map: { name: "de_x", label: map }, match: { id: matchId } },
  } as Clip;
}

function activity(clips: Clip[]) {
  return buildTeamActivity({
    teamId: "team-1",
    matches: [
      match("m-1", "Bravo", "2026-10-20T00:00:00Z"),
      match("m-2", "Charlie", "2026-10-10T00:00:00Z"),
    ],
    awards: [],
    leagueTeams: [],
    clips,
    invites: [],
    createdAt: "2026-01-01T00:00:00Z",
    now: NOW,
  });
}

describe("topPlays", () => {
  it("ranks the plays across every result by most kills, then the shortest", () => {
    const events = activity([
      clip("a", "m-1", 3, 12),
      clip("b", "m-2", 5, 30),
      clip("c", "m-1", 4, 25),
      clip("d", "m-2", 4, 18),
    ]);

    expect(topPlays(events, 3).map((play) => play.clip.id)).toEqual([
      "b",
      "d",
      "c",
    ]);
  });

  it("names the opponent and the map each play happened on", () => {
    const [play] = topPlays(activity([clip("a", "m-2", 4, 20, "Mirage")]), 4);

    expect(play).toMatchObject({ opponent: "Charlie", map: "Mirage" });
  });

  it("is empty when the results have no clips", () => {
    expect(topPlays(activity([]), 4)).toEqual([]);
  });
});
