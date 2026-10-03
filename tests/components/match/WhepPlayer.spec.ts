import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WhepPlayer from "~/components/match/WhepPlayer.vue";

const WHEP_URL = "https://stream.example/match-1/whep";
const FALLBACK_URL = "https://stream.example/match-1/";

// Every peer connection the player opens, oldest first.
const peers: FakePeerConnection[] = [];

class FakePeerConnection {
  connectionState = "new";
  iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: unknown = null;

  constructor() {
    peers.push(this);
  }

  addTransceiver() {}
  addEventListener() {}
  removeEventListener() {}
  getSenders() {
    return [];
  }
  async getStats() {
    return new Map();
  }
  async createOffer() {
    return { type: "offer" as const, sdp: "offer" };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
  }
  close() {}

  become(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

let whepStatus = 201;
let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null;

// Waits for attempt `n` to have its answer, so a state change lands on a
// connection the player has finished setting up.
async function answered(n: number) {
  await vi.waitFor(
    () => {
      expect(peers.length).toBe(n);
      expect(peers[n - 1].remoteDescription).not.toBeNull();
    },
    { timeout: 5000 },
  );
}

async function mountPlayer() {
  mounted = await mountSuspended(WhepPlayer, {
    props: { whepUrl: WHEP_URL, fallbackUrl: FALLBACK_URL },
  });
  return mounted;
}

beforeEach(() => {
  peers.length = 0;
  whepStatus = 201;
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);

  const fetchFromEnvironment = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === WHEP_URL) {
        return Promise.resolve(new Response("answer", { status: whepStatus }));
      }
      return fetchFromEnvironment(input, init);
    }),
  );
});

afterEach(() => {
  // A player left mounted keeps retrying into the next test's peers.
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

describe("WhepPlayer", () => {
  it("falls back to HLS when WebRTC never connects", async () => {
    const wrapper = await mountPlayer();

    for (let attempt = 1; attempt <= 3; attempt++) {
      await answered(attempt);
      peers[attempt - 1].become("failed");
      await flushPromises();
    }

    expect(wrapper.find("iframe").attributes("src")).toBe(FALLBACK_URL);

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(peers.length).toBe(3);
  });

  it("falls back to HLS when the WHEP request keeps failing", async () => {
    whepStatus = 500;
    const wrapper = await mountPlayer();

    await vi.waitFor(
      () => expect(wrapper.find("iframe").attributes("src")).toBe(FALLBACK_URL),
      { timeout: 5000 },
    );
    expect(peers.length).toBe(3);
  });

  it("keeps retrying WebRTC instead of falling back once it has connected", async () => {
    const wrapper = await mountPlayer();

    await answered(1);
    peers[0].become("connected");
    peers[0].become("failed");

    for (let attempt = 2; attempt <= 4; attempt++) {
      await answered(attempt);
      peers[attempt - 1].become("failed");
      await flushPromises();
    }

    await answered(5);
    expect(wrapper.find("iframe").exists()).toBe(false);
  });
});
