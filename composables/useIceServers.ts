import { ref } from "vue";

// ICE servers for a *call* -- voice, video, or a player's camera feed.
//
// NOT for everything that opens an RTCPeerConnection. Two call sites must keep
// their own STUN-only list and are commented to say so:
//
//   web-sockets/Webrtc.ts  -- the regional matchmaking latency probes. Each one
//     opens a data channel to a region and times it. Given a relay, ICE can
//     gather and select a relay candidate, and every region would then report
//     the latency of the hop to the relay instead of the region. Matchmaking
//     region selection breaks silently, with nothing to trace it back from.
//
//   components/match/WhepPlayer.vue -- game streams and demo playback. Relaying
//     those through TURN would push every viewer's bitrate through one box.
//
// The list is fetched rather than hardcoded so the TURN secret stays server
// side, credentials expire on their own, and a relay can be turned on without
// shipping a web build. An install with no relay configured gets STUN alone,
// which is the normal case and not an error.

type IceServers = {
  iceServers: Array<RTCIceServer>;
  ttl: number;
};

const FALLBACK: Array<RTCIceServer> = [
  { urls: "stun:stun.l.google.com:19302" },
];

// Refetched a little before the credentials actually lapse, so a connection
// negotiated right on the boundary is never handed a pair that has just died.
const REFRESH_MARGIN_MS = 5 * 60_000;

const cached = ref<Array<RTCIceServer>>(FALLBACK);
let expiresAt = 0;
let inflight: Promise<Array<RTCIceServer>> | null = null;

export function useIceServers() {
  async function load(): Promise<Array<RTCIceServer>> {
    if (Date.now() < expiresAt) {
      return cached.value;
    }

    // One request no matter how many peer connections come up at once -- a
    // party joining a call negotiates a publish and a subscription per peer
    // within the same tick.
    if (inflight) {
      return inflight;
    }

    inflight = (async () => {
      try {
        const response = await fetch(
          `https://${useRuntimeConfig().public.apiDomain}/voice/ice-servers`,
          { credentials: "include" },
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = (await response.json()) as IceServers;

        cached.value = data.iceServers?.length ? data.iceServers : FALLBACK;

        // ttl 0 means no relay is configured, so there is nothing to expire --
        // but still re-ask occasionally in case one gets turned on.
        const lifetime = data.ttl ? data.ttl * 1000 : 30 * 60_000;
        // Capped at half the lifetime rather than applied flat: a margin wider
        // than the credentials themselves would cache them past their own
        // expiry, and coturn rejects every relay candidate that follows with
        // nothing failing loudly enough to trace.
        const margin = Math.min(REFRESH_MARGIN_MS, lifetime / 2);

        expiresAt = Date.now() + lifetime - margin;

        return cached.value;
      } catch {
        // A call that connects without a relay is far better than one that
        // refuses to start because this request failed.
        return FALLBACK;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  }

  // The last list fetched, for a caller that cannot await -- it starts as STUN
  // and is replaced once `load` has answered once.
  return { load, current: cached };
}
