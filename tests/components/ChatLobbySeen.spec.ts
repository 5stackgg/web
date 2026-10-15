import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useChatReadState } from "~/composables/useChatReadState";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({ playNotificationSound: vi.fn() }),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";
let counter = 0;
let teamId = "";

const line = (id: string, timestamp: string): LobbyMessage => ({
  id,
  message: "@kappa ready?",
  source: "web",
  timestamp,
  from: { steam_id: DANA, name: "Dana" },
  mentions: [{ steam_id: ME, name: "kappa" }],
});

let unmount: (() => void) | undefined;

async function mountRoom(messages: LobbyMessage[]) {
  const wrapper = await mountSuspended(ChatLobby, {
    props: {
      instance: "seen-spec",
      type: "team",
      lobbyId: teamId,
      playNotificationSound: false,
    },
  });
  unmount = () => wrapper.unmount();

  socket.emit(`lobby:team:${teamId}:messages`, { messages });
  await flushPromises();

  return wrapper;
}

beforeEach(async () => {
  teamId = `6f1c1c1e-5b1a-4c55-9a51-${String(++counter).padStart(12, "0")}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
  useAuthStore().me = {
    steam_id: ME,
    name: "kappa",
    role: "user",
    teams: [
      {
        id: teamId,
        name: "Northwind",
        short_name: "NW",
        role: "Member",
        owner_steam_id: DANA,
      },
    ],
  } as any;
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ threads: [] }));
  await useChatReadState().hydrate();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatLobby seen", () => {
  const timestamp = new Date(Date.UTC(2026, 9, 15, 12, 0)).toISOString();

  it("keeps a tag of the viewer lit while the room is open", async () => {
    const wrapper = await mountRoom([line("a", timestamp)]);

    expect(wrapper.find("[data-chat-mentions-me]").exists()).toBe(true);
  });

  it("counts the room seen once it is left", async () => {
    const wrapper = await mountRoom([line("a", timestamp)]);

    await wrapper.setProps({ isActiveTab: false } as any);

    expect(useChatReadState().isUnseen("team", teamId, timestamp)).toBe(false);
    expect(wrapper.find("[data-chat-mentions-me]").exists()).toBe(false);
  });

  it("does not count a room nobody looked at as seen", async () => {
    const wrapper = await mountRoom([line("a", timestamp)]);
    await wrapper.setProps({ isActiveTab: false } as any);

    socket.emit(`lobby:team:${teamId}:messages`, {
      messages: [line("a", timestamp), line("b", "2026-10-15T12:05:00.000Z")],
    });
    await flushPromises();
    unmount?.();
    unmount = undefined;

    expect(
      useChatReadState().isUnseen("team", teamId, "2026-10-15T12:05:00.000Z"),
    ).toBe(true);
  });
});
