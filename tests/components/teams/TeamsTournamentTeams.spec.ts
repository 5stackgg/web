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

function respond(teams: unknown[], count = teams.length) {
  client.query.mockResolvedValue({
    data: {
      tournament_teams: teams,
      tournament_teams_aggregate: { aggregate: { count } },
    },
  });
}

function lastVariables() {
  return client.query.mock.calls.at(-1)?.[0].variables;
}

function lastWhere() {
  return lastVariables().where;
}

async function search(wrapper: any, value: string) {
  await wrapper.find("input").setValue(value);
  vi.advanceTimersByTime(300);
  await flushPromises();
  return lastWhere()._and.find((clause: any) => clause._or);
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

  it("orders teams of the same tournament by a unique key so pages never overlap", async () => {
    respond([TEAM_X]);

    await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect(lastVariables().orderBy).toEqual([
      { tournament: { start: "desc_nulls_last" } },
      { name: "asc" },
      { id: "asc" },
    ]);
  });

  it("finds a player's tournament teams by steam id", async () => {
    respond([TEAM_X]);
    vi.useFakeTimers();

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect((await search(wrapper, PLAYER))._or).toContainEqual({
      roster: { player_steam_id: { _eq: PLAYER } },
    });
    expect(
      JSON.stringify(await search(wrapper, "9999999999999999999")),
    ).not.toContain("player_steam_id");
  });

  it("keeps My Teams Only to teams the viewer plays on", async () => {
    useAuthStore().me = { steam_id: PLAYER } as any;
    respond([TEAM_X]);

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    await wrapper.find("button[aria-pressed]").trigger("click");
    await flushPromises();

    expect(lastWhere()._and).toContainEqual({
      roster: { player_steam_id: { _eq: PLAYER } },
    });
    expect(JSON.stringify(lastWhere())).not.toContain("owner_steam_id");
    expect(JSON.stringify(lastWhere())).not.toContain("captain_steam_id");
  });

  it("does not blame filters for an empty page when none are set", async () => {
    respond([], 11);

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect(wrapper.text()).toContain("No teams found.");
    expect(wrapper.text()).not.toContain("Clear filters");
  });

  it("renders nothing when no tournament has a team of its own", async () => {
    respond([]);

    const wrapper = await mountSuspended(TeamsTournamentTeams);
    await flushPromises();

    expect(wrapper.find("section").exists()).toBe(false);
  });
});
