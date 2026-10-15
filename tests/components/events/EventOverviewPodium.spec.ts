import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import { print } from "graphql";
import type { FieldNode, OperationDefinitionNode } from "graphql";
import EventOverview from "~/components/events/EventOverview.vue";

function rootField(query: any) {
  const operation = query.definitions[0] as OperationDefinitionNode;
  return (operation.selectionSet.selections[0] as FieldNode).name.value;
}

const standing = (rank: number, name: string) => ({
  rank,
  team: { name: null, team: { name } },
});

const finished = {
  id: "t-finished",
  name: "Copa",
  status: "Finished",
  stages: [
    {
      order: 1,
      results: [
        standing(1, "Alpha"),
        standing(2, "Charlie"),
        standing(3, "Bravo"),
      ],
    },
  ],
};

const open = { id: "t-open", name: "Liga", status: "RegistrationOpen" };

let podiumRequests: Array<Record<string, unknown>> = [];

beforeEach(() => {
  podiumRequests = [];
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);
  vi.spyOn(client, "query").mockImplementation(async (options: any) => {
    if (
      rootField(options.query) === "tournaments_by_pk" &&
      /\bpodium\b/.test(print(options.query))
    ) {
      podiumRequests.push(options.variables);
      return {
        data: {
          tournaments_by_pk: {
            id: options.variables.tournamentId,
            podium: [
              { placement: 1, tournament_team_id: "tt-b", name: "Bravo" },
              { placement: 2, tournament_team_id: "tt-a", name: "Alpha" },
            ],
          },
        },
      } as any;
    }
    return { data: {} } as any;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function props(tournaments: any[]) {
  return {
    event: {
      id: "e1",
      name: "Spring Cup",
      tournaments: tournaments.map((tournament) => ({ tournament })),
    },
    phase: "finished" as const,
    refreshKey: "k",
    matches: [],
    matchesTotal: 0,
    matchesLoading: false,
    leaderboardRows: [],
    leaderboardLoading: false,
    players: [],
    teams: [],
  };
}

describe("EventOverview podiums", () => {
  it("asks once for each finished tournament's podium and shows its champion", async () => {
    const wrapper = await mountSuspended(EventOverview, {
      props: props([finished, open]),
    });
    await flushPromises();

    expect(podiumRequests).toEqual([{ tournamentId: "t-finished" }]);
    expect(wrapper.text()).toContain("Bravo");
  });

  it("doesn't ask again when the event subscription sends the same tournaments", async () => {
    const wrapper = await mountSuspended(EventOverview, {
      props: props([finished, open]),
    });
    await flushPromises();

    await wrapper.setProps(props([{ ...finished }, { ...open }]));
    await flushPromises();

    expect(podiumRequests).toHaveLength(1);
  });
});
