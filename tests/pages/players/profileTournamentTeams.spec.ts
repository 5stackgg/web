import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
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

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("player profile tournament teams", () => {
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
    (wrapper.vm as any).playerTournamentTeams = [
      {
        tournament_team: { id: "tt-1", name: "Team X", short_name: "TX" },
        tournament: { id: "tour-1", name: "Autumn Cup" },
      },
    ];
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
