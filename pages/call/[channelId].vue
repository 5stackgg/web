<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  LucideLoader2,
  LucideSwitchCamera,
  LucideTriangleAlert,
  LucideVideo,
  LucideVideoOff,
  LucideX,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import TopoBackground from "@/layouts/components/TopoBackground.vue";
import { useCameraPipeline } from "~/composables/useCameraPipeline";
import { useCameraPublisher } from "~/composables/useCameraPublisher";
import {
  fetchVoiceParticipants,
  voiceCamPublishUrl,
  voiceCamStopUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";

// Your phone, used as your camera for a call you are already in on another
// device. Reached by scanning the QR in the call panel -- which carries nothing
// but this URL. The phone signs in to 5Stack like anything else; the QR is a
// convenience for typing a link, never a credential. Every request below is the
// ordinary session-gated one, so a stolen screenshot of the code is worth
// nothing without the account behind it.
//
// Deliberately publishes video ONLY. The microphone stays on whatever device
// you are actually playing on: two live mics in one room is an echo, and the
// audio path is already carrying the conversation.
definePageMeta({
  layout: false,
});

const route = useRoute();
const channelId = computed(() => String(route.params.channelId));

const previewEl = ref<HTMLVideoElement | null>(null);
const participants = ref<Array<VoiceParticipant>>([]);
const membershipError = ref(false);

const camera = useCameraPipeline({
  onTrack: (track) => {
    void publisher.replaceVideo(track);
    bindPreview();
  },
});
const publisher = useCameraPublisher();

const { phase, errorMessage } = publisher;
const { canFlip, pending, errorKind } = camera;

const live = computed(() => phase.value === "connected");

const others = computed(() =>
  participants.value.filter(
    (participant) => participant.steamId !== useAuthStore().me?.steam_id,
  ),
);

function bindPreview() {
  const el = previewEl.value;

  if (el && el.srcObject !== camera.stream()) {
    el.srcObject = camera.stream();
    void el.play().catch(() => {});
  }
}

async function start() {
  if (!(await camera.start())) {
    return;
  }

  bindPreview();

  const track = camera.track();

  if (!track) {
    return;
  }

  await publisher.connect(
    voiceCamPublishUrl(channelId.value),
    { video: track, audio: null },
    "include",
  );
}

async function stop() {
  publisher.close();
  camera.stop();

  await fetch(voiceCamStopUrl(channelId.value), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

async function flip() {
  await camera.flip();
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

onMounted(() => {
  void refresh();
});

onBeforeUnmount(() => {
  if (poll) {
    clearTimeout(poll);
  }

  void stop();
});
</script>

<template>
  <TopoBackground />

  <div
    class="relative z-10 flex min-h-screen flex-col gap-3 px-4 py-5 text-foreground"
  >
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.22em]"
        :class="
          live
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : 'border-border bg-background/40 text-muted-foreground'
        "
      >
        <span class="relative flex h-1.5 w-1.5">
          <span
            v-if="live"
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex h-1.5 w-1.5 rounded-full"
            :class="live ? 'bg-emerald-400' : 'bg-muted-foreground/60'"
          ></span>
        </span>
        {{ live ? $t("voice.call.phone.live") : $t("voice.call.phone.idle") }}
      </span>

      <span class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
        {{ $t("voice.call.phone.in_call", { count: others.length }) }}
      </span>
    </div>

    <!-- Portrait, because that is how a phone is held. The preview is mirrored
         so framing yourself behaves the way a mirror does; what everyone else
         sees is the unmirrored feed. -->
    <div
      class="relative w-full flex-1 overflow-hidden rounded-xl border bg-black"
    >
      <video
        ref="previewEl"
        class="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        autoplay
        playsinline
        muted
      ></video>

      <div
        v-if="pending"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center"
      >
        <LucideLoader2 class="h-5 w-5 animate-spin text-[hsl(var(--tac-amber))]" />
        <p class="text-[11px] text-muted-foreground">
          {{ $t("camera.media_pending") }}
        </p>
      </div>

      <div
        v-else-if="errorKind"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center"
      >
        <LucideTriangleAlert class="h-6 w-6 text-destructive" />
        <p class="max-w-xs text-[11px] leading-snug text-muted-foreground">
          {{ $t(`camera.media_error.${errorKind}`) }}
        </p>
      </div>

      <Button
        v-if="canFlip && live"
        variant="secondary"
        size="icon"
        class="absolute right-3 top-3 z-20 h-10 w-10 rounded-full"
        :aria-label="$t('camera.flip')"
        @click="flip"
      >
        <LucideSwitchCamera class="h-4 w-4" />
      </Button>
    </div>

    <p
      v-if="membershipError"
      class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] leading-snug text-destructive"
    >
      {{ $t("voice.call.phone.not_a_member") }}
    </p>

    <p
      v-else-if="phase === 'error' && errorMessage"
      class="break-words text-center font-mono text-[11px] text-destructive"
    >
      {{ errorMessage }}
    </p>

    <p
      v-else
      class="text-center text-[11px] leading-snug text-muted-foreground/70"
    >
      {{ $t("voice.call.phone.hint") }}
    </p>

    <!-- Big targets: this is held one-handed, probably in a hurry, probably
         mid-match. -->
    <Button
      v-if="!live"
      class="w-full gap-2"
      size="lg"
      variant="tactical"
      :loading="phase === 'connecting'"
      :disabled="membershipError || !!errorKind"
      @click="start"
    >
      <LucideVideo class="h-4 w-4" />
      {{ $t("voice.call.phone.start") }}
    </Button>

    <Button
      v-else
      class="w-full gap-2"
      size="lg"
      variant="destructive"
      @click="stop"
    >
      <LucideVideoOff class="h-4 w-4" />
      {{ $t("voice.call.phone.stop") }}
    </Button>
  </div>
</template>
