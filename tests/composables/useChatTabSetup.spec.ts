import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import {
  tournamentChatTab,
  useChatTabSetup,
} from "~/composables/useChatTabSetup";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    markLobbyRead() {},
  },
}));

const ME = "76561198000000001";
const CHOSEN = "direct:76561198000000001:76561198000000002";

let unmount: (() => void) | undefined;

async function mountSetup() {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useChatTabSetup();
        return () => h("div");
      },
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

function chooseRoom() {
  useChatTabs().openTab({
    id: CHOSEN,
    label: "Dana",
    instance: "direct",
    type: "direct",
    lobbyId: "76561198000000001:76561198000000002",
  });
}

beforeEach(() => {
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  useAuthStore().me = {
    steam_id: ME,
    current_lobby_id: "lobby-1",
    role: e_player_roles_enum.administrator,
  } as unknown as ReturnType<typeof useAuthStore>["me"];
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ threads: [] }));
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
});

describe("useChatTabSetup", () => {
  it("opens the default rooms without selecting any of them", async () => {
    useMatchLobbyStore().myMatches = [{ id: "match-1", label: "A vs B" }] as any;

    await mountSetup();

    const { tabs, activeTabId } = useChatTabs();
    expect(tabs.value.map((tab) => tab.id)).toEqual(
      expect.arrayContaining([
        "matchmaking:lobby-1",
        "match:match-1",
        "organizers",
      ]),
    );
    expect(activeTabId.value).toBeNull();
  });

  it("keeps the chosen room when default rooms are added", async () => {
    chooseRoom();

    await mountSetup();

    expect(useChatTabs().activeTabId.value).toBe(CHOSEN);
  });

  it("keeps the chosen room when a tournament room is added", async () => {
    chooseRoom();
    await mountSetup();

    useMatchLobbyStore().chatTournaments = [{ id: "t-1", name: "Cup" }];
    await nextTick();

    const { tabs, activeTabId } = useChatTabs();
    expect(tabs.value).toContainEqual(
      tournamentChatTab({ id: "t-1", name: "Cup" }),
    );
    expect(activeTabId.value).toBe(CHOSEN);
  });
});
