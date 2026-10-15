import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentResults from "~/components/tournament/TournamentResults.vue";

const { computed } = TournamentResults as any;

const KAIRO = "76561198000000001";
const FEXX = "76561198000000003";
const LUKE = "76561198000000009";

const northwind = {
  id: "tt-1",
  name: null,
  team: { id: "team-1", name: "Northwind" },
  roster: [
    { player_steam_id: KAIRO, player: { steam_id: KAIRO, name: "kairo" } },
    { player_steam_id: FEXX, player: { steam_id: FEXX, name: "fexx" } },
  ],
};

const pickedMvp = {
  id: "mvp",
  placement: 0,
  source: "tournament",
  awarded_by_steam_id: LUKE,
  note: "Held B alone",
  award_id: "mvp-award",
  award: { id: "mvp-award", name: "Tournament MVP", tier: "mvp" },
  player_steam_id: FEXX,
  player: { steam_id: FEXX, name: "fexx" },
  team_id: null,
  team: null,
  tournament_team_id: northwind.id,
  tournament_team: northwind,
};

const impacts = [
  { steam_id: KAIRO, match_id: "m1", impact: 1.14 },
  { steam_id: KAIRO, match_id: "m2", impact: 1.14 },
  { steam_id: FEXX, match_id: "m1", impact: 1.05 },
  { steam_id: FEXX, match_id: "m2", impact: 1.05 },
];

function context(mvp: Record<string, unknown>) {
  const self: any = { mvp, mvpImpacts: impacts };
  self.mvpRoster = computed.mvpRoster.call(self);
  return self;
}

describe("TournamentResults organizer MVP pick", () => {
  it("tells an organizer's pick apart from the automatic one by who picked it", () => {
    expect(computed.mvpPicked.call({ mvp: pickedMvp })).toBe(true);
    expect(
      computed.mvpPicked.call({
        mvp: { ...pickedMvp, awarded_by_steam_id: null },
      }),
    ).toBe(false);
    expect(
      computed.mvpPicked.call({ mvp: { ...pickedMvp, source: "manual" } }),
    ).toBe(false);
  });

  it("keeps the automatic pick and its score beside the picked player's", () => {
    const impact = computed.mvpImpact.call(context(pickedMvp));

    expect(impact.avg).toBeCloseTo(1.05);
    expect(impact.automatic.name).toBe("kairo");
    expect(impact.automatic.avg).toBeCloseTo(1.14);
  });

  it("marks the MVP as the organizers' pick under the podium", async () => {
    const offline = { ...(TournamentResults as any), apollo: {} };
    const wrapper = await mountSuspended(offline, {
      props: {
        tournament: {
          id: "tournament-1",
          name: "Copa",
          start: "2026-09-07T12:00:00Z",
          status: "Finished",
          stages: [],
          award_configs: [],
          awards: [
            pickedMvp,
            {
              ...pickedMvp,
              id: "gold",
              placement: 1,
              awarded_by_steam_id: null,
              note: null,
              award_id: "gold",
              award: { id: "gold", name: "Champion", tier: "gold" },
              player_steam_id: null,
              player: null,
              team_id: "team-1",
            },
          ],
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("fexx");
    expect(text).toContain("Northwind");
    expect(text).toContain("Picked by the organizers");
  });
});
