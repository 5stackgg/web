import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent, h } from "vue";
import { useOffPageToasts } from "~/composables/useOffPageToasts";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("~/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/components/ui/toast")>()),
  toast,
}));

const ME = "76561198000000001";

const Host = defineComponent({
  setup() {
    useOffPageToasts();
    return () => h("div");
  },
});

let unmount: (() => void) | undefined;

beforeEach(async () => {
  useAuthStore().me = { steam_id: ME } as any;
  useMatchLobbyStore().myMatches = [] as any;
  useDraftGamesStore().myDraftGame = undefined;
  const wrapper = await mountSuspended(Host);
  unmount = () => wrapper.unmount();
  await flushPromises();
  toast.mockReset();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useMatchLobbyStore().myMatches = [] as any;
  useDraftGamesStore().myDraftGame = undefined;
});

const titles = () => toast.mock.calls.map(([options]) => options.title);

function vetoMatch(myTurn: boolean) {
  return {
    id: "match-1",
    status: "Veto",
    is_in_lineup: true,
    draft_games: [],
    lineup_1: { can_pick_map_veto: myTurn, can_pick_region_veto: false },
    lineup_2: { can_pick_map_veto: false, can_pick_region_veto: false },
  };
}

describe("useOffPageToasts", () => {
  it("leaves veto turns to the match action toasts", async () => {
    useMatchLobbyStore().myMatches = [vetoMatch(false)] as any;
    await flushPromises();

    useMatchLobbyStore().myMatches = [vetoMatch(true)] as any;
    await flushPromises();

    expect(titles()).not.toContain("Your turn to veto");
  });

  it("still tells a captain it is their draft pick", async () => {
    const room = (pickLineup: number) => ({
      id: "draft-1",
      status: "Drafting",
      current_pick_lineup: pickLineup,
      match_id: null,
      players: [{ steam_id: ME, is_captain: true, lineup: 1 }],
    });

    useDraftGamesStore().myDraftGame = room(2);
    await flushPromises();
    useDraftGamesStore().myDraftGame = room(1);
    await flushPromises();

    expect(titles()).toContain("It's your pick");
  });
});
