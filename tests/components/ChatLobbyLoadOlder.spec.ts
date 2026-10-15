import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useAuthStore } from "~/stores/AuthStore";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const { playNotificationSound } = vi.hoisted(() => ({
  playNotificationSound: vi.fn(),
}));

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({ playNotificationSound }),
}));

const ME = "76561198000000001";
const OTHER = "76561198000000002";
const ROW = 40;
const EDGE = 28;

const line = (id: string, minute: number): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 9, 15, 12, minute)).toISOString(),
  from: { steam_id: OTHER, name: "Other" },
});

let counter = 0;
let lobbyId = "";
let unmount: (() => void) | undefined;
let restore: () => void;
let sent: () => Array<{ event: string; data: any }>;

beforeEach(() => {
  lobbyId = `load-older-${++counter}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
  useAuthStore().me = { steam_id: ME, role: "user" } as any;

  const send = vi.fn();
  const held = {
    connected: (socket as any).connected,
    connection: (socket as any).connection,
  };
  (socket as any).connected = true;
  (socket as any).connection = { send };
  sent = () => send.mock.calls.map(([raw]) => JSON.parse(raw));
  restore = () => Object.assign(socket as any, held);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  restore();
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function mountRoom() {
  const wrapper = await mountSuspended(ChatLobby, {
    props: {
      instance: "chat-lobby-load-older-spec",
      type: "match",
      lobbyId,
      playNotificationSound: true,
    },
  });
  unmount = () => wrapper.unmount();

  socket.emit(`lobby:match:${lobbyId}:messages`, {
    id: lobbyId,
    messages: [line("e", 5), line("f", 6), line("g", 7)],
    more: true,
    cursor: "cursor-e",
  });
  await flushPromises();

  return wrapper;
}

// No layout here: the list is a column of fixed-height rows under the edge
// row, scrolled by scrollTop.
function layOut(scroller: HTMLElement, clientHeight = 300) {
  let scrollTop = 0;
  Object.defineProperty(scroller, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(scroller, "scrollHeight", {
    configurable: true,
    get: () => 4000,
  });
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this === scroller) {
        return { top: 0, bottom: clientHeight } as DOMRect;
      }
      const rows = [...scroller.querySelectorAll("[data-chat-key]")];
      const top = EDGE + rows.indexOf(this) * ROW - scrollTop;
      return { top, bottom: top + ROW } as DOMRect;
    },
  );
}

const scrollerOf = (wrapper: Awaited<ReturnType<typeof mountRoom>>) => {
  const edge = wrapper.find("[data-chat-history-edge]").element;
  return edge.parentElement as HTMLElement;
};

const rows = (wrapper: Awaited<ReturnType<typeof mountRoom>>) =>
  wrapper
    .findAll("[data-chat-key]")
    .map((row) => row.attributes("data-chat-key"));

const requests = () =>
  sent().filter(({ event }) => event === "lobby:history");

function answer(page: Record<string, unknown>) {
  socket.emit(`lobby:match:${lobbyId}:history`, {
    id: lobbyId,
    requestId: requests().at(-1)?.data.requestId,
    ...page,
  });
}

describe("ChatLobby loading older messages", () => {
  it("asks for the page before when scrolled to the top", async () => {
    const wrapper = await mountRoom();
    const scroller = scrollerOf(wrapper);
    layOut(scroller);

    scroller.scrollTop = 500;
    scroller.dispatchEvent(new Event("scroll"));
    expect(requests()).toEqual([]);

    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll"));
    scroller.dispatchEvent(new Event("scroll"));

    expect(requests()).toEqual([
      {
        event: "lobby:history",
        data: {
          type: "match",
          id: lobbyId,
          before: "cursor-e",
          requestId: expect.any(String),
        },
      },
    ]);
  });

  it("shows it is loading, then puts the page above without repeating a line, and says when there is no more", async () => {
    const wrapper = await mountRoom();
    const scroller = scrollerOf(wrapper);
    layOut(scroller);

    scroller.dispatchEvent(new Event("scroll"));
    await flushPromises();
    expect(wrapper.text()).toContain("Loading older messages…");

    answer({
      messages: [line("c", 3), line("d", 4), line("e", 5)],
      more: false,
      cursor: "cursor-c",
    });
    await flushPromises();

    expect(rows(wrapper)).toEqual(["c", "d", "e", "f", "g"]);
    expect(wrapper.text()).not.toContain("Loading older messages…");
    expect(wrapper.text()).toContain("No older messages");
  });

  it("keeps the line being read where it was on screen", async () => {
    const wrapper = await mountRoom();
    const scroller = scrollerOf(wrapper);
    layOut(scroller);

    scroller.scrollTop = 20;
    scroller.dispatchEvent(new Event("scroll"));
    answer({
      messages: [line("c", 3), line("d", 4)],
      more: true,
      cursor: "cursor-c",
    });
    await flushPromises();

    expect(scroller.scrollTop).toBe(20 + 2 * ROW);
  });

  it("neither rings nor reports older lines as new", async () => {
    const wrapper = await mountRoom();
    const scroller = scrollerOf(wrapper);
    layOut(scroller);

    scroller.dispatchEvent(new Event("scroll"));
    answer({ messages: [line("d", 4)], more: true, cursor: "cursor-d" });
    await flushPromises();

    expect(rows(wrapper)).toEqual(["d", "e", "f", "g"]);
    expect(wrapper.emitted("message-received")).toBeUndefined();
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("asks nothing while the list is hidden", async () => {
    const wrapper = await mountRoom();
    const scroller = scrollerOf(wrapper);
    layOut(scroller, 0);

    scroller.dispatchEvent(new Event("scroll"));

    expect(requests()).toEqual([]);
  });
});
