import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPopout from "~/pages/chat/[tabId].vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { directRoomId } from "~/composables/useDirectMessages";
import { useAuthStore } from "~/stores/AuthStore";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const graphql = vi.hoisted(() => ({
  observers: [] as Array<{ observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn(),
    subscribe: () => ({
      subscribe(observer: any) {
        const entry = { observer, closed: false };
        graphql.observers.push(entry);
        return {
          unsubscribe() {
            entry.closed = true;
          },
        };
      },
    }),
  }),
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";

const line = (id: string, minute: number, from: string): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString(),
  from: { steam_id: from, name: `Player ${from}` },
});

function setBlocks(...steamIds: string[]) {
  const open = graphql.observers.filter((entry) => !entry.closed);
  expect(open).toHaveLength(1);
  open[0].observer.next({
    data: {
      player_blocks: steamIds.map((steamId) => ({
        blocked_steam_id: steamId,
        created_at: "2026-09-28T12:00:00Z",
        blocked: { steam_id: steamId, name: steamId, avatar_url: null },
      })),
    },
  });
}

let unmount: (() => void) | undefined;

async function mountPopout(tabId: string) {
  const wrapper = await mountSuspended(ChatPopout, {
    route: `/chat/${encodeURIComponent(tabId)}`,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ threads: [] }));
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  await flushPromises();
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
  socket.setHiddenAuthors([]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chat pop-out", () => {
  it("hides a player blocked while the window is open", async () => {
    const wrapper = await mountPopout("match:popout-match");
    setBlocks();
    socket.emit("lobby:match:popout-match:messages", {
      messages: [line("a", 0, DANA), line("b", 1, EVAN)],
    });
    await flushPromises();

    expect(wrapper.text()).toContain("line a");

    setBlocks(DANA);
    await flushPromises();

    expect(wrapper.text()).not.toContain("line a");
    expect(wrapper.text()).toContain("line b");
  });

  it("stops showing a conversation with a player who gets blocked", async () => {
    const wrapper = await mountPopout(`direct:${directRoomId(ME, DANA)}`);
    setBlocks();
    await flushPromises();

    expect(wrapper.findComponent(ChatLobby).exists()).toBe(true);

    setBlocks(DANA);
    await flushPromises();

    expect(wrapper.findComponent(ChatLobby).exists()).toBe(false);
    expect(wrapper.text()).toContain(
      "This chat is not currently open in your session.",
    );
  });

  it("keeps a conversation with anyone else", async () => {
    const wrapper = await mountPopout(`direct:${directRoomId(ME, EVAN)}`);
    setBlocks(DANA);
    await flushPromises();

    expect(wrapper.findComponent(ChatLobby).exists()).toBe(true);
  });
});
