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

const TARGET = "76561198000000002";

let unmount: (() => void) | undefined;

async function render(player: Record<string, unknown>) {
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${TARGET}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).player = player;
  await flushPromises();
  return wrapper.html();
}

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  await flushPromises();
});

// Every match the player won or lost, counted again on each poll of the
// profile's live subscription.
const RECORD = /^\s*(wins|losses)(_\w+)?\s*$/m;

describe("player profile win/loss record", () => {
  const player = {
    steam_id: TARGET,
    name: "Dana",
    role: e_player_roles_enum.user,
  };

  it("renders the same with or without a win/loss record", async () => {
    const without = await render(player);
    unmount?.();
    const withRecord = await render({
      ...player,
      wins: 37,
      losses: 29,
      wins_competitive: 31,
      wins_wingman: 3,
      wins_duel: 2,
      wins_rush: 1,
      losses_competitive: 23,
      losses_wingman: 4,
      losses_duel: 1,
      losses_rush: 1,
    });

    expect(withRecord).toEqual(without);
  });

  it("does not ask the live profile for a win/loss record", () => {
    const query = print(
      (PlayerPage as any).apollo.$subscribe.players_by_pk.query,
    );

    expect(query).toMatch(/players_by_pk/);
    expect(query).not.toMatch(RECORD);
  });
});
