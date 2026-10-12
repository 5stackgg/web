import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentFreeAgents from "~/components/tournament/TournamentFreeAgents.vue";

const pool = ref<Array<Record<string, unknown>>>([]);
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: vi.fn(), mutate } }),
  useSubscription: () => ({
    result: ref({ tournament_free_agents: pool.value }),
  }),
}));

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pool.value = [];
  mutate.mockReset();
});

function agent(steamId: string, player: Record<string, unknown>) {
  return {
    id: `agent-${steamId}`,
    status: "registered",
    created_at: "2026-10-01T12:00:00Z",
    party_id: null,
    tournament_team_id: null,
    tournament_team: null,
    player: { steam_id: steamId, name: `Player ${steamId}`, ...player },
  };
}

async function mountPool(myTeam: Record<string, unknown> | null = null) {
  const wrapper = await mountSuspended(TournamentFreeAgents, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        min_players_per_lineup: 2,
        max_players_per_lineup: 2,
        is_organizer: false,
      },
      myTeam,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("TournamentFreeAgents", () => {
  it("shows each free agent's Premier and FACEIT ranks", async () => {
    pool.value = [
      agent("76561198000000001", {
        premier_rank: 18234,
        faceit_skill_level: 7,
        faceit_elo: 1650,
      }),
    ];

    const wrapper = await mountPool();

    expect(wrapper.text()).toContain((18234).toLocaleString());
    expect(wrapper.find('[title^="Faceit"]').exists()).toBe(true);
  });

  it("leaves the ranks out for a free agent who has none", async () => {
    pool.value = [agent("76561198000000002", {})];

    const wrapper = await mountPool();

    expect(wrapper.text()).toContain("Player 76561198000000002");
    expect(wrapper.find('[title^="Faceit"]').exists()).toBe(false);
  });

  describe("recruiting", () => {
    const captainsTeam = (overrides: Record<string, unknown> = {}) => ({
      id: "team-1",
      can_manage: true,
      roster: [{ player: { steam_id: "76561198000000099" } }],
      invites: [],
      ...overrides,
    });

    const inviteButton = (wrapper: Awaited<ReturnType<typeof mountPool>>) =>
      wrapper.findAll("button").find((button) => button.text() === "Invite");

    it("lets a captain with an open seat invite a free agent", async () => {
      pool.value = [agent("76561198000000003", {})];
      mutate.mockResolvedValue({
        data: { insert_tournament_team_roster_one: null },
      });

      const wrapper = await mountPool(captainsTeam());
      const button = inviteButton(wrapper);
      expect(button).toBeDefined();
      await button?.trigger("click");
      await flushPromises();

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(mutate.mock.calls[0][0])).toContain(
        "insert_tournament_team_roster_one",
      );
    });

    it("shows a free agent the team already invited as invited", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(
        captainsTeam({
          invites: [{ id: "invite-1", player: { steam_id: "76561198000000003" } }],
        }),
      );

      expect(inviteButton(wrapper)).toBeUndefined();
      expect(wrapper.text()).toContain("Invited");
    });

    it("does not offer an invite once the team is full", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(
        captainsTeam({
          roster: [
            { player: { steam_id: "76561198000000098" } },
            { player: { steam_id: "76561198000000099" } },
          ],
        }),
      );

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it("does not offer an invite to someone who cannot manage a team", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(captainsTeam({ can_manage: false }));

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it("does not offer an invite for a drafted free agent", async () => {
      pool.value = [
        { ...agent("76561198000000003", {}), status: "drafted" },
      ];

      const wrapper = await mountPool(captainsTeam());

      expect(inviteButton(wrapper)).toBeUndefined();
    });
  });
});
