import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import ChatMessages from "~/components/chat/ChatMessages.vue";
import { useAuthStore } from "~/stores/AuthStore";
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
let teamCounter = 0;
let teamId = "";

const line = (id: string): LobbyMessage => ({
  id,
  message: `line ${id}`,
  source: "web",
  timestamp: new Date().toISOString(),
  from: { steam_id: DANA, name: "Dana" },
});

let unmount: (() => void) | undefined;

function signIn(me: Record<string, unknown>, team: Record<string, unknown>) {
  useAuthStore().me = {
    steam_id: ME,
    role: "user",
    teams: [
      {
        id: teamId,
        name: "Northwind",
        short_name: "NW",
        role: "Member",
        owner_steam_id: DANA,
        ...team,
      },
    ],
    ...me,
  } as any;
}

async function mountRoom(messages: LobbyMessage[] = []) {
  const wrapper = await mountSuspended(ChatLobby, {
    props: {
      instance: "team-room-spec",
      type: "team",
      lobbyId: teamId,
      playNotificationSound: false,
    },
  });
  unmount = () => wrapper.unmount();

  if (messages.length) {
    socket.emit(`lobby:team:${teamId}:messages`, { messages });
  }
  await flushPromises();

  return wrapper;
}

beforeEach(() => {
  teamId = `6f1c1c1e-5b1a-4c55-9a51-${String(++teamCounter).padStart(12, "0")}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("ChatLobby team room", () => {
  it("lets the team's admins and owner remove anyone's line", async () => {
    signIn({}, { role: "Admin" });
    let wrapper = await mountRoom([line("a")]);
    expect(wrapper.getComponent(ChatMessages).props("canModerate")).toBe(true);
    unmount?.();

    signIn({}, { role: "Member", owner_steam_id: ME });
    wrapper = await mountRoom([line("b")]);
    expect(wrapper.getComponent(ChatMessages).props("canModerate")).toBe(true);
  });

  it("gives site staff nothing extra in a team's room", async () => {
    signIn({ role: "administrator" }, { role: "Member" });
    const wrapper = await mountRoom([line("c")]);

    expect(wrapper.getComponent(ChatMessages).props("canModerate")).toBe(
      false,
    );
  });

  it("tells an empty room who can read it", async () => {
    signIn({}, {});
    const wrapper = await mountRoom();

    expect(wrapper.text()).toContain("No messages yet");
    expect(wrapper.text()).toContain(
      "Only Northwind's players and owner can read this.",
    );
  });

  it("takes attachments", async () => {
    signIn({}, {});
    const wrapper = await mountRoom();

    expect((wrapper.vm as any).attachmentRoom).toEqual({
      type: "team",
      id: teamId,
    });
  });
});
