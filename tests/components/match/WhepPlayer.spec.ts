import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WhepPlayer from "~/components/match/WhepPlayer.vue";

const WHEP_URL = "https://stream.example/match-1/whep";
const FALLBACK_URL = "https://stream.example/match-1/";
const SESSION_URL = "https://stream.example/match-1/whep/session-1";

const OFFER_SDP = [
  "v=0",
  "a=group:BUNDLE 0 1",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=mid:0",
  "a=ice-ufrag:abcd",
  "a=ice-pwd:0123456789abcdef01234567",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=mid:1",
  "a=ice-ufrag:abcd",
  "a=ice-pwd:0123456789abcdef01234567",
  "",
].join("\r\n");

const HOST = "candidate:1 1 udp 2122260223 192.168.1.20 50000 typ host";
const SRFLX =
  "candidate:2 1 udp 1686052607 203.0.113.7 61000 typ srflx raddr 192.168.1.20 rport 50000";

// Every peer connection the player opens, oldest first.
const peers: FakePeerConnection[] = [];

// What a new peer connection reports for ICE gathering: "complete" lets the
// player post at once, "gathering" makes it wait out its 2s cap unless it
// trickles.
let gatheringState: RTCIceGatheringState = "complete";

class FakePeerConnection {
  connectionState = "new";
  iceGatheringState = gatheringState;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onicecandidate:
    | ((event: { candidate: Partial<RTCIceCandidate> | null }) => void)
    | null = null;
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
    return { type: "offer" as const, sdp: OFFER_SDP };
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

  // The browser finding one of its own candidates.
  found(candidate: string) {
    this.onicecandidate?.({ candidate: { candidate, sdpMLineIndex: 0 } });
  }
}

let whepStatus = 201;
let answerLocation: string | null = null;
let patchStatus = 204;
// Holds the WHEP answer back until the test releases it.
let answerGate: Promise<void> | null = null;
const posts: number[] = [];
const patches: Array<{ url: string; headers: HeadersInit; body: string }> = [];
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

async function mountPlayer(props: { trickle?: boolean } = {}) {
  mounted = await mountSuspended(WhepPlayer, {
    props: { whepUrl: WHEP_URL, fallbackUrl: FALLBACK_URL, ...props },
  });
  return mounted;
}

beforeEach(() => {
  peers.length = 0;
  posts.length = 0;
  patches.length = 0;
  whepStatus = 201;
  answerLocation = null;
  patchStatus = 204;
  answerGate = null;
  gatheringState = "complete";
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);

  const fetchFromEnvironment = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === WHEP_URL) {
        posts.push(Date.now());
        await answerGate;
        return new Response("answer", {
          status: whepStatus,
          headers: answerLocation ? { Location: answerLocation } : {},
        });
      }
      if (String(input) === SESSION_URL && init?.method === "PATCH") {
        patches.push({
          url: String(input),
          headers: init.headers ?? {},
          body: String(init.body),
        });
        return new Response(null, { status: patchStatus });
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

  it("waits for ICE gathering before posting when not trickling", async () => {
    gatheringState = "gathering";
    const started = Date.now();
    await mountPlayer();

    await answered(1);
    expect(posts[0] - started).toBeGreaterThanOrEqual(1900);
  });

  describe("trickle ICE", () => {
    beforeEach(() => {
      gatheringState = "gathering";
      answerLocation = "/match-1/whep/session-1";
    });

    it("posts the offer at once and sends candidates to the session URL", async () => {
      let release!: () => void;
      answerGate = new Promise((resolve) => (release = resolve));
      const started = Date.now();
      await mountPlayer({ trickle: true });

      await vi.waitFor(() => expect(posts.length).toBe(1));
      expect(posts[0] - started).toBeLessThan(1000);

      // Found before the answer says where to send it: held until then.
      peers[0].found(HOST);
      expect(patches).toHaveLength(0);

      release();
      await answered(1);
      await vi.waitFor(() => expect(patches).toHaveLength(1));

      peers[0].found(SRFLX);
      await vi.waitFor(() => expect(patches).toHaveLength(2));

      expect(patches[0].headers).toMatchObject({
        "Content-Type": "application/trickle-ice-sdpfrag",
      });
      expect(patches[0].body).toBe(
        [
          "a=ice-ufrag:abcd",
          "a=ice-pwd:0123456789abcdef01234567",
          "m=video 9 UDP/TLS/RTP/SAVPF 96",
          "a=mid:0",
          `a=${HOST}`,
          "",
        ].join("\r\n"),
      );
      expect(patches[1].body).toContain(`a=${SRFLX}\r\n`);
      expect(peers).toHaveLength(1);
    });

    it("starts over gathering first when the answer has no session URL", async () => {
      answerLocation = null;
      await mountPlayer({ trickle: true });

      await answered(2);
      expect(peers[0].onicecandidate).not.toBeNull();
      expect(peers[1].onicecandidate).toBeNull();
    });

    it("starts over gathering first when a candidate is refused", async () => {
      patchStatus = 404;
      await mountPlayer({ trickle: true });

      await answered(1);
      peers[0].found(HOST);

      await answered(2);
      expect(peers[1].onicecandidate).toBeNull();
    });

    it("keeps a connection that is already up when a candidate is refused", async () => {
      patchStatus = 404;
      await mountPlayer({ trickle: true });

      await answered(1);
      peers[0].become("connected");
      peers[0].found(HOST);
      await vi.waitFor(() => expect(patches).toHaveLength(1));

      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(peers).toHaveLength(1);
    });
  });
});
