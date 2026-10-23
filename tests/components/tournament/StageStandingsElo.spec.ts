import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StageStandings from "~/components/tournament/StageStandings.vue";

const graphql = vi.hoisted(() => ({ query: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query: graphql.query }),
}));

const ELOS: Record<string, number> = {
  "76561198000003001": 1450,
  "76561198000003002": 1720,
  "76561198000003003": 990,
};

beforeEach(() => {
  graphql.query = vi.fn(async ({ variables }) => ({
    data: {
      players: variables.steamIds.map((steam_id: string) => ({
        steam_id,
        elo: { competitive: ELOS[steam_id] },
      })),
    },
  }));
});

function member(steamId: string, name: string) {
  return { player: { steam_id: steamId, name, avatar_url: null } };
}

function row(id: string, name: string, rank: number, roster: any[]) {
  return {
    tournament_team_id: id,
    group_number: 1,
    rank,
    placement: rank,
    wins: 0,
    losses: 0,
    matches_played: 0,
    team: { id, name, team: null, roster },
  };
}

async function mountStandings() {
  return mountSuspended(StageStandings, {
    props: {
      stage: {
        groups: 1,
        results: [
          row("tt-a", "Alpha", 1, [
            member("76561198000003001", "dusk"),
            member("76561198000003002", "ember"),
          ]),
          row("tt-b", "Bravo", 2, [member("76561198000003003", "frost")]),
        ],
      },
    },
  });
}

describe("player elo in the stage standings", () => {
  it("is not read while every row is closed", async () => {
    await mountStandings();
    await flushPromises();

    expect(graphql.query).not.toHaveBeenCalled();
  });

  it("is read for the opened team's players and shown in its rows", async () => {
    const wrapper = await mountStandings();

    await wrapper.find("tbody > tr").trigger("click");
    await flushPromises();

    expect(graphql.query).toHaveBeenCalledTimes(1);
    expect(graphql.query.mock.calls[0][0].variables).toEqual({
      steamIds: ["76561198000003001", "76561198000003002"],
    });
    const text = wrapper.text();
    expect(text).toContain("1450");
    expect(text).toContain("1720");
    expect(text).not.toContain("990");
  });
});
