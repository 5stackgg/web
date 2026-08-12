import { ref, computed, watch, onScopeDispose } from "vue";
import { negotiateWebRtc } from "~/composables/useCameraApi";
import {
  fetchVoiceParticipants,
  voiceLeaveUrl,
  voicePublishUrl,
  voiceSubscribeUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";

// One party voice session. MediaMTX acts as the SFU: each member publishes
// their own mic to voice-<lobbyId>-<steamId> and pulls every other member's
// path, so nobody needs a direct peer connection to anybody else.
export function useVoiceChat(lobbyId: () => string | null | undefined) {
  const connected = ref(false);
  const connecting = ref(false);
  const muted = ref(false);
  const error = ref<string | null>(null);
  const participants = ref<Array<VoiceParticipant>>([]);

  let publishPc: RTCPeerConnection | null = null;
  let micStream: MediaStream | null = null;
  const subscriptions = new Map<
    string,
    { pc: RTCPeerConnection; audio: HTMLAudioElement }
  >();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

  function iceServers(): Array<RTCIceServer> {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  async function join() {
    const id = lobbyId();

    if (!id || connected.value || connecting.value) {
      return;
    }

    connecting.value = true;
    error.value = null;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      publishPc = pc;

      for (const track of micStream.getAudioTracks()) {
        pc.addTrack(track, micStream);
      }

      await negotiateWebRtc(pc, voicePublishUrl(id), "include");

      connected.value = true;
      applyMute();
      void poll();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught);
      teardown();
    } finally {
      connecting.value = false;
    }
  }

  async function leave() {
    const id = lobbyId();

    teardown();

    if (id) {
      // Drops our own publish so the rest of the party stops hearing a dead
      // path; best effort, the session times out on its own regardless.
      await fetch(voiceLeaveUrl(id), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }

  function teardown() {
    connected.value = false;

    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    for (const [steamId] of subscriptions) {
      unsubscribe(steamId);
    }

    publishPc?.close();
    publishPc = null;

    for (const track of micStream?.getTracks() ?? []) {
      track.stop();
    }

    micStream = null;
    participants.value = [];
  }

  function applyMute() {
    for (const track of micStream?.getAudioTracks() ?? []) {
      // Keeps the path published while muted: dropping the track would look
      // like a disconnect to everyone else and churn the whole session.
      track.enabled = !muted.value;
    }
  }

  function toggleMute() {
    muted.value = !muted.value;
    applyMute();
  }

  async function subscribe(steamId: string) {
    const id = lobbyId();

    if (!id || subscriptions.has(steamId) || steamId === mySteamId.value) {
      return;
    }

    try {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const audio = new Audio();
      audio.autoplay = true;

      // Registered before negotiating so the first track is never missed.
      subscriptions.set(steamId, { pc, audio });

      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => {});
      };

      await negotiateWebRtc(pc, voiceSubscribeUrl(id, steamId), "include");
    } catch {
      unsubscribe(steamId);
    }
  }

  function unsubscribe(steamId: string) {
    const subscription = subscriptions.get(steamId);

    if (!subscription) {
      return;
    }

    subscription.pc.close();
    subscription.audio.pause();
    subscription.audio.srcObject = null;
    subscriptions.delete(steamId);
  }

  async function poll() {
    const id = lobbyId();

    if (!id || !connected.value) {
      return;
    }

    try {
      participants.value = await fetchVoiceParticipants(id);

      const speaking = new Set(
        participants.value
          .filter((participant) => participant.speaking)
          .map((participant) => participant.steamId),
      );

      for (const steamId of speaking) {
        if (steamId !== mySteamId.value) {
          void subscribe(steamId);
        }
      }

      // Anyone who stopped publishing: drop the peer connection rather than
      // leaving a dead one open for the rest of the session.
      for (const [steamId] of subscriptions) {
        if (!speaking.has(steamId)) {
          unsubscribe(steamId);
        }
      }
    } catch {
      // A failed poll is not a reason to tear the session down.
    }

    pollTimer = setTimeout(poll, 3000);
  }

  // Leaving the party ends the call: the lobby the session belongs to is gone.
  watch(
    () => lobbyId(),
    (next, previous) => {
      if (previous && next !== previous) {
        teardown();
      }
    },
  );

  onScopeDispose(() => {
    teardown();
  });

  return {
    connected,
    connecting,
    muted,
    error,
    participants,
    join,
    leave,
    toggleMute,
  };
}
