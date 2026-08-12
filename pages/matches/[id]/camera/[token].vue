<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { Button } from "~/components/ui/button";
import {
  LucideLoader2,
  LucideRefreshCw,
  LucideSwitchCamera,
  LucideVideo,
} from "lucide-vue-next";
import {
  cameraPlayerPublishUrl,
  cameraPlayerTalkUrl,
  fetchCameraTalkStatus,
  hangupPlayerTalk,
  negotiateWebRtc,
} from "~/composables/useCameraApi";

definePageMeta({
  layout: false,
});

const route = useRoute();
const token = computed(() => String(route.params.token));

const phase = ref<"idle" | "connecting" | "connected" | "error">("idle");
const errorMessage = ref<string | null>(null);
const previewEl = ref<HTMLVideoElement | null>(null);
const talkEl = ref<HTMLVideoElement | null>(null);
const talking = ref(false);

let stream: MediaStream | null = null;
let publishPc: RTCPeerConnection | null = null;
let talkPc: RTCPeerConnection | null = null;
let facingMode: "user" | "environment" = "user";

function iceServers(): Array<RTCIceServer> {
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

// Asking for a resolution that matches the device's current orientation is
// what keeps a phone from publishing a sideways, letterboxed frame.
function videoConstraints(mode: "user" | "environment"): MediaTrackConstraints {
  const portrait =
    typeof window !== "undefined" &&
    window.matchMedia("(orientation: portrait)").matches;

  return {
    facingMode: { ideal: mode },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
  };
}

async function connect() {
  phase.value = "connecting";
  errorMessage.value = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(facingMode),
      audio: true,
    });

    if (previewEl.value) {
      previewEl.value.srcObject = stream;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    publishPc = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    await negotiateWebRtc(pc, cameraPlayerPublishUrl(token.value));

    phase.value = "connected";
    // Only start watching for a call now: getUserMedia above was the user
    // gesture that lets the incoming stream play with audio.
    pollTalk();
  } catch (error) {
    phase.value = "error";
    errorMessage.value =
      error instanceof Error ? error.message : String(error);
  }
}

async function flipCamera() {
  const next = facingMode === "user" ? "environment" : "user";

  try {
    const replacement = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(next),
      audio: true,
    });

    const [videoTrack] = replacement.getVideoTracks();
    const sender = publishPc
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === "video");

    await sender?.replaceTrack(videoTrack);

    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }

    stream = replacement;
    facingMode = next;

    if (previewEl.value) {
      previewEl.value.srcObject = replacement;
    }
  } catch {
    // Keep the existing stream if the other camera is unavailable.
  }
}

let talkTimer: ReturnType<typeof setTimeout> | null = null;

async function pollTalk() {
  const { ready } = await fetchCameraTalkStatus(token.value);

  if (ready && !talking.value) {
    await joinTalk();
  } else if (!ready && talking.value) {
    endTalk();
  }

  talkTimer = setTimeout(pollTalk, 2000);
}

async function joinTalk() {
  try {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    talkPc = pc;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      if (talkEl.value) {
        talkEl.value.srcObject = event.streams[0];
      }
    };

    await negotiateWebRtc(pc, cameraPlayerTalkUrl(token.value));
    talking.value = true;
  } catch {
    endTalk();
  }
}

function endTalk() {
  talking.value = false;
  talkPc?.close();
  talkPc = null;

  if (talkEl.value) {
    talkEl.value.srcObject = null;
  }
}

onBeforeUnmount(() => {
  if (talkTimer) {
    clearTimeout(talkTimer);
  }

  endTalk();
  void hangupPlayerTalk(token.value);
  publishPc?.close();

  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center"
  >
    <template v-if="phase === 'idle'">
      <h1 class="text-lg font-semibold">{{ $t("camera.title") }}</h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        {{ $t("camera.subtitle") }}
      </p>
      <Button @click="connect">
        <LucideVideo class="mr-2 h-4 w-4" />
        {{ $t("camera.connect") }}
      </Button>
    </template>

    <template v-else-if="phase === 'connecting'">
      <LucideLoader2 class="h-6 w-6 animate-spin text-muted-foreground" />
      <p class="text-sm text-muted-foreground">{{ $t("camera.connecting") }}</p>
    </template>

    <template v-else-if="phase === 'error'">
      <h1 class="text-lg font-semibold">{{ $t("camera.error") }}</h1>
      <p class="max-w-sm break-words text-xs text-muted-foreground">
        {{ errorMessage }}
      </p>
      <Button variant="secondary" @click="connect">
        <LucideRefreshCw class="mr-2 h-4 w-4" />
        {{ $t("camera.retry") }}
      </Button>
    </template>

    <template v-else>
      <p class="text-sm font-medium text-emerald-500">
        {{ $t("camera.connected") }}
      </p>
      <p class="text-xs text-muted-foreground">{{ $t("camera.keep_open") }}</p>
    </template>

    <!-- No object-cover and no forced aspect ratio: either one crops a frame
         whose real ratio does not match the box. -->
    <video
      v-show="phase === 'connected'"
      ref="previewEl"
      class="w-full max-w-md rounded-lg bg-black"
      autoplay
      playsinline
      muted
    ></video>

    <video
      v-show="talking"
      ref="talkEl"
      class="w-full max-w-md rounded-lg bg-black"
      autoplay
      playsinline
    ></video>

    <Button
      v-if="phase === 'connected'"
      variant="ghost"
      size="sm"
      @click="flipCamera"
    >
      <LucideSwitchCamera class="mr-2 h-3.5 w-3.5" />
      {{ $t("camera.flip") }}
    </Button>
  </div>
</template>
