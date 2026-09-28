import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
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
  },
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";
const ROOM = `${ME}:${FRIEND}`;
const TAB = directTabId(ROOM);

let unmount: (() => void) | undefined;

async function mountIncoming() {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useIncomingDirectMessages();
        return () => h("div");
      },
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

function incoming() {
  socketMock.emit("direct:incoming", {
    roomId: ROOM,
    from: { steam_id: FRIEND, name: "Dana" },
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

describe("useIncomingDirectMessages", () => {
  it("badges the first message from someone not on the rail", async () => {
    await mountIncoming();

    incoming();

    const { tabs, unreadCounts, activeTabId } = useChatTabs();
    expect(tabs.value.map((tab) => tab.id)).toContain(TAB);
    expect(unreadCounts.value[TAB]).toBe(1);
    expect(activeTabId.value).toBeNull();
  });

  it("leaves an existing conversation to the room's own counter", async () => {
    await mountIncoming();

    incoming();
    useChatTabs().setUnread(TAB, 4);
    incoming();

    expect(useChatTabs().unreadCounts.value[TAB]).toBe(4);
  });
});
