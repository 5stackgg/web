import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamsTournamentTeams from "~/components/teams/TeamsTournamentTeams.vue";
import { useAuthStore } from "~/stores/AuthStore";

const client = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client }),
}));

const PLAYER = "76561198000123456";

const TEAM_X = {
  id: "tt-1",
  name: "Team X",
  short_name: "TX",
  tournament: {
    id: "tour-1",
    name: "Autumn Cup",
    status: "Live",
    e_tournament_status: { description: "Live" },
  },
  roster: [
    {
      player: {
        steam_id: PLAYER,
        name: "Dana",
        avatar_url: "https://avatars.test/dana.png",
      },
    },
  ],
};

function respond(teams: unknown[]) {
  client.query.mockResolvedValue({
    data: {
      tournament_teams: teams,
      tournament_teams_aggregate: { aggregate: { count: teams.length } },
    },
  });
}

function lastWhere() {
  return client.query.mock.calls.at(-1)?.[0].variables.where;
}

describe("TeamsTournamentTeams", () => {
  beforeEach(() => {
    client.query.mockReset();
    useAuthStore().me = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists teams that only exist inside a tournament and links to the tournament", async () => {
    respond([TEAM_X]);

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect(lastWhere()._and).toContainEqual({ team_id: { _is_null: true } });
    expect(wrapper.text()).toContain("Team X");
    expect(wrapper.text()).toContain("Autumn Cup");
    expect(wrapper.find('a[href="/tournaments/tour-1?tab=teams"]').exists()).toBe(
      true,
    );
  });

  it("finds a player's tournament teams by steam id", async () => {
    respond([TEAM_X]);
    vi.useFakeTimers();

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    await wrapper.find("input").setValue(PLAYER);
    vi.advanceTimersByTime(300);
    await flushPromises();

    const search = lastWhere()._and.find((clause: any) => clause._or);
    expect(search._or).toContainEqual({
      roster: { player_steam_id: { _eq: PLAYER } },
    });
  });

  it("renders nothing when no tournament has a team of its own", async () => {
    respond([]);

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect(wrapper.find("section").exists()).toBe(false);
  });
});
