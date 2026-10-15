import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPanel from "~/components/hub/ChatPanel.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { teamChatTab } from "~/utilities/teamChat";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    hidesAuthor: () => false,
    markLobbyRead() {},
    lobbyMessages: () => [],
  },
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";
const NORTHWIND = {
  id: "6f1c1c1e-5b1a-4c55-9a51-111111111111",
  name: "Northwind",
  short_name: "NW",
  avatar_url: null,
  role: "Member",
  owner_steam_id: DANA,
};

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;

async function mountPanel() {
  wrapper = await mountSuspended(ChatPanel, {
    props: { isSidebarOpen: true, isTabActive: true },
    global: { stubs: { ChatLobby: true } },
  });
  await flushPromises();
  return wrapper;
}

function openTeamRoom() {
  useChatTabs().openTab(teamChatTab(NORTHWIND));
}

beforeEach(() => {
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: ME, role: "user", teams: [NORTHWIND] } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn(async (url: string) =>
      url.includes(`/chat/rooms/team/${NORTHWIND.id}/members`)
        ? {
            members: [
              { steam_id: DANA, name: "Dana", avatar_url: null },
              { steam_id: EVAN, name: "Evan", avatar_url: null },
            ],
          }
        : { conversations: [] },
    ),
  );
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  useAuthStore().me = undefined;
  useMatchLobbyStore().lobbyChat = {};
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatPanel team room", () => {
  it("heads the room with the team's emblem and name, both linking to the team page", async () => {
    openTeamRoom();
    await mountPanel();

    const links = wrapper!.findAll(`a[href="/teams/${NORTHWIND.id}"]`);
    expect(links).toHaveLength(2);
    expect(links[0].text()).toBe("NW");
    expect(links[0].attributes("tabindex")).toBe("-1");
    expect(links[1].text()).toBe("Northwind");
    expect(wrapper!.text()).toContain("Team Chat");
  });

  it("counts the whole team, and how many of them are here", async () => {
    useMatchLobbyStore().lobbyChat = {
      [`team:${NORTHWIND.id}`]: new Map([
        [ME, { steam_id: ME, name: "Me" }],
        [DANA, { steam_id: DANA, name: "Dana" }],
      ]),
    } as any;
    openTeamRoom();
    await mountPanel();

    expect(wrapper!.text()).toContain("2 of 3 here");
  });

  it("lists everyone who can read the room, with those not here dimmed", async () => {
    useMatchLobbyStore().lobbyChat = {
      [`team:${NORTHWIND.id}`]: new Map([[DANA, { steam_id: DANA }]]),
    } as any;
    openTeamRoom();
    await mountPanel();

    await wrapper!
      .findAll("button")
      .find((button) => button.text().includes("of 3 here"))!
      .trigger("click");
    await flushPromises();

    const pills = wrapper!
      .findAll('a[href^="/players/"]')
      .map((pill) => ({
        name: pill.text(),
        away: pill.classes().includes("opacity-50"),
      }));
    expect(pills).toEqual(
      expect.arrayContaining([
        { name: "Dana", away: false },
        { name: "Evan", away: true },
      ]),
    );
  });

  it("says the player is no longer on the team in place of the room", async () => {
    openTeamRoom();
    useAuthStore().me = { steam_id: ME, role: "user", teams: [] } as any;
    await mountPanel();

    expect(wrapper!.text()).toContain("You're no longer on Northwind");
    expect(wrapper!.findComponent({ name: "ChatLobby" }).exists()).toBe(false);
  });
});
