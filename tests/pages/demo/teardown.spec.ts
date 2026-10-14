import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DemoPage from "~/pages/demo/[matchMapId].vue";
import { useAuthStore } from "~/stores/AuthStore";
import socket from "~/web-sockets/Socket";

const SESSION = "session-1";

let observer: any;
let unsubscribed: ReturnType<typeof vi.fn>;
let mutations: string[];

function serve() {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "mutate").mockImplementation((options: any) => {
    const name = options.mutation.definitions[0].selectionSet.selections[0]
      .name.value as string;
    mutations.push(name);
    return Promise.resolve({
      data: {
        [name]: {
          success: true,
          session_id: SESSION,
          stream_url: null,
          match_map_id: "map-1",
        },
      },
    }) as any;
  });
  vi.spyOn(client, "query").mockResolvedValue({
    data: { match_map_demos: [] },
  } as any);
  vi.spyOn(client, "subscribe").mockImplementation(
    () =>
      ({
        subscribe(next: any) {
          observer = next;
          return { unsubscribe: unsubscribed, closed: false };
        },
      }) as any,
  );
}

beforeEach(() => {
  mutations = [];
  unsubscribed = vi.fn();
  observer = undefined;
  serve();
  vi.spyOn(socket, "event").mockImplementation(() => {});
  useAuthStore().me = { steam_id: "76561198000000001", role: "user" } as any;
});

afterEach(() => {
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function playThenLeave(route: string) {
  const removed = vi.spyOn(document, "removeEventListener");
  const wrapper = await mountSuspended(DemoPage, {
    route,
    global: { stubs: { DemoPlayer: true, ShortcutOverlay: true } },
  });
  await flushPromises();

  observer.next({
    data: { match_demo_sessions: [{ id: SESSION, status: "playing" }] },
  });
  await flushPromises();
  expect(socket.listenerCount("demo-session:state")).toBe(1);

  wrapper.unmount();
  await flushPromises();
  return removed;
}

describe("demo page attached to the dev pod", () => {
  it("lets go of the session's listeners when left, without stopping the pod", async () => {
    const removed = await playThenLeave("/demo/dev");

    expect(mutations).toEqual(["attachDemo"]);
    expect(unsubscribed).toHaveBeenCalled();
    expect(socket.listenerCount("demo-session:state")).toBe(0);
    expect(removed).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});

describe("demo page for a match map", () => {
  it("stops the session and lets go of its listeners when left", async () => {
    const removed = await playThenLeave("/demo/map-1");

    expect(mutations).toEqual(["watchDemo", "stopWatchDemo"]);
    expect(unsubscribed).toHaveBeenCalled();
    expect(socket.listenerCount("demo-session:state")).toBe(0);
    expect(removed).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
