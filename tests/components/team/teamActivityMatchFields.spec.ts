// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTeamActivity } from "~/components/team/teamActivity";
import { teamActivityMatchFields } from "~/graphql/teamActivityFields";

// The team page fetches every match the team has played, so it selects only
// what the activity feed reads. Projecting full matches down to that selection
// must leave the feed exactly as it was.
function project(value: any, selection: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value))
    return value.map((item) => project(item, selection));
  const out: Record<string, any> = {};
  for (const [key, select] of Object.entries(selection)) {
    if (!(key in value)) continue;
    const nested = Array.isArray(select) ? select[1] : select;
    out[key] = nested === true ? value[key] : project(value[key], nested);
  }
  return out;
}

const TEAM = "team-ours";

function lineup(id: string, teamId: string | null, name: string) {
  return {
    id,
    team_id: teamId,
    name,
    is_on_lineup: false,
    coach: null,
    team: teamId
      ? { name: `${name} Org`, short_name: "ORG", avatar_url: null, roster: [] }
      : null,
    lineup_players: [
      {
        checked_in: true,
        placeholder_name: null,
        player: {
          steam_id: `${id}-p1`,
          name: "p1",
          elo: { competitive: 5120 },
          is_banned: false,
        },
      },
    ],
  };
}

function map(
  order: number,
  name: string,
  scores: [number, number],
  winner: string | null,
) {
  return {
    id: `map-${order}-${name}`,
    map: {
      id: name,
      name,
      label: name === "de_mirage" ? "Mirage" : null,
      type: "Competitive",
      poster: null,
    },
    is_current_map: false,
    lineup_1_score: scores[0],
    lineup_2_score: scores[1],
    winning_lineup_id: winner,
    clips_count: 0,
    public_clips_count: 0,
    vetos: [],
  };
}

function match(overrides: Record<string, any>) {
  return {
    status: "Finished",
    source: "5stack",
    organizer_steam_id: null,
    is_in_lineup: false,
    is_coach: false,
    is_tournament_match: false,
    e_match_status: { description: "Finished" },
    created_at: "2026-05-01T09:00:00Z",
    started_at: "2026-05-01T10:00:00Z",
    scheduled_at: null,
    ended_at: "2026-05-01T11:00:00Z",
    max_players_per_lineup: 5,
    min_players_per_lineup: 5,
    lineup_counts: { lineup_1_count: 5, lineup_2_count: 5 },
    options: { mr: 12, best_of: 1, type: "Competitive" },
    tournament_brackets: [],
    ...overrides,
  };
}

const matches = [
  match({
    id: "won-bo1",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    winning_lineup_id: "l1",
    lineup_1: lineup("l1", TEAM, "Us"),
    lineup_2: lineup("l2", "team-them", "Them"),
    match_maps: [map(1, "de_mirage", [13, 7], "l1")],
  }),
  match({
    id: "lost-bo3-as-lineup-2",
    ended_at: "2026-05-03T11:00:00Z",
    lineup_1_id: "l3",
    lineup_2_id: "l4",
    winning_lineup_id: "l3",
    lineup_1: lineup("l3", null, "Mix"),
    lineup_2: lineup("l4", TEAM, "Us"),
    options: { mr: 12, best_of: 3, type: "Competitive" },
    match_maps: [
      map(1, "de_inferno", [13, 10], "l3"),
      map(2, "de_nuke", [8, 13], "l4"),
      map(3, "de_ancient", [13, 11], "l3"),
    ],
    tournament_brackets: [
      {
        round: 1,
        match_number: 2,
        stage: {
          order: 1,
          e_tournament_stage_type: { description: "SE" },
          tournament: { id: "t1", name: "Spring Cup" },
        },
      },
    ],
  }),
  match({
    id: "forfeit",
    status: "Forfeit",
    ended_at: "2026-05-05T11:00:00Z",
    lineup_1_id: "l5",
    lineup_2_id: "l6",
    winning_lineup_id: "l6",
    lineup_1: lineup("l5", TEAM, "Us"),
    lineup_2: lineup("l6", "team-other", "Other"),
    match_maps: [map(1, "de_dust2", [0, 0], null)],
  }),
  match({
    id: "tie",
    ended_at: "2026-05-06T11:00:00Z",
    lineup_1_id: "l7",
    lineup_2_id: "l8",
    winning_lineup_id: null,
    lineup_1: lineup("l7", TEAM, "Us"),
    lineup_2: lineup("l8", null, "Pickup"),
    match_maps: [map(1, "de_train", [15, 15], null)],
  }),
  match({
    id: "scheduled",
    status: "Scheduled",
    started_at: null,
    ended_at: null,
    lineup_1_id: "l9",
    lineup_2_id: "l10",
    winning_lineup_id: null,
    lineup_1: lineup("l9", TEAM, "Us"),
    lineup_2: lineup("l10", "team-them", "Them"),
    match_maps: [],
  }),
];

function feed(teamMatches: any[]) {
  return buildTeamActivity({
    teamId: TEAM,
    matches: teamMatches,
    awards: [],
    leagueTeams: [],
    clips: [],
    invites: [],
    createdAt: "2026-01-01T00:00:00Z",
    now: new Date("2026-06-01T00:00:00Z"),
  });
}

describe("team page match selection", () => {
  it("leaves the activity feed exactly as the full match fields build it", () => {
    const projected = project(matches, teamActivityMatchFields);
    expect(feed(projected)).toEqual(feed(matches));
    expect(
      feed(matches).filter((event) => event.kind === "result"),
    ).toHaveLength(4);
  });

  it("carries no player data", () => {
    const projected = project(matches, teamActivityMatchFields);
    expect(JSON.stringify(projected)).not.toContain("lineup_players");
    expect(JSON.stringify(projected)).not.toContain("elo");
  });
});
