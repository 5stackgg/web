import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentFreeAgents from "~/components/tournament/TournamentFreeAgents.vue";

const pool = ref<Array<Record<string, unknown>>>([]);

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: vi.fn(), mutate: vi.fn() } }),
  useSubscription: () => ({
    result: ref({ tournament_free_agents: pool.value }),
  }),
}));

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pool.value = [];
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

async function mountPool() {
  const wrapper = await mountSuspended(TournamentFreeAgents, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        min_players_per_lineup: 5,
        is_organizer: false,
      },
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
});
