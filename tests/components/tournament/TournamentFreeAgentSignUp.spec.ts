import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentFreeAgentSignUp from "~/components/tournament/TournamentFreeAgentSignUp.vue";
import { useAuthStore } from "~/stores/AuthStore";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: vi.fn(), mutate: vi.fn() } }),
}));

const PLAYER = "76561198000000001";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined as any;
});

async function mountSignUp(
  tournament: Record<string, unknown>,
  myEntry: Record<string, unknown> | null = null,
) {
  useAuthStore().me = { steam_id: PLAYER, role: "user" } as any;

  const wrapper = await mountSuspended(TournamentFreeAgentSignUp, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        min_players_per_lineup: 2,
        joined_tournament: false,
        ...tournament,
      },
      myEntry,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const signUpButton = (wrapper: Awaited<ReturnType<typeof mountSignUp>>) =>
  wrapper.findAll("button").find((button) => button.text() === "Sign up");

describe("TournamentFreeAgentSignUp", () => {
  it("offers the pool to a player who has not entered", async () => {
    const wrapper = await mountSignUp({});

    expect(signUpButton(wrapper)).toBeDefined();
  });

  it("does not offer the pool to a player already on a team", async () => {
    const wrapper = await mountSignUp({ joined_tournament: true });

    expect(signUpButton(wrapper)).toBeUndefined();
  });

  it("does not offer the pool to a player already in it", async () => {
    const wrapper = await mountSignUp(
      { joined_tournament: true },
      { id: "agent-1", status: "registered" },
    );

    expect(signUpButton(wrapper)).toBeUndefined();
  });

  it("does not offer the pool before registration opens", async () => {
    const wrapper = await mountSignUp({ status: "Setup" });

    expect(signUpButton(wrapper)).toBeUndefined();
  });
});
