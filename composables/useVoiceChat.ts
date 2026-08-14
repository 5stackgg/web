import { ref, computed, watch, onScopeDispose } from "vue";
import { negotiateWebRtc, SignalingError } from "~/composables/useCameraApi";
import {
  fetchVoiceParticipants,
  voiceLeaveUrl,
  voicePublishUrl,
  voiceSubscribeUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useAudioSettings } from "~/composables/useAudioSettings";
import { useMicPipeline, type MicPipeline } from "~/composables/useMicPipeline";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";
import socket from "~/web-sockets/Socket";

// One party voice session. MediaMTX acts as the SFU: each member publishes
// their own mic to voice-<lobbyId>-<steamId> and pulls every other member's
// path, so nobody needs a direct peer connection to anybody else.
//
// The microphone itself -- the gate, the meter, the device handling -- belongs
// to useMicPipeline, which a camera feed uses just the same. What is left here
// is the channel: who is in it, who is talking, and the peer connections.

export type { VoiceInputMode } from "~/composables/useAudioSettings";

// Peers are kept for a beat after they stop publishing: one failed poll of
// MediaMTX reports the whole party as gone, and tearing every peer connection
// down and renegotiating it a poll later is both audible and expensive.
const SUBSCRIPTION_GRACE_MS = 15_000;

export type VoiceChatOptions = {
  // A microphone already open for something else -- the camera page publishes
  // one with its video feed. Sharing it means one capture, one gate and one
  // mute for both destinations rather than two competing opens of the same
  // device. The owner keeps it: teardown here must not close it.
  pipeline?: MicPipeline;
};

