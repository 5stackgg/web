import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import socket from "~/web-sockets/Socket";
import { useCameraTalkback } from "~/composables/useCameraTalkback";
import { hangupPlayerTalk } from "~/composables/useCameraApi";
import { fakeServiceWorker } from "../helpers/fakeServiceWorker";

vi.mock("~/composables/useCameraApi", () => ({
  cameraPlayerTalkUrl: (matchId: string) => `talk/${matchId}`,
  fetchCameraTalkStatus: vi.fn(async () => ({ ready: true })),
  hangupPlayerTalk: vi.fn(async () => {}),
  negotiateWebRtc: vi.fn(async () => {}),
}));

vi.mock("~/composables/useIceServers", () => ({
  useIceServers: () => ({ load: async () => [] }),
}));

class FakePeerConnection {
  ontrack: unknown = null;
  addTransceiver() {}
  close() {}
}

let worker: ReturnType<typeof fakeServiceWorker>;
let setPresence: ReturnType<typeof vi.spyOn>;

function mountTalkback() {
  const scope = effectScope();
  const talkback = scope.run(() => useCameraTalkback(() => "m-1"))!;

  return { scope, talkback };
}

const lastFocus = () => setPresence.mock.calls.at(-1)?.[0]?.focus;

beforeEach(() => {
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  setPresence = vi.spyOn(socket, "setPresence").mockImplementation(() => {});
  worker = fakeServiceWorker({ tags: ["AdminCall:m-1", "MatchFound:c-1"] });
  vi.mocked(hangupPlayerTalk).mockClear();
});

afterEach(() => {
  worker.restore();
  setPresence.mockRestore();
  vi.unstubAllGlobals();
});

describe("useCameraTalkback", () => {
  it("drops whatever focus the previous page left behind", () => {
    const { scope } = mountTalkback();

    expect(setPresence).toHaveBeenCalledWith({ visible: true, focus: null });

    scope.stop();
  });

  it("closes the ring and reports the call as focused once it plays", async () => {
    const { scope, talkback } = mountTalkback();

    talkback.start();
    await flushPromises();

    expect(talkback.talking.value).toBe(true);
    expect(worker.closed()).toEqual(["AdminCall:m-1"]);
    expect(lastFocus()).toBe("AdminCall:m-1");

    talkback.end();
    await flushPromises();

    expect(lastFocus()).toBeNull();

    scope.stop();
  });

  it("hangs up on leaving only if this tab was listening for the call", async () => {
    const opened = mountTalkback();
    opened.scope.stop();

    expect(hangupPlayerTalk).not.toHaveBeenCalled();

    const connected = mountTalkback();
    connected.talkback.start();
    await flushPromises();
    connected.scope.stop();

    expect(hangupPlayerTalk).toHaveBeenCalledWith("m-1");
  });
});
