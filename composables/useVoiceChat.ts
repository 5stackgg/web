import { ref, computed, watch, onScopeDispose } from "vue";
import { useI18n } from "vue-i18n";
import { negotiateWebRtc, SignalingError } from "~/composables/useCameraApi";
import {
  fetchVoiceParticipants,
  voiceCamPublishUrl,
  voiceCamStopUrl,
  voiceCamSubscribeUrl,
  voiceLeaveUrl,
  voicePublishUrl,
  voiceSubscribeUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import {
  useCameraPipeline,
  type CameraErrorKind,
} from "~/composables/useCameraPipeline";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import {
  describeMicError,
  useAudioSettings,
} from "~/composables/useAudioSettings";
import { useMicPipeline, type MicPipeline } from "~/composables/useMicPipeline";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";
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

// Video gets a far shorter hold than audio, because the two fail differently.
// A microphone dropping for a poll and coming back is a gap in a conversation,
// so audio is worth holding fifteen seconds to avoid. A camera held that long
// after it went off leaves the last frame frozen on someone's tile -- they
// turned it off, and everyone else watched a still of them for a quarter of a
// minute. Long enough to ride out one missed poll, short enough to read as
// immediate.
const VIDEO_GRACE_MS = 2_000;

// Lower than the match camera's ceiling, and for a different reason: that is one
// feed watched by an organizer, this is up to five tiles decoded at once on a
// machine that may also be playing a game and rendering a live stream.
const CALL_BITRATE = 300_000;
const CALL_FPS = 20;

export type VoiceChatOptions = {
  // Whether a camera may be offered on *this* surface. The hub renders the call
  // wherever it was joined from and cannot tell a party lobby from a match
  // lineup by its id, so the surface that opened the channel is the thing that
  // knows which per-surface setting applies.
  videoAllowed?: () => boolean;
  // Which sort of channel this is. Only the caller knows, and a tab taking the
  // call over on a handoff needs it to rejoin.
  kind?: () => "lobby" | "match";
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
  const { t } = useI18n();
  const registry = useActiveVoiceChannel();
  const settings = useAudioSettings();
  const peerAudio = useVoicePeerAudio();
  const videoPrefs = useVoiceVideoPrefs();

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

  // The camera half. Everything about it is a second, independent publish: its
  // own peer connection, its own MediaMTX path, its own subscriptions. Turning a
  // camera on or off must never touch the microphone that is carrying the
  // conversation.
  const videoEnabled = ref(false);
  const videoStarting = ref(false);
  let videoPublishPc: RTCPeerConnection | null = null;

  function republishVideo(track: MediaStreamTrack | null) {
    if (!track) {
      return;
    }

    void videoPublishPc
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === "video")
      ?.replaceTrack(track)
      .catch(() => {});
  }

  const camera = useCameraPipeline({ onTrack: republishVideo });

  // Held here rather than in a tile component on purpose: a tile that owned its
  // own peer connection would tear it down and renegotiate every time the grid
  // moved -- into a picture-in-picture window, back out again -- and popping a
  // call out is exactly the thing this has to survive.
  const peerVideo = ref(new Map<string, MediaStream>());
  const videoSubscriptions = new Map<string, RTCPeerConnection>();
  const lastVideo = new Map<string, number>();

  const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

  // Fetched, so a relay can be configured without shipping a web build. Read
  // synchronously here and warmed by `load()` before anything negotiates -- a
  // party joining opens a publish and a subscription per peer in one tick, and
  // awaiting in each of them would be one request per connection.
  const ice = useIceServers();

  function iceServers(): Array<RTCIceServer> {
    return ice.current.value;
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

    const described = describeMicError(caught);
    errorDetail.value = described.detail;

    return described.key;
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

      await ice.load();

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      publishPc = pc;

      pc.addTrack(outgoing, pipeline.stream() as MediaStream);

      await negotiateWebRtc(pc, voicePublishUrl(id), "include");

      connected.value = true;
      registry.register(id, leave);
      registry.claim({ id, label: channelLabel?.() ?? id, kind: options.kind?.() });
      // Published only now: a surface reading the registry -- the right hub --
      // renders the call, and there is no call until the publish is up.
      registry.attach({
        id,
        label: channelLabel?.() ?? id,
        kind: options.kind?.(),
        participants,
        muted: pipeline.muted,
        toggleMute: pipeline.toggleMute,
        leave,
        // Handed over live rather than serialized: this is the tab holding the
        // streams, and it is the only one that can render them.
        video: {
          allowed: videoAllowed,
          enabled: videoEnabled,
          starting: videoStarting,
          peerVideo,
          localVideo: () => camera.stream(),
          toggle: toggleVideo,
        },
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

    for (const [steamId] of videoSubscriptions) {
      unsubscribeVideo(steamId);
    }

    teardownVideoPublish();

    publishPc?.close();
    publishPc = null;

    participants.value = [];
    lastPublishing.clear();
    lastVideo.clear();
  }

  function teardownVideoPublish() {
    videoPublishPc?.close();
    videoPublishPc = null;
    camera.stop();
    videoEnabled.value = false;
  }

  // The camera's own failure kinds, said in the same voice as the microphone's
  // above rather than leaking a DOMException name into the UI.
  function describeCameraError(kind: CameraErrorKind | null) {
    if (kind === "denied") {
      return "voice.errors.camera_denied";
    }

    if (kind === "missing") {
      return "voice.errors.no_camera";
    }

    if (kind === "busy") {
      return "voice.errors.camera_busy";
    }

    return "voice.errors.camera";
  }

  // Opening a camera is always a deliberate act, never a side effect of joining:
  // the call carries a microphone until someone asks for more.
  const videoAllowed = computed(() => options.videoAllowed?.() ?? false);

  async function startVideo() {
    const id = lobbyId();

    if (
      !id ||
      !videoAllowed.value ||
      !connected.value ||
      videoEnabled.value ||
      videoStarting.value
    ) {
      return false;
    }

    videoStarting.value = true;

    try {
      if (!(await camera.start())) {
        error.value = describeCameraError(camera.errorKind.value);
        errorDetail.value = null;
        return false;
      }

      const track = camera.track();

      if (!track) {
        camera.stop();
        return false;
      }

      await ice.load();

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      videoPublishPc = pc;
      pc.addTrack(track, camera.stream() as MediaStream);

      await negotiateWebRtc(pc, voiceCamPublishUrl(id), "include");
      await capVideoEncoder(pc);

      videoEnabled.value = true;
      // Anyone already on camera is pulled now rather than on the next push --
      // otherwise turning yours on shows an empty grid for up to a poll.
      reconcileSubscriptions();

      return true;
    } catch (caught) {
      error.value = describeError(caught);
      teardownVideoPublish();
      return false;
    } finally {
      videoStarting.value = false;
    }
  }

  async function stopVideo() {
    const id = lobbyId();
    const wasPublishing = !!videoPublishPc;

    teardownVideoPublish();

    // Drops the path rather than waiting for MediaMTX to notice, so everyone
    // else's tile clears now instead of on the next monitor pass.
    if (id && wasPublishing) {
      await fetch(voiceCamStopUrl(id), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }

  function toggleVideo() {
    return videoEnabled.value ? stopVideo() : startVideo();
  }

  // The same ceiling the camera page puts on its own feed: constraints are a
  // request to the camera, this is a cap on the encoder, which is where the CPU
  // actually goes on a machine that is also running a game.
  async function capVideoEncoder(pc: RTCPeerConnection) {
    const sender = pc
      .getSenders()
      .find((candidate) => candidate.track?.kind === "video");

    if (!sender) {
      return;
    }

    try {
      const parameters = sender.getParameters();

      parameters.encodings = parameters.encodings?.length
        ? parameters.encodings
        : [{}];

      for (const encoding of parameters.encodings) {
        encoding.maxBitrate = CALL_BITRATE;
        encoding.maxFramerate = CALL_FPS;
      }

      await sender.setParameters(parameters);
    } catch {
      // Older engines reject parts of setParameters; the tile is fine without it.
    }
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

  // Pulled whenever a peer has a camera on, whether or not we have one of our
  // own. Gating this on publishing first meant the person who turned their
  // camera on was invisible to everybody who had not -- which is every new
  // joiner, and so very nearly everybody.
  async function subscribeVideo(steamId: string) {
    const id = lobbyId();

    if (
      !id ||
      !connected.value ||
      videoSubscriptions.has(steamId) ||
      steamId === mySteamId.value
    ) {
      return;
    }

    try {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });

      videoSubscriptions.set(steamId, pc);

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.ontrack = (event) => {
        const [stream] = event.streams;

        if (!stream) {
          return;
        }

        // Replaced wholesale rather than mutated: a Map written in place is not
        // a change Vue can see, and the tiles are bound to this.
        peerVideo.value = new Map(peerVideo.value).set(steamId, stream);
      };

      await negotiateWebRtc(pc, voiceCamSubscribeUrl(id, steamId), "include");
    } catch {
      unsubscribeVideo(steamId);
    }
  }

  function unsubscribeVideo(steamId: string) {
    const pc = videoSubscriptions.get(steamId);

    if (!pc) {
      return;
    }

    pc.close();
    videoSubscriptions.delete(steamId);
    lastVideo.delete(steamId);

    if (peerVideo.value.has(steamId)) {
      const next = new Map(peerVideo.value);
      next.delete(steamId);
      peerVideo.value = next;
    }
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

    reconcileVideoSubscriptions(now);
  }

  // The same shape as the audio reconcile above, on the `video` flag instead of
  // `connected`. Being in the channel is the whole entitlement -- having a
  // camera of your own was never what made someone else's yours to see.
  function reconcileVideoSubscriptions(now: number) {
    // Hidden peers are dropped here rather than only in the tile: a camera you
    // have chosen not to look at should stop costing bandwidth and decode, not
    // just screen space.
    const onCamera = new Set(
      connected.value
        ? participants.value
            .filter(
              (participant) =>
                participant.video && !videoPrefs.isHidden(participant.steamId),
            )
            .map((participant) => participant.steamId)
        : [],
    );

    for (const steamId of onCamera) {
      lastVideo.set(steamId, now);

      if (steamId !== mySteamId.value) {
        void subscribeVideo(steamId);
      }
    }

    for (const [steamId] of videoSubscriptions) {
      if (onCamera.has(steamId)) {
        continue;
      }

      // Held, but only just: one unanswered MediaMTX poll must not tear every
      // tile down and renegotiate them a poll later.
      if (
        connected.value &&
        now - (lastVideo.get(steamId) ?? 0) < VIDEO_GRACE_MS
      ) {
        continue;
      }

      unsubscribeVideo(steamId);
    }
  }

  // Announcing a camera going on lives in useVoiceAnnouncements now: it has to
  // reach people who are *not* in the call, which this composable by definition
  // cannot see -- participants only arrive once you are in the channel.

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
    camera,
    videoAllowed,
    videoEnabled,
    videoStarting,
    peerVideo,
    localVideo: () => camera.stream(),
    startVideo,
    stopVideo,
    toggleVideo,
  };
}

export type VoiceChat = ReturnType<typeof useVoiceChat>;
