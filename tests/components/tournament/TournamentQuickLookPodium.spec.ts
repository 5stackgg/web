import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentQuickLook from "~/components/tournament/TournamentQuickLook.vue";

const { answers } = vi.hoisted(() => ({
  answers: { podium: null as any[] | null, asked: false },
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
    useQuery: (document: any, _variables: unknown, options?: any) => {
      if (!/\bpodium\b/.test(print(document))) {
        return {
          result: ref({ tournaments_by_pk: { id: "t1" }, event_tournaments: [] }),
        };
      }
      const resolved = typeof options === "function" ? options() : options;
      if (resolved?.enabled === false) {
        return { result: ref(undefined) };
      }
      answers.asked = true;
      return {
        result: ref({ tournaments_by_pk: { id: "t1", podium: answers.podium } }),
      };
    },
  };
});

function standing(rank: number, name: string) {
  return { rank, team: { name: null, team: { name } } };
}

const placement = (n: number, name: string) => ({
  placement: n,
  tournament_team_id: `tt-${name}`,
  name,
});

async function finalStandings(podium: any[] | null) {
  answers.podium = podium;
  const wrapper = await mountSuspended(TournamentQuickLook, {
    props: {
      tournament: {
        id: "t1",
        name: "Copa",
        status: "Finished",
        stages: [
          {
            order: 1,
            results: [
              standing(1, "Alpha"),
              standing(2, "Charlie"),
              standing(3, "Bravo"),
              standing(4, "Delta"),
            ],
          },
        ],
      },
    },
    global: { stubs: { TournamentFactList: true } },
  });
  return wrapper.findAll("ol > li").map((row) =>
    row
      .findAll("span")
      .map((span) => span.text())
      .join(" "),
  );
}

describe("TournamentQuickLook final standings", () => {
  beforeEach(() => {
    answers.asked = false;
  });

  it("orders the top three by the tournament's placements, not the standings' tiebreakers", async () => {
    const rows = await finalStandings([
      placement(1, "Alpha"),
      placement(2, "Bravo"),
      placement(3, "Charlie"),
    ]);

    expect(answers.asked).toBe(true);
    expect(rows).toEqual(["1st Alpha", "2nd Bravo", "3rd Charlie"]);
  });

  it("shows both semifinal losers on a shared third", async () => {
    const rows = await finalStandings([
      placement(1, "Alpha"),
      placement(2, "Bravo"),
      placement(3, "Charlie"),
      placement(3, "Delta"),
    ]);

    expect(rows).toEqual([
      "1st Alpha",
      "2nd Bravo",
      "3rd Charlie",
      "3rd Delta",
    ]);
  });

  it("falls back to the standings when the api gives no placements", async () => {
    const rows = await finalStandings(null);

    expect(rows).toEqual(["1st Alpha", "2nd Charlie", "3rd Bravo"]);
  });
});
