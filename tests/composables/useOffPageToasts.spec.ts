import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent, h } from "vue";
import ActionToasts from "~/components/notification/ActionToasts.vue";
import { useOffPageToasts } from "~/composables/useOffPageToasts";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("~/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/components/ui/toast")>()),
  toast,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";

const Host = defineComponent({
  setup() {
    useOffPageToasts();
    return () => h("div");
  },
});

const cleanup: Array<() => void> = [];

async function mount(component: any, options: Record<string, any> = {}) {
  const wrapper = await mountSuspended(component, options);
  cleanup.push(() => wrapper.unmount());
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  useAuthStore().me = { steam_id: ME } as any;
  useMatchLobbyStore().myMatches = [] as any;
  useDraftGamesStore().myDraftGame = undefined;
  await mount(Host);
  toast.mockReset();
});

afterEach(() => {
  while (cleanup.length) {
    cleanup.pop()!();
  }
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

async function takeVetoTurn() {
  useMatchLobbyStore().myMatches = [vetoMatch(false)] as any;
  await flushPromises();
  useMatchLobbyStore().myMatches = [vetoMatch(true)] as any;
  await flushPromises();
}

describe("useOffPageToasts", () => {
  it("leaves veto turns to the match action toasts when they are mounted", async () => {
    await mount(ActionToasts, {
      global: { stubs: { VoiceRosterPreview: true } },
    });
    toast.mockReset();

    await takeVetoTurn();

    expect(toast).not.toHaveBeenCalled();
  });

  it("still nudges a veto turn once on pages without the match action toasts", async () => {
    await takeVetoTurn();

    expect(toast).toHaveBeenCalledTimes(1);
    expect(titles()).toEqual(["Your turn to veto"]);
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
