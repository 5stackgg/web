import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentResults from "~/components/tournament/TournamentResults.vue";

const { computed } = TournamentResults as any;

const winners = {
  id: "tt-1",
  name: null,
  team: { id: "team-1", name: "100FOFOCA" },
  roster: [],
};
const thirds = {
  id: "tt-3",
  name: null,
  team: { id: "team-3", name: "Brazino69" },
  roster: [],
};

const karambit = {
  id: "karambit",
  name: "Golden Karambit",
  tier: "special",
  silhouette: null,
  image_url: null,
};
const spirit = {
  id: "spirit",
  name: "Fair Play",
  tier: "special",
  silhouette: null,
  image_url: null,
};

function grant(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    placement: null,
    source: "manual",
    note: null,
    player_steam_id: null,
    player: null,
    team_id: null,
    team: null,
    ...overrides,
  };
}

const celoso = { steam_id: "76561198815999208", name: "celoso" };

const awards = [
  grant({
    placement: 1,
    source: "tournament",
    award_id: "gold",
    award: { id: "gold", name: "Champion", tier: "gold" },
    team_id: "team-1",
    tournament_team_id: winners.id,
    tournament_team: winners,
  }),
  grant({
    award_id: karambit.id,
    award: karambit,
    note: "Best stats of the cup",
    player_steam_id: celoso.steam_id,
    player: celoso,
    tournament_team_id: winners.id,
    tournament_team: winners,
  }),
  grant({
    award_id: spirit.id,
    award: spirit,
    team_id: "team-3",
    team: { id: "team-3", name: "Brazino69" },
    tournament_team_id: thirds.id,
    tournament_team: thirds,
  }),
  ...["5", "6"].map((steam_id) =>
    grant({
      award_id: spirit.id,
      award: spirit,
      player_steam_id: steam_id,
      player: { steam_id, name: `player-${steam_id}` },
      tournament_team_id: thirds.id,
      tournament_team: thirds,
    }),
  ),
];

describe("TournamentResults other awards", () => {
  it("lists awards without a placement once per grant", () => {
    const rows = computed.otherAwards.call({ tournament: { awards } });

    expect(
      rows.map((row: any) => [
        row.award.name,
        row.player?.name ?? row.tournament_team.team.name,
      ]),
    ).toEqual([
      ["Fair Play", "Brazino69"],
      ["Golden Karambit", "celoso"],
    ]);
  });

  it("shows them under the podium with their note", async () => {
    // Without its smart queries, so mounting opens nothing against the api.
    const offline = { ...(TournamentResults as any), apollo: {} };
    const wrapper = await mountSuspended(offline, {
      props: {
        showMatches: false,
        tournament: {
          id: "tournament-1",
          name: "Copa",
          start: "2026-09-07T12:00:00Z",
          status: "Finished",
          stages: [],
          award_configs: [],
          awards,
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("Golden Karambit");
    expect(text).toContain("Best stats of the cup");
    expect(text).toContain("Fair Play");
    expect(text).toContain("Brazino69");
  });
});
