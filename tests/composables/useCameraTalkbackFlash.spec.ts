import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useCameraTalkback } from "~/composables/useCameraTalkback";
import { negotiateWebRtc } from "~/composables/useCameraApi";

const flash = vi.hoisted(() => ({ signal: vi.fn(), clear: vi.fn() }));

vi.mock("~/composables/useTabFlash", () => ({
  useTabFlash: () => flash,
}));

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

function mountTalkback() {
  const scope = effectScope();
  const talkback = scope.run(() => useCameraTalkback(() => "m-1"))!;

  return { scope, talkback };
}

beforeEach(() => {
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  flash.signal.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCameraTalkback tab flash", () => {
  it("flashes the tab once the organizer's talkback goes live", async () => {
    const { scope, talkback } = mountTalkback();

    talkback.start();
    await flushPromises();

    expect(flash.signal).toHaveBeenCalledWith("admin_call");

    scope.stop();
  });

  it("does not flash for a talkback that connects after the page is gone", async () => {
    let connect!: () => void;
    vi.mocked(negotiateWebRtc).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          connect = resolve;
        }),
    );
    const { scope, talkback } = mountTalkback();

    talkback.start();
    await flushPromises();
    scope.stop();
    connect();
    await flushPromises();

    expect(flash.signal).not.toHaveBeenCalled();
  });
});
