import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { setActiveHub } from "~/composables/useHubState";

const joined = vi.hoisted(() => ({
  rooms: [] as Array<{
    type: string;
    id: string;
    handlers: Record<string, (data: any) => void>;
  }>,
}));

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: (_instance: string, type: string, id: string) => {
      const room = { type, id, handlers: {} as Record<string, any> };
      joined.rooms.push(room);
      return {
        messages: [],
        on(event: string, callback: (data: any) => void) {
          room.handlers[event] = callback;
        },
        leave() {},
      };
    },
    markLobbyRead() {},
  },
}));

const ME = "76561198000000001";
const TEAMMATE = "76561198000000002";
const NORTHWIND = {
  id: "6f1c1c1e-5b1a-4c55-9a51-111111111111",
  name: "Northwind",
  short_name: "NW",
  avatar_url: null,
  role: "Member",
  owner_steam_id: TEAMMATE,
};
const ACADEMY = {
  id: "6f1c1c1e-5b1a-4c55-9a51-222222222222",
  name: "Northwind Academy",
  short_name: "NWA",
  avatar_url: null,
  role: "Admin",
  owner_steam_id: ME,
};

let unmount: (() => void) | undefined;

function signIn(teams: unknown[] | undefined) {
  useAuthStore().me = { steam_id: ME, role: "user", teams } as any;
}

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

const teamTabs = () =>
  useChatTabs().tabs.value.filter((tab) => tab.type === "team");

beforeEach(() => {
  joined.rooms.length = 0;
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ threads: [] }));
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useRightSidebar().setRightSidebarOpen(false);
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
});

describe("useChatTabSetup team rooms", () => {
  it("opens a room for each of the player's teams, under the team's name, and joins it", async () => {
    signIn([NORTHWIND, ACADEMY]);

    await mountSetup();

    expect(teamTabs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `team:${NORTHWIND.id}`,
          type: "team",
          lobbyId: NORTHWIND.id,
          label: "Northwind",
          pinned: true,
        }),
        expect.objectContaining({
          id: `team:${ACADEMY.id}`,
          label: "Northwind Academy",
        }),
      ]),
    );
    expect(teamTabs()).toHaveLength(2);
    expect(
      joined.rooms
        .filter(({ type }) => type === "team")
        .map(({ id }) => id)
        .sort(),
    ).toEqual([NORTHWIND.id, ACADEMY.id].sort());
    expect(useChatTabs().activeTabId.value).toBeNull();
  });

  it("follows a rename, and closes the room of a team the player left", async () => {
    signIn([NORTHWIND, ACADEMY]);
    await mountSetup();

    signIn([{ ...NORTHWIND, name: "Northwind Esports" }, ACADEMY]);
    await nextTick();

    expect(
      teamTabs().find(({ lobbyId }) => lobbyId === NORTHWIND.id)?.label,
    ).toBe("Northwind Esports");

    signIn([ACADEMY]);
    await nextTick();

    expect(teamTabs().map(({ lobbyId }) => lobbyId)).toEqual([ACADEMY.id]);
  });

  it("closes nothing while the player's teams are still loading", async () => {
    signIn([NORTHWIND]);
    await mountSetup();

    signIn(undefined);
    await nextTick();

    expect(teamTabs()).toHaveLength(1);
  });

  it("keeps a room on screen after the player is removed, until they switch rooms", async () => {
    signIn([NORTHWIND, ACADEMY]);
    await mountSetup();
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("chat");
    useChatTabs().setActiveTab(`team:${NORTHWIND.id}`);

    signIn([ACADEMY]);
    await nextTick();

    expect(teamTabs().map(({ lobbyId }) => lobbyId)).toContain(NORTHWIND.id);

    useChatTabs().setActiveTab(`team:${ACADEMY.id}`);
    await nextTick();

    expect(teamTabs().map(({ lobbyId }) => lobbyId)).toEqual([ACADEMY.id]);
  });

  it("counts a teammate's line as unread", async () => {
    signIn([NORTHWIND]);
    await mountSetup();

    const room = joined.rooms.find(({ type }) => type === "team");
    room?.handlers["lobby:chat"]?.({
      id: "line-1",
      message: "scrim at 8",
      timestamp: new Date().toISOString(),
      from: { steam_id: TEAMMATE, name: "Teammate" },
    });

    expect(useChatTabs().unreadCounts.value[`team:${NORTHWIND.id}`]).toBe(1);
  });
});
