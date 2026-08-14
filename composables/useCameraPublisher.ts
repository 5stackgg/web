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

export function useCameraPublisher() {
  const phase = ref<CameraPublishPhase>("preview");
  const errorMessage = ref<string | null>(null);

  let publishPc: RTCPeerConnection | null = null;

  const ice = useIceServers();

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

      phase.value = "connected";

      return true;
    } catch (error) {
      phase.value = "error";
      errorMessage.value =
        error instanceof Error ? error.message : String(error);

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

  function close() {
    publishPc?.close();
    publishPc = null;
  }

  onScopeDispose(close);

  return {
    phase,
    errorMessage,
    connect,
    replaceVideo,
    replaceAudio,
    close,
    live: () => !!publishPc,
  };
}

export type CameraPublisher = ReturnType<typeof useCameraPublisher>;
