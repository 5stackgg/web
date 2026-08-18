import { ref, onScopeDispose } from "vue";
import { negotiateWebRtc } from "~/composables/useCameraApi";
import { useIceServers } from "~/composables/useIceServers";
import {
  CAPTURE_BITRATE,
  CAPTURE_FPS,
} from "~/composables/useCameraPipeline";

// The WHIP leg: one peer connection publishing a camera and a microphone to
// MediaMTX. Tracks are swapped in place rather than renegotiated, so changing
// camera, or dropping into and out of a crop, never drops the feed for a beat.

export type CameraPublishPhase =
  | "preview"
  | "connecting"
  | "connected"
  | "error";

// How long to wait for ICE after the answer is applied. Long enough for a relay
// candidate over a slow mobile network, short enough that a player staring at a
// spinner finds out it failed rather than assuming they are live.
const ICE_TIMEOUT = 20_000;

// Carries an i18n key instead of an English sentence, so the failure can cross
// the reject boundary without becoming untranslatable text.
class CameraPublishError extends Error {
  constructor(
    readonly key: string,
    readonly detail: string | null = null,
  ) {
    super(key);
  }
}

export function useCameraPublisher() {
  const phase = ref<CameraPublishPhase>("preview");
  // `errorMessage` is an i18n key, `errorDetail` the raw technical line -- same
  // split useVoiceChat/useAudioSettings use, so the UI never renders untranslated
  // browser text.
  const errorMessage = ref<string | null>(null);
  const errorDetail = ref<string | null>(null);

  let publishPc: RTCPeerConnection | null = null;

  const ice = useIceServers();

  // Safari only grew RTCPeerConnection.connectionState in 15.4, and the phones
  // this page is aimed at are exactly where an older engine turns up.
  function connectionState(pc: RTCPeerConnection) {
    return pc.connectionState ?? pc.iceConnectionState;
  }

  // The SDP answer only says MediaMTX accepted the offer. It is not proof that
  // any media can flow -- with UDP blocked and no TURN relay to fall back on,
  // ICE fails a moment later and nothing ever arrives. Waiting for it here is
  // what stops the page reporting a live feed that does not exist.
  function waitForIce(pc: RTCPeerConnection) {
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;

      const stop = () => {
        clearTimeout(timer);
        pc.removeEventListener("connectionstatechange", settle);
        pc.removeEventListener("iceconnectionstatechange", settle);
      };

      function settle() {
        const state = connectionState(pc);

        // "completed" is iceConnectionState's version of connected, and the only
        // state an older Safari settles on once it stops gathering.
        if (state === "connected" || state === "completed") {
          stop();
          resolve();
          return;
        }

        if (state === "failed" || state === "closed") {
          stop();
          reject(
            new CameraPublishError(
              "camera.errors.no_media_path",
              `ice ${state}`,
            ),
          );
        }
      }

      timer = setTimeout(() => {
        stop();
        reject(
          new CameraPublishError(
            "camera.errors.ice_timeout",
            `ice timed out after ${ICE_TIMEOUT / 1000}s`,
          ),
        );
      }, ICE_TIMEOUT);

      pc.addEventListener("connectionstatechange", settle);
      pc.addEventListener("iceconnectionstatechange", settle);
      settle();
    });
  }

  // A feed that drops mid-match is the case this whole page exists to catch, so
  // it has to leave the "live" state on its own rather than waiting for someone
  // to notice the tile went dark. Only terminal states: "disconnected" is
  // routinely transient and recovers without anything being done about it.
  function watchForDrop(pc: RTCPeerConnection) {
    const onChange = () => {
      if (publishPc !== pc) {
        return;
      }

      const state = connectionState(pc);

      if (state === "failed" || state === "closed") {
        phase.value = "error";
        errorMessage.value = "camera.errors.feed_dropped";
        errorDetail.value = `ice ${state}`;
      }
    };

    pc.addEventListener("connectionstatechange", onChange);
    pc.addEventListener("iceconnectionstatechange", onChange);
  }

  function senderFor(kind: "video" | "audio") {
    return (
      publishPc
        ?.getSenders()
        .find((candidate) => candidate.track?.kind === kind) ?? null
    );
  }

  // Constraints are a request to the camera; this is a ceiling on the encoder,
  // which is where the CPU actually goes. Without it a machine with headroom
  // happily spends it -- on a player who is trying to run a game at the same
  // time. Resolution is held in preference to smoothness: the point of the feed
  // is seeing the player, not fluid motion.
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
        encoding.maxBitrate = CAPTURE_BITRATE;
        encoding.maxFramerate = CAPTURE_FPS;
      }

      (
        parameters as RTCRtpSendParameters & { degradationPreference?: string }
      ).degradationPreference = "maintain-resolution";

      await sender.setParameters(parameters);
    } catch {
      // Older engines reject parts of setParameters; the feed is fine without it.
    }
  }

  async function connect(
    url: string,
    tracks: {
      video: MediaStreamTrack | null;
      audio: MediaStreamTrack | null;
    },
    credentials?: RequestCredentials,
  ) {
    phase.value = "connecting";
    errorMessage.value = null;
    errorDetail.value = null;

    try {
      const pc = new RTCPeerConnection({ iceServers: await ice.load() });
      publishPc = pc;

      const published = new MediaStream(
        [tracks.video, tracks.audio].filter(
          (track): track is MediaStreamTrack => !!track,
        ),
      );

      for (const track of published.getTracks()) {
        pc.addTrack(track, published);
      }

      await negotiateWebRtc(pc, url, credentials);
      await capVideoEncoder(pc);
      await waitForIce(pc);

      watchForDrop(pc);
      phase.value = "connected";

      return true;
    } catch (error) {
      // Nothing is publishing, so the peer connection is only holding the
      // camera's encoder open -- and a stale one left behind is what makes the
      // retry after a failure fail the same way.
      close();

      phase.value = "error";
      if (error instanceof CameraPublishError) {
        errorMessage.value = error.key;
        errorDetail.value = error.detail;
      } else {
        errorMessage.value = "camera.errors.unknown";
        errorDetail.value =
          error instanceof Error ? error.message : String(error);
      }

      return false;
    }
  }

  async function replaceVideo(track: MediaStreamTrack | null) {
    await senderFor("video")
      ?.replaceTrack(track)
      .catch(() => {});
  }

  async function replaceAudio(track: MediaStreamTrack | null) {
    await senderFor("audio")
      ?.replaceTrack(track)
      .catch(() => {});
  }

  // Back to preview, not to nothing: this is what a consumer with a stop button
  // calls, and leaving the phase on "connected" left the pill still reporting a
  // live feed after the publish it named had been torn down.
  //
  // Cleared before the close so watchForDrop's own handler sees a peer
  // connection that is no longer the current one and stays quiet -- a
  // deliberate stop is not a dropped feed.
  function close() {
    const pc = publishPc;

    publishPc = null;
    pc?.close();

    phase.value = "preview";
    errorMessage.value = null;
    errorDetail.value = null;
  }

  onScopeDispose(close);

  return {
    phase,
    errorMessage,
    errorDetail,
    connect,
    replaceVideo,
    replaceAudio,
    close,
    live: () => !!publishPc,
  };
}

export type CameraPublisher = ReturnType<typeof useCameraPublisher>;
