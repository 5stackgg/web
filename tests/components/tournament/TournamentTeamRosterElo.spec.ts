import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";

const graphql = vi.hoisted(() => ({ query: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query: graphql.query }),
}));

const ELOS: Record<string, number> = {
  "76561198000004001": 1310,
  "76561198000004002": 1885,
  "76561198000004003": 1040,
};

const MemberRow = defineComponent({
  props: ["member"],
  setup(props) {
    return () =>
      h(
        "div",
        { class: "member" },
        `${props.member.player.name}:${props.member.player.elo?.competitive ?? "-"}`,
      );
  },
});

const unmounts: Array<() => void> = [];

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

afterEach(() => {
  for (const unmount of unmounts.splice(0)) {
    unmount();
  }
});

function team(steamIds: string[]) {
  return {
    id: "tt-a",
    name: "Alpha",
    can_manage: false,
    invites: [],
    roster: steamIds.map((steam_id, index) => ({
      role: "Member",
      player: { steam_id, name: `p${index + 1}`, avatar_url: null },
    })),
  };
}

async function mountTeam(expanded: boolean) {
  const wrapper = await mountSuspended(TournamentTeam, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "Live",
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        teams: [],
        awards: [],
        stages: [],
      },
      team: team(["76561198000004001", "76561198000004002"]),
      expanded,
    },
    global: {
      stubs: { TournamentTeamMemberRow: MemberRow },
      mocks: { e_team_roles: [] },
    },
  });
  unmounts.push(() => wrapper.unmount());
  await flushPromises();
  return wrapper;
}

const members = (wrapper: Awaited<ReturnType<typeof mountTeam>>) =>
  wrapper.findAll(".member").map((row) => row.text());

describe("roster elo on the tournament's team list", () => {
  it("is not read while the team's row is closed", async () => {
    await mountTeam(false);

    expect(graphql.query).not.toHaveBeenCalled();
  });

  it("is read for the team's players when the row opens", async () => {
    const wrapper = await mountTeam(false);

    await wrapper.setProps({ expanded: true } as any);
    await flushPromises();

    expect(graphql.query).toHaveBeenCalledTimes(1);
    expect(graphql.query.mock.calls[0][0].variables).toEqual({
      steamIds: ["76561198000004001", "76561198000004002"],
    });
    expect(members(wrapper)).toEqual(["p1:1310", "p2:1885"]);
  });

  it("is not read again when the poll brings the same roster", async () => {
    const wrapper = await mountTeam(true);

    await wrapper.setProps({
      team: team(["76561198000004001", "76561198000004002"]),
    } as any);
    await flushPromises();

    expect(graphql.query).toHaveBeenCalledTimes(1);
  });

  it("is read for a player who joins while the row is open", async () => {
    const wrapper = await mountTeam(true);

    await wrapper.setProps({
      team: team([
        "76561198000004001",
        "76561198000004002",
        "76561198000004003",
      ]),
    } as any);
    await flushPromises();

    expect(graphql.query).toHaveBeenCalledTimes(2);
    expect(members(wrapper)).toEqual(["p1:1310", "p2:1885", "p3:1040"]);
  });
});
