import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPanel from "~/components/hub/ChatPanel.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { useIncomingDirectMessages } from "~/composables/useIncomingDirectMessages";
import { directTabId } from "~/composables/useDirectMessages";

const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: any) => void>>();

  return {
    handlers,
    emit(event: string, data: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(data);
      }
    },
  };
});

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen(event: string, callback: (data: any) => void) {
      if (!socketMock.handlers.has(event)) {
        socketMock.handlers.set(event, new Set());
      }
      socketMock.handlers.get(event)!.add(callback);

      return {
        stop() {
          socketMock.handlers.get(event)?.delete(callback);
        },
      };
    },
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    hidesAuthor: () => false,
    markLobbyRead() {},
    lobbyMessages: () => [],
  },
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";
const ROOM = `${ME}:${FRIEND}`;
const DIRECT = directTabId(ROOM);

let unmount: (() => void) | undefined;

async function mountPanel(visible: boolean) {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useIncomingDirectMessages();
        return () =>
          h(ChatPanel, { isSidebarOpen: visible, isTabActive: visible });
      },
    }),
    { global: { stubs: { ChatLobby: true, ChatParticipants: true } } },
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

function incoming() {
  socketMock.emit("direct:incoming", {
    roomId: ROOM,
    from: { steam_id: FRIEND },
  });
}

beforeEach(() => {
  socketMock.handlers.clear();
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: ME } as any;
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ conversations: [] }));
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
});

describe("ChatPanel", () => {
  it("opens on the room already asked for rather than the first one", async () => {
    const { openTab } = useChatTabs();
    openTab({
      id: "matchmaking:lobby-1",
      label: "Lobby",
      instance: "matchmaking",
      type: "matchmaking",
      lobbyId: "lobby-1",
      pinned: true,
      activate: false,
    });
    openTab({
      id: DIRECT,
      label: "Dana",
      instance: "direct",
      type: "direct",
      lobbyId: ROOM,
    });

    await mountPanel(true);

    expect(useChatTabs().activeTabId.value).toBe(DIRECT);
  });

  it("keeps a first message's badge while the panel is hidden", async () => {
    await mountPanel(false);

    incoming();
    await nextTick();

    expect(useChatTabs().unreadCounts.value[DIRECT]).toBe(1);
  });

  it("clears a first message's badge once the panel shows it", async () => {
    await mountPanel(true);

    incoming();
    await nextTick();

    expect(useChatTabs().activeTabId.value).toBe(DIRECT);
    expect(useChatTabs().unreadCounts.value[DIRECT]).toBe(0);
  });
});

describe("ChatPanel dock", () => {
  const RECT = { left: 600, top: 300, width: 44, height: 44 };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Floating UI places the popper a few ticks after it opens.
  async function settle() {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await flushPromises();
  }

  async function focusDana() {
    useChatTabs().openTab({
      id: DIRECT,
      label: "Dana",
      instance: "direct",
      type: "direct",
      lobbyId: ROOM,
      avatarUrl: "https://example.com/dana.png",
    });
    const wrapper = await mountSuspended(ChatPanel, {
      props: { isSidebarOpen: true, isTabActive: true },
      global: { stubs: { ChatLobby: true, ChatParticipants: true } },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const root = document.documentElement;
    vi.spyOn(root, "clientWidth", "get").mockReturnValue(1280);
    vi.spyOn(root, "clientHeight", "get").mockReturnValue(800);
    const button = wrapper.get('img[alt="Dana"]').element.closest("button")!;
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      ...RECT,
      x: RECT.left,
      y: RECT.top,
      right: RECT.left + RECT.width,
      bottom: RECT.top + RECT.height,
      toJSON: () => ({}),
    } as DOMRect);

    button.focus();
    await settle();
    return button;
  }

  const translate = (content: Element) => {
    const { transform } = content.closest<HTMLElement>(
      "[data-reka-popper-content-wrapper]",
    )!.style;
    const match = transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/);
    expect(match, `positioned, not "${transform}"`).not.toBeNull();
    return match!.slice(1).map(Number);
  };

  it("anchors a room's tooltip to its button", async () => {
    const button = await focusDana();

    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("Dana");
    expect(button.getAttribute("aria-describedby")).toBe(tooltip!.id);

    const [x, y] = translate(tooltip!);
    expect(x).toBeGreaterThan(RECT.left - 50);
    expect(x).toBeLessThanOrEqual(RECT.left);
    expect(y).toBeGreaterThan(RECT.top);
    expect(y).toBeLessThan(RECT.top + RECT.height);
  });

  it("opens the room's menu at the pointer on a right-click", async () => {
    const button = await focusDana();

    button.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 610,
        clientY: 310,
      }),
    );
    await settle();

    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain("Remove");
    const [x, y] = translate(menu!);
    expect(x).toBeCloseTo(610, -1);
    expect(y).toBeCloseTo(310, -1);
  });
});