export function useVoiceChat(
  lobbyId: () => string | null | undefined,
  channelLabel?: () => string,
  options: VoiceChatOptions = {},
) {
  const registry = useActiveVoiceChannel();
  const settings = useAudioSettings();
  const peerAudio = useVoicePeerAudio();

  const connected = ref(false);
  const connecting = ref(false);
  // `error` is an i18n key; `errorDetail` is the raw technical line, shown
  // underneath so a failure can actually be diagnosed rather than guessed at.
  const error = ref<string | null>(null);
  const errorDetail = ref<string | null>(null);
  const participants = ref<Array<VoiceParticipant>>([]);

  let publishPc: RTCPeerConnection | null = null;

  // A device change rebuilds the graph and so replaces the outgoing track; the
  // session survives it because the sender is handed the replacement rather
  // than the whole thing being renegotiated.
  function republish(track: MediaStreamTrack | null) {
    if (!track) {
      return;
    }

    void publishPc
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === "audio")
      ?.replaceTrack(track)
      .catch(() => {});
  }

  // Borrowed rather than owned when the caller already has a live microphone.
  const borrowedPipeline = !!options.pipeline;
  const pipeline =
    options.pipeline ?? useMicPipeline({ onTrack: republish });

  if (borrowedPipeline) {
    onScopeDispose(pipeline.onTrack(republish));
  }

  const subscriptions = new Map<
    string,
    { pc: RTCPeerConnection; audio: HTMLAudioElement }
  >();
  const lastPublishing = new Map<string, number>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let speakingReported = false;

  const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

  function iceServers(): Array<RTCIceServer> {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  function describeError(caught: unknown) {
    // Keep the raw cause visible in the console; the UI gets the short version.
    console.error("[voice]", caught);

    errorDetail.value = null;

    if (caught instanceof SignalingError) {
      errorDetail.value = caught.message;

      if (caught.kind === "unreachable") {
        return "voice.errors.unreachable";
      }
      if (caught.status === 401 || caught.status === 403) {
        return "voice.errors.forbidden";
      }
      if (caught.status === 404) {
        return "voice.errors.not_deployed";
      }

      return "voice.errors.signaling";
    }

    const name = (caught as Error)?.name;

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "voice.errors.permission_denied";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "voice.errors.no_microphone";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "voice.errors.microphone_busy";
    }

    errorDetail.value = (caught as Error)?.message ?? String(caught);
    return "voice.errors.unknown";
  }

  // Opens the mic without any peer connection, so the meter, the gate and the
  // loopback all work before joining -- a player can get their setup right
  // before anyone else can hear them.
  async function startPreview() {
    if (pipeline.live.value) {
      return true;
    }

    const blocked = settings.unsupported.value;

    if (blocked) {
      error.value = blocked;
      return false;
    }

    error.value = null;
    errorDetail.value = null;

    try {
      await pipeline.start();
      return true;
    } catch (caught) {
      error.value = describeError(caught);
      teardown();
      return false;
    }
  }

  function stopPreview() {
    if (connected.value) {
      return;
    }

    teardown();
  }

  // Mic open but nothing published: the state the settings dialog wants before
  // anyone has joined anything.
  const previewing = computed(() => pipeline.live.value && !connected.value);

  async function join() {
    const id = lobbyId();

    if (!id || connected.value || connecting.value) {
      return;
    }

    connecting.value = true;

    try {
      if (!(await startPreview())) {
        return;
      }

      const outgoing = pipeline.track();

      if (!outgoing) {
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      publishPc = pc;

      pc.addTrack(outgoing, pipeline.stream() as MediaStream);

      await negotiateWebRtc(pc, voicePublishUrl(id), "include");

      connected.value = true;
      registry.register(id, leave);
      registry.claim({ id, label: channelLabel?.() ?? id });
      // Published only now: a surface reading the registry -- the right hub --
      // renders the call, and there is no call until the publish is up.
      registry.attach({
        id,
        label: channelLabel?.() ?? id,
        participants,
        muted: pipeline.muted,
        transmitting: pipeline.transmitting,
        toggleMute: pipeline.toggleMute,
        leave,
      });
      reportSpeaking(pipeline.transmitting.value);
      void poll();
    } catch (caught) {
      error.value = describeError(caught);
      teardown();
    } finally {
      connecting.value = false;
    }
  }

  async function leave() {
    const id = lobbyId();

    teardown();

    if (id) {
      registry.unregister(id);

      // Drops our own publish so the rest of the party stops hearing a dead
      // path; best effort, the session times out on its own regardless.
      await fetch(voiceLeaveUrl(id), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }

  function teardown() {
    const id = lobbyId();

    if (id) {
      registry.release(id);
    }

    if (connected.value) {
      reportSpeaking(false);
    }

    connected.value = false;

    // A borrowed microphone belongs to whatever opened it -- the camera page is
    // still publishing through it -- so leaving the channel must not close it.
    if (!borrowedPipeline) {
      pipeline.stop();
    }

    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    for (const [steamId] of subscriptions) {
      unsubscribe(steamId);
    }

    publishPc?.close();
    publishPc = null;

    participants.value = [];
    lastPublishing.clear();
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

      // Whatever this listener already decided about this teammate -- turned
      // down, or silenced outright -- applies from the first packet.
      peerAudio.apply(steamId, audio);

      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void settings.applyOutput(audio);
        peerAudio.apply(steamId, audio);
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
    lastPublishing.delete(steamId);
  }

  // Who is in the call and who is actually talking both arrive over the socket
  // now, and the API sweeps MediaMTX every 10s for the members who dropped
  // without saying so. This is only here to give a session its opening picture
  // and to recover from a missed push.
  async function poll() {
    const id = lobbyId();

    if (!id || !connected.value) {
      return;
    }

    try {
      const next = await fetchVoiceParticipants(id);

      // Left while the request was in flight: writing here would repopulate a
      // party the session no longer belongs to.
      if (!connected.value || lobbyId() !== id) {
        return;
      }

      participants.value = next;
      reconcileSubscriptions();
    } catch {
      // A failed poll is not a reason to tear the session down.
    }

    if (!connected.value) {
      return;
    }

    pollTimer = setTimeout(poll, 60_000);
  }

  // Subscriptions follow `connected` -- who has a live microphone -- never
  // `speaking`. Speech is a few hundred milliseconds; a peer connection per
  // sentence would be a renegotiation storm and would clip every opening word.
  function reconcileSubscriptions() {
    const now = Date.now();
    const publishing = new Set(
      participants.value
        .filter((participant) => participant.connected)
        .map((participant) => participant.steamId),
    );

    for (const steamId of publishing) {
      lastPublishing.set(steamId, now);

      if (steamId !== mySteamId.value) {
        void subscribe(steamId);
      }
    }

    // Anyone who stopped publishing: drop the peer connection rather than
    // leaving a dead one open for the rest of the session. Held briefly, so a
    // single unanswered MediaMTX poll doesn't renegotiate the whole party.
    for (const [steamId] of subscriptions) {
      if (publishing.has(steamId)) {
        continue;
      }

      if (now - (lastPublishing.get(steamId) ?? 0) < SUBSCRIPTION_GRACE_MS) {
        continue;
      }

      unsubscribe(steamId);
    }
  }

  // Nobody else can see our gate, so we say. The API fans this out to the rest
  // of the channel and expires it if we stop saying anything.
  function reportSpeaking(speaking: boolean) {
    const id = lobbyId();

    if (!id || !connected.value) {
      return;
    }

    speakingReported = speaking;

    socket.event("voice:speaking", { channelId: id, speaking });
  }

  watch(
    () => pipeline.transmitting.value,
    (speaking) => {
      if (speaking !== speakingReported) {
        reportSpeaking(speaking);
      }
    },
  );

  // The hub's sliders write to a store shared by every surface, so the element
  // each teammate is played through follows them without a renegotiation.
  watch(
    peerAudio.peers,
    () => {
      for (const [steamId, subscription] of subscriptions) {
        peerAudio.apply(steamId, subscription.audio);
      }
    },
    { deep: true },
  );

  // The flag expires server-side so a dead client stops looking live; while we
  // really are talking, keep it alive.
  const speakingKeepAlive = setInterval(() => {
    if (connected.value && pipeline.transmitting.value) {
      reportSpeaking(true);
    }
  }, 8_000);

  const listeners = [
    socket.listen(
      "voice:participants",
      (data: { channelId: string; participants: Array<VoiceParticipant> }) => {
        if (data?.channelId !== lobbyId() || !connected.value) {
          return;
        }

        participants.value = data.participants ?? [];
        reconcileSubscriptions();
      },
    ),
    socket.listen(
      "voice:speaking",
      (data: { channelId: string; steamId: string; speaking: boolean }) => {
        if (data?.channelId !== lobbyId()) {
          return;
        }

        participants.value = participants.value.map((participant) =>
          participant.steamId === data.steamId
            ? { ...participant, speaking: data.speaking }
            : participant,
        );
      },
    ),
  ];

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
    clearInterval(speakingKeepAlive);

    for (const listener of listeners) {
      listener.stop();
    }

    teardown();
  });

  // The voice session currently held somewhere else in the app, if any. Joining
  // here would take the microphone from it, so the UI warns before it does.
  const conflict = computed(() => {
    const id = lobbyId();

    return id ? registry.conflictWith(id) : null;
  });

  // Returns whatever it disconnected, so the caller can name it in a toast.
  async function joinSwitching() {
    const id = lobbyId();

    if (!id) {
      return null;
    }

    const displaced = await registry.leaveActiveUnless(id);
    await join();

    return displaced;
  }

  return {
    pipeline,
    conflict,
    joinSwitching,
    connected,
    connecting,
    muted: pipeline.muted,
    error,
    errorDetail,
    unsupported: settings.unsupported,
    participants,
    transmitting: pipeline.transmitting,
    previewing,
    join,
    leave,
    toggleMute: pipeline.toggleMute,
    startPreview,
    stopPreview,
    setMetering: pipeline.setMetering,
  };
}

export type VoiceChat = ReturnType<typeof useVoiceChat>;
