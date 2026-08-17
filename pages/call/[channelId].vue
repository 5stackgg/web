<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  LucideMic,
  LucideMicOff,
  LucidePhoneOff,
  LucideSwitchCamera,
  LucideVideo,
  LucideVideoOff,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import CameraStage from "~/components/camera/CameraStage.vue";
import CameraMediaOverlay from "~/components/camera/CameraMediaOverlay.vue";
import { useCameraPipeline } from "~/composables/useCameraPipeline";
import { useCameraPublisher } from "~/composables/useCameraPublisher";
import { useMicPipeline } from "~/composables/useMicPipeline";
import { describeMicError } from "~/composables/useAudioSettings";
import {
  fetchVoiceParticipants,
  voiceCamPublishUrl,
  voiceCamStopUrl,
  voiceMicStopUrl,
  voicePublishUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import socket from "~/web-sockets/Socket";

// Your phone, used as the camera -- and optionally the microphone -- for a call
// you are already in on another device. Reached by scanning the QR in the call
// panel, which carries nothing but this URL. The phone signs in to 5Stack like
// anything else; the QR is a convenience for typing a link, never a credential.
// Every request below is the ordinary session-gated one, so a stolen screenshot
// of the code is worth nothing without the account behind it.
//
// Camera and microphone are separate publishes to separate MediaMTX paths, and
// separate choices here, because they are separate on the server too. Taking the
// microphone is the one with a consequence: a path holds exactly one publisher,
// so claiming voice-<channel>-<steamid> does not sit alongside the PC's
// microphone, it replaces it. The PC notices, says so, and takes it back when
// this page lets go.
definePageMeta({
  layout: false,
});

const route = useRoute();
const channelId = computed(() => String(route.params.channelId));

const stageRef = ref<InstanceType<typeof CameraStage> | null>(null);
const participants = ref<Array<VoiceParticipant>>([]);
const membershipError = ref(false);
const micError = ref<string | null>(null);

const camera = useCameraPipeline({
  onTrack: (track) => {
    // While cropping, the canvas is the published surface and this is only the
    // source it draws from -- swapping the sender would publish the raw camera
    // and throw the player's framing away.
    if (stageRef.value?.isCropping()) {
      return;
    }

    void publisher.replaceVideo(track);
  },
});
const publisher = useCameraPublisher();

// The same WHIP leg, pointed at the audio path. Named for the camera because
// that is what it was written for, but nothing in it is video-specific -- it
// offers, waits for ICE rather than trusting the answer, and reports a feed that
// drops. All three matter more for the microphone than they do for the camera.
const micPublisher = useCameraPublisher();
const mic = useMicPipeline({
  onTrack: (track) => {
    void micPublisher.replaceAudio(track);
  },
});

const { phase, errorMessage } = publisher;
const { canFlip, pending, errorKind } = camera;

const live = computed(() => phase.value === "connected");
const micLive = computed(() => micPublisher.phase.value === "connected");
const micConnecting = computed(() => micPublisher.phase.value === "connecting");

const others = computed(() =>
  participants.value.filter(
    (participant) => participant.steamId !== useAuthStore().me?.steam_id,
  ),
);

// Rostered is not the same as present. The publish endpoints authorise anyone on
// the lineup or in the lobby, which is what let this page take a camera path for
// a player who had not joined the call on any device: the panel had nothing to
// show it next to, and the two ends disagreed about what was happening.
//
// The call is somewhere the player has to already be. Being here is how they
// move it to this device, not how they enter it.
const inTheCall = computed(() =>
  participants.value.some(
    (participant) =>
      participant.steamId === useAuthStore().me?.steam_id &&
      participant.connected,
  ),
);

// Anything that publishes is gated on it, so neither half can be claimed for a
// call nobody is in.
const canPublish = computed(() => !membershipError.value && inTheCall.value);

// Local only -- nothing leaves the phone until they press share. Opened on
// arrival so there is a picture to frame yourself against while deciding,
// rather than a black rectangle and a button that has to be trusted.
async function startPreview() {
  if (!(await camera.start())) {
    return false;
  }

  await stageRef.value?.adopt();

  return true;
}

async function share() {
  if (!canPublish.value) {
    return;
  }

  if (!camera.stream() && !(await startPreview())) {
    return;
  }

  // The framing they left the preview on is what goes live, cropped exactly as
  // it looks -- not the raw sensor behind it.
  const track = stageRef.value?.croppedTrack() ?? camera.track();

  if (!track) {
    return;
  }

  if (
    await publisher.connect(
      voiceCamPublishUrl(channelId.value, true),
      { video: track, audio: null },
      "include",
    )
  ) {
    claim("cam", true);
  }
}

// Takes the microphone path off whatever device is holding it -- in practice the
// PC the player is sitting at, which finds out from its own peer connection
// closing and stops fighting for it.
async function takeMic() {
  if (!canPublish.value) {
    return;
  }

  if (!mic.live.value && !(await startMic())) {
    return;
  }

  const track = mic.track();

  if (!track) {
    return;
  }

  if (
    await micPublisher.connect(
      voicePublishUrl(channelId.value, true),
      { video: null, audio: track },
      "include",
    )
  ) {
    claim("mic", true);
  }
}

async function startMic() {
  try {
    await mic.start();
    micError.value = null;
    return true;
  } catch (caught) {
    // An i18n key and the raw line behind it; only the key is shown here, the
    // screen has no room for a stack and the four kinds it distinguishes are
    // the four a player can actually do something about.
    micError.value = describeMicError(caught).key;
    return false;
  }
}

// Closing the publish is the whole handoff: the path goes idle, and the PC's
// resume takes it back within a few seconds. The capture is released too --
// unlike the camera preview there is nothing to look at, and leaving a phone
// microphone open after the player handed it back is its own surprise.
async function releaseMic() {
  micPublisher.close();
  mic.stop();
  reportSpeaking(false);
  claim("mic", false);

  await fetch(voiceMicStopUrl(channelId.value), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

// Tells this player's other devices which half this phone is carrying. The PC
// cannot work it out for itself: MediaMTX kicks the publisher it displaced
// without telling it, so the panel would go on claiming the microphone was still
// there until ICE consent freshness gave up half a minute later.
function claim(kind: "mic" | "cam", claimed: boolean) {
  socket.event("voice:device-claim", {
    channelId: channelId.value,
    kind,
    claimed,
  });
}

// Gives both halves back at once, for the button that ends this phone's part in
// the call rather than one stream of it.
async function handBack() {
  await Promise.all([releaseMic(), stopSharing()]);
}

// Only meaningful while this device is the one publishing. The gate lives in the
// same pipeline a PC uses, so what the rest of the channel sees is the same
// measurement made the same way.
function reportSpeaking(speaking: boolean) {
  if (speaking && !micLive.value) {
    return;
  }

  socket.event("voice:speaking", {
    channelId: channelId.value,
    speaking,
  });
}

watch(() => mic.transmitting.value, reportSpeaking);

// The server expires a speaking flag on its own so a client that dies mid-word
// does not leave someone lit up forever; this is what keeps it lit while they
// are genuinely still talking.
const speakingKeepAlive = setInterval(() => {
  if (micLive.value && mic.transmitting.value) {
    reportSpeaking(true);
  }
}, 8_000);

// Stops the publish, not the camera. The preview is what this page is when it
// is not sharing, and dropping back to black would leave no way to check the
// framing before going again. The camera itself is released on unmount.
async function stopSharing() {
  publisher.close();
  claim("cam", false);

  await fetch(voiceCamStopUrl(channelId.value), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

async function flip() {
  if (await camera.flip()) {
    await stageRef.value?.adopt();
  }
}

// Doubles as the membership check: the same gate the publish endpoint uses, so
// a channel you are not in says so before the camera is ever opened.
let poll: ReturnType<typeof setTimeout> | null = null;

async function refresh() {
  try {
    participants.value = await fetchVoiceParticipants(channelId.value);
    membershipError.value = false;
  } catch {
    membershipError.value = true;
  }

  poll = setTimeout(refresh, 5000);
}

const { t } = useI18n();

// One line, and only ever the most urgent one. A phone screen has room for a
// sentence, not a status panel, and the ranking is the point: a player who is
// not in the call cannot act on an echo warning.
const statusLine = computed(() => {
  if (membershipError.value) {
    return t("voice.call.phone.not_a_member");
  }

  if (!inTheCall.value) {
    return t("voice.call.phone.not_in_call");
  }

  if (micError.value) {
    return t(micError.value);
  }

  if (phase.value === "error" && errorMessage.value) {
    return errorMessage.value;
  }

  // Echo cancellation runs against the output of the device doing the
  // capturing, so a phone microphone has no reference for what the PC is
  // playing: on speakers it sends the call straight back and nothing on either
  // end can subtract it.
  if (micLive.value) {
    return t("voice.call.phone.mic_echo_hint");
  }

  return t("camera.reframe_gesture");
});

const statusTone = computed(() => {
  if (membershipError.value || micError.value || phase.value === "error") {
    return "text-destructive";
  }

  if (!inTheCall.value) {
    return "text-[hsl(var(--tac-amber))]";
  }

  if (micLive.value) {
    return "text-[hsl(var(--tac-amber))]";
  }

  return "font-mono text-[0.55rem] uppercase tracking-[0.18em] text-white/50";
});

const IDLE_TONE =
  "border-white/20 bg-black/50 text-white/80 hover:border-white/40";
const ACTIVE_TONE =
  "border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]";
const DANGER_TONE = "border-destructive/60 bg-destructive/20 text-destructive";

// Built as data rather than four hand-written buttons: they share a shape, and
// what actually differs between them is three strings and a handler.
const controls = computed(() => {
  const anythingTaken = live.value || micLive.value;

  return [
    {
      key: "flip",
      icon: LucideSwitchCamera,
      label: t("voice.call.phone.flip"),
      tone: IDLE_TONE,
      disabled: !canFlip.value,
      action: flip,
    },
    {
      key: "mic",
      // Take it first, then it is a mute key -- the same key a PC has, because
      // once the microphone is here this is the device you reach for to stop
      // talking. Handing it back is the hang-up key's job, not this one's.
      icon: micLive.value
        ? mic.muted.value
          ? LucideMicOff
          : LucideMic
        : LucideMic,
      label: micLive.value
        ? mic.muted.value
          ? t("voice.tooltip.unmute")
          : t("voice.tooltip.mute")
        : t("voice.call.phone.take_mic_short"),
      tone: micLive.value
        ? mic.muted.value
          ? DANGER_TONE
          : ACTIVE_TONE
        : IDLE_TONE,
      disabled: !canPublish.value || micConnecting.value,
      action: micLive.value ? mic.toggleMute : takeMic,
    },
    {
      key: "camera",
      icon: live.value ? LucideVideo : LucideVideoOff,
      label: live.value
        ? t("voice.call.phone.stop_short")
        : t("voice.call.phone.start_short"),
      tone: live.value ? ACTIVE_TONE : IDLE_TONE,
      disabled: !canPublish.value || !!errorKind.value || pending.value,
      action: live.value ? stopSharing : share,
    },
    {
      key: "hand-back",
      icon: LucidePhoneOff,
      label: t("voice.call.phone.hand_back"),
      tone: DANGER_TONE,
      disabled: !anythingTaken,
      action: handBack,
    },
  ];
});

onMounted(async () => {
  // Membership first: it is the same gate the publish endpoint uses, so asking
  // for the camera before it answers would prompt someone who is about to be
  // told they are not in this call.
  await refresh();

  if (!membershipError.value) {
    void startPreview();
  }
});

onBeforeUnmount(() => {
  if (poll) {
    clearTimeout(poll);
  }

  clearInterval(speakingKeepAlive);

  void releaseMic();
  void stopSharing();
  camera.stop();
});
</script>

<template>
  <!-- The video is the screen. Everything else floats on it behind a scrim,
       because on a phone held at arm's length a control that steals a third of
       the frame is a control that stops you seeing whether you are in it. -->
  <div
    class="relative h-[100dvh] w-full overflow-hidden bg-black text-foreground"
  >
    <CameraStage
      ref="stageRef"
      bleed
      class="absolute inset-0 h-full"
      :pipeline="camera"
      :preview-visible="true"
      :interactive="!errorKind && !pending"
      @output-track="publisher.replaceVideo"
    >
      <template #overlay>
        <CameraMediaOverlay
          :pending="pending"
          :error-kind="errorKind"
          @retry="startPreview"
        />
      </template>
    </CameraStage>

    <!-- Only the thing that is not already on screen. What this phone is
         carrying is said by the tone of the keys below it, and a pill repeating
         it over the picture was two labels for one fact. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <span
        class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-white/60"
      >
        {{ $t("voice.call.phone.in_call", { count: others.length }) }}
      </span>
    </div>

    <!-- Controls, bottom. One bar, always in the same place, so the thing that
         changes between states is what the buttons say rather than where they
         are. -->
    <div
      class="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-14"
    >
      <!-- Height reserved for the longest of these, so a line wrapping to two
           does not shove the control row up under the player's thumb between
           one press and the next. -->
      <p
        class="mb-3 flex min-h-[2.25rem] items-center justify-center text-balance text-center text-[11px] leading-snug"
        :class="statusTone"
      >
        {{ statusLine }}
      </p>

      <!-- The one big target, and only while it is the thing to do. Once the
           camera is live the bar below says everything and a full-width button
           would just be another way to press the same key. -->
      <Button
        v-if="!live && canPublish"
        class="mb-3 w-full gap-2"
        size="lg"
        variant="tactical"
        :loading="phase === 'connecting'"
        :disabled="!!errorKind || pending"
        @click="share"
      >
        <LucideVideo class="h-4 w-4" />
        {{ $t("voice.call.phone.start") }}
      </Button>

      <div class="flex items-center justify-center gap-6">
        <button
          v-for="control in controls"
          :key="control.key"
          type="button"
          class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-colors disabled:opacity-40"
          :class="control.tone"
          :disabled="control.disabled"
          :aria-label="control.label"
          :title="control.label"
          @click="control.action"
        >
          <component :is="control.icon" class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>
