import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useAuthStore } from "~/stores/AuthStore";
import {
  resetChatRoomSettings,
  syncChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";
import { fakeRoomSettingsClient, room } from "../helpers/fakeRoomSettings";

const { playNotificationSound, fake } = vi.hoisted(() => ({
  playNotificationSound: vi.fn(),
  fake: { api: null as any },
}));

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({ playNotificationSound }),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => fake.api.client,
}));

const ME = "76561198000000001";
const OTHER = "76561198000000002";

let counter = 0;
let lobbyId = "";
let unmount: (() => void) | undefined;

const line = (id: string, tagged = false): LobbyMessage => ({
  id: `${lobbyId}-${id}`,
  message: tagged ? "@Me look" : `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 9, 15, 12, 0)).toISOString(),
  from: { steam_id: OTHER, name: "Other" },
  ...(tagged ? { mentions: [{ steam_id: ME, name: "Me" }] } : {}),
});

const say = async (message: LobbyMessage) => {
  socket.emit(`lobby:tournament:${lobbyId}:chat`, message);
  await flushPromises();
};

beforeEach(async () => {
  lobbyId = `quiet-${++counter}`;
  fake.api = fakeRoomSettingsClient();
  vi.spyOn(console, "info").mockImplementation(() => {});
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  await syncChatRoomSettings(ME);
  await flushPromises();

  const wrapper = await mountSuspended(ChatLobby, {
    props: {
      instance: "chat-lobby-mute-spec",
      type: "tournament",
      lobbyId,
      playNotificationSound: true,
    },
  });
  unmount = () => wrapper.unmount();
  playNotificationSound.mockClear();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  resetChatRoomSettings();
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("ChatLobby in a room the player quieted", () => {
  it("rings for a room left alone", async () => {
    await say(line("a"));

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("stays silent for a muted room's chatter, and rings for a tag", async () => {
    fake.api.rooms([room(`chat:tournament:${lobbyId}`, { muted: true })]);

    await say(line("a"));

    expect(playNotificationSound).not.toHaveBeenCalled();

    await say(line("b", true));

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("rings only for tags in a room set to only tags", async () => {
    fake.api.rooms([
      room(`chat:tournament:${lobbyId}`, { notify: "mentions" }),
    ]);

    await say(line("a"));
    await say(line("b", true));

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("never rings in a room set to nothing, tags included", async () => {
    fake.api.rooms([room(`chat:tournament:${lobbyId}`, { notify: "nothing" })]);

    await say(line("a"));
    await say(line("b", true));

    expect(playNotificationSound).not.toHaveBeenCalled();
  });
});
