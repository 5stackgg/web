import { ref, onScopeDispose } from "vue";
import {
  cameraPlayerTalkUrl,
  fetchCameraTalkStatus,
  hangupPlayerTalk,
  negotiateWebRtc,
} from "~/composables/useCameraApi";
import { useIceServers } from "~/composables/useIceServers";

// The other direction: an organizer talking to the player whose camera this is.
// Nothing here starts until the player has connected, because the connect click
// is the user gesture that lets an incoming stream play with audio at all.

export function useCameraTalkback(matchId: () => string) {
  const talkEl = ref<HTMLVideoElement | null>(null);
  const talking = ref(false);
  const muted = ref(false);

  let talkPc: RTCPeerConnection | null = null;
  let talkTimer: ReturnType<typeof setTimeout> | null = null;
  // Closing the page while a poll is in flight used to leave the loop running:
  // clearing the timer does nothing to a request that is about to re-arm it, so
  // the page kept polling -- and could still open a peer connection -- forever.
  let disposed = false;

  const ice = useIceServers();

  // If autoplay refuses sound the promise rejects and nothing plays at all, so
  // fall back to a muted start -- a picture with a visible unmute beats a black
  // panel the player cannot fix.
  async function play() {
    const el = talkEl.value;

    if (!el) {
      return;
    }

    el.muted = muted.value;

    try {
      await el.play();
    } catch {
      muted.value = true;
      el.muted = true;
      await el.play().catch(() => {});
    }
  }

  async function join() {
    if (disposed) {
      return;
    }

    try {
      const pc = new RTCPeerConnection({ iceServers: await ice.load() });
      talkPc = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (!talkEl.value) {
          return;
        }

        talkEl.value.srcObject = event.streams[0];
        void play();
      };

      await negotiateWebRtc(pc, cameraPlayerTalkUrl(matchId()), "include");
      talking.value = true;
    } catch {
      end();
    }
  }

  function end() {
    talking.value = false;
    muted.value = false;
    talkPc?.close();
    talkPc = null;

    if (talkEl.value) {
      talkEl.value.srcObject = null;
    }
  }

  async function poll() {
    const { ready } = await fetchCameraTalkStatus(matchId());

    if (disposed) {
      return;
    }

    if (ready && !talking.value) {
      await join();
    } else if (!ready && talking.value) {
      end();
    }

    if (disposed) {
      return;
    }

    talkTimer = setTimeout(poll, 2000);
  }

  function toggleAudio() {
    muted.value = !muted.value;
    void play();
  }

  function start() {
    void poll();
  }

  onScopeDispose(() => {
    disposed = true;

    if (talkTimer) {
      clearTimeout(talkTimer);
    }

    end();
    void hangupPlayerTalk(matchId());
  });

  return { talkEl, talking, muted, start, toggleAudio, end };
}
