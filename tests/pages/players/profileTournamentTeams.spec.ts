import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { print } from "graphql";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import { e_player_roles_enum } from "~/generated/zeus";

const client = vi.hoisted(() => ({
  query: () => Promise.resolve({ data: {} }),
  subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const TARGET = "76561198000123456";

const subscription = () =>
  (PlayerPage as any).apollo.$subscribe.playerTournamentTeams;

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("player profile tournament teams", () => {
  it("asks for the player's tournament-only teams in tournaments still running", () => {
    const document = print(subscription().query);

    expect(document).toContain("tournament_team_roster(");
    expect(document).toMatch(/tournament_team: \{team_id: \{_is_null: true\}\}/);
    expect(document).toMatch(
      /status: \{_nin: \[Finished, Cancelled, CancelledMinTeams\]\}/,
    );
    expect(subscription().variables.call({ playerId: TARGET })).toEqual({
      steam_id: TARGET,
    });
    expect(subscription().context).toEqual({ seed: true });
  });

  it("shows a team made inside a tournament next to the player's teams", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      name: "Admin",
      role: e_player_roles_enum.administrator,
    } as unknown as ReturnType<typeof useAuthStore>["me"];
    const wrapper = await mountSuspended(PlayerPage, {
      shallow: true,
      route: `/players/${TARGET}`,
      global: { renderStubDefaultSlot: true },
    } as any);
    unmount = () => wrapper.unmount();

    (wrapper.vm as any).player = {
      steam_id: TARGET,
      name: "Dana",
      role: e_player_roles_enum.user,
      teams: [{ id: "team-1", name: "Blue Rabbits", short_name: "BR" }],
    };
    subscription().result.call(wrapper.vm, {
      data: {
        tournament_team_roster: [
          {
            tournament_team: { id: "tt-1", name: "Team X", short_name: "TX" },
            tournament: { id: "tour-1", name: "Autumn Cup" },
          },
        ],
      },
    });
    await flushPromises();

    const links = wrapper
      .findAllComponents({ name: "NuxtLink" })
      .map((link) => link.props("to"));
    expect(links).toContainEqual("/teams/team-1");
    expect(links).toContainEqual({
      name: "tournaments-tournamentId",
      params: { tournamentId: "tour-1" },
      query: { tab: "teams" },
    });
    expect(wrapper.text()).toContain("TX");
  });
});
