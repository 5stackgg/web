import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";

const unmounts: Array<() => void> = [];

afterEach(() => {
  for (const unmount of unmounts.splice(0)) {
    unmount();
  }
});

const result = (id: string, placement: number) => ({
  tournament_team_id: id,
  rank: placement,
  placement,
});

const semifinals = {
  order: 1,
  type: "SingleElimination",
  results: [
    result("tt-a", 1),
    result("tt-b", 2),
    result("tt-c", 3),
    result("tt-d", 4),
    result("tt-e", 5),
  ],
};

const step = (id: string, placement: number) => ({
  placement,
  tournament_team_id: id,
  name: id,
  players: [],
});

async function badge(
  teamId: string,
  podium: unknown[] | null,
  tournament: Record<string, unknown> = {},
) {
  const wrapper = await mountSuspended(TournamentTeam, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "Finished",
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        teams: [],
        awards: [],
        stages: [semifinals],
        ...tournament,
      },
      team: {
        id: teamId,
        name: teamId,
        can_manage: false,
        roster: [],
        invites: [],
      },
    },
    global: {
      stubs: { TournamentTeamMemberRow: true },
      mocks: { e_team_roles: [] },
    },
  });
  unmounts.push(() => wrapper.unmount());
  await flushPromises();
  (wrapper.vm as any).podiumSteps = podium;
  await wrapper.vm.$nextTick();

  return wrapper
    .findAll("header span.rounded")
    .map((span) => span.text())
    .find((text) => /^\d+(st|nd|rd|th)$/.test(text));
}

describe("TournamentTeam placement badge", () => {
  const sharedThird = [
    step("tt-a", 1),
    step("tt-b", 2),
    step("tt-c", 3),
    step("tt-d", 3),
  ];

  it("names both semifinal losers 3rd when they share the podium's third step", async () => {
    expect(await badge("tt-c", sharedThird)).toBe("3rd");
    expect(await badge("tt-d", sharedThird)).toBe("3rd");
  });

  it("takes the podium over the standings for the teams on it", async () => {
    const podium = [step("tt-a", 1), step("tt-c", 2), step("tt-b", 3)];

    expect(await badge("tt-b", podium)).toBe("3rd");
    expect(await badge("tt-c", podium)).toBe("2nd");
  });

  it("reads the standings for a team the podium does not name", async () => {
    expect(await badge("tt-e", sharedThird)).toBe("5th");
  });

  it("falls back to the awards, then the standings, without placements", async () => {
    expect(await badge("tt-d", null)).toBe("4th");
    expect(await badge("tt-d", [])).toBe("4th");
    expect(
      await badge("tt-d", null, {
        awards: [{ tournament_team_id: "tt-d", placement: 3 }],
      }),
    ).toBe("3rd");
  });

  it("shows no placement before the tournament finishes", async () => {
    expect(await badge("tt-c", sharedThird, { status: "Live" })).toBe(
      undefined,
    );
  });
});
