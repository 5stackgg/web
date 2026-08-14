<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import {
  LucideVideoOff,
  LucideVolume2,
  LucideVolumeX,
} from "lucide-vue-next";
import { cameraAdminWatchUrl } from "~/composables/useCameraApi";

withDefaults(
  defineProps<{
    matchId: string;
    steamId: string;
    state: "live" | "stalled" | "offline" | "talking";
    unmuted?: boolean;
    dense?: boolean;
    scrim?: boolean;
    // Slot hosts put this inside their own click target, so the feed must not
    // eat the click and must not offer a focusable control of its own.
    clickThrough?: boolean;
  }>(),
  {
    unmuted: false,
    dense: false,
    scrim: false,
    clickThrough: false,
  },
);

const emit = defineEmits<{ (e: "update:unmuted", value: boolean): void }>();

// Each tile is a peer connection and a video decode, and the surfaces that use
// them mount a lot at once -- a stream deck showing three live matches is
// thirty. Only the tiles actually on screen stream; the rest cost nothing until
// they are scrolled to.
const rootEl = ref<HTMLElement | null>(null);
const onScreen = ref(false);
// Held briefly so a scroll that passes over a tile, or a layout shift, doesn't
// drop a connection that is about to be wanted again.
const OFFSCREEN_GRACE_MS = 5_000;

let observer: IntersectionObserver | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

function clearLeaveTimer() {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === "undefined" || !rootEl.value) {
    onScreen.value = true;
    return;
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) {
        return;
      }

      if (entry.isIntersecting) {
        clearLeaveTimer();
        onScreen.value = true;
        return;
      }

      if (!onScreen.value || leaveTimer) {
        return;
      }

      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        onScreen.value = false;
      }, OFFSCREEN_GRACE_MS);
    },
    // Started a little before it is scrolled into view, so the first frame is
    // already there by the time the tile is.
    { rootMargin: "200px" },
  );

  observer.observe(rootEl.value);
});

onBeforeUnmount(() => {
  clearLeaveTimer();
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <div ref="rootEl" class="relative h-full w-full overflow-hidden bg-black">
    <!-- `audio` follows the listen toggle rather than staying on and being
         muted at the element: a wall of tiles otherwise decodes every player's
         microphone continuously so that nobody can hear any of them. Flipping
         it reconnects this one tile. -->
    <WhepPlayer
      v-if="state !== 'offline' && onScreen"
      :key="steamId"
      :whep-url="cameraAdminWatchUrl(matchId, steamId)"
      :muted="!unmuted"
      :audio="unmuted"
      disable-shortcuts
      cover
      :class="[
        'absolute inset-0',
        clickThrough ? 'pointer-events-none' : '',
      ]"
    />

    <!-- Only a genuinely offline camera gets the hatched panel; a tile that is
         merely scrolled out of view stays black until it comes back. -->
    <div
      v-else-if="state === 'offline'"
      class="flex h-full w-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,hsl(var(--muted)/0.25)_0,hsl(var(--muted)/0.25)_1px,transparent_1px,transparent_7px)]"
    >
      <LucideVideoOff class="h-5 w-5 text-muted-foreground/50" />
      <span
        v-if="!dense"
        class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/60"
      >
        {{ $t("camera.offline") }}
      </span>
    </div>

    <div
      v-if="scrim && state !== 'offline'"
      class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/35"
    ></div>

    <span
      v-if="state !== 'offline'"
      role="button"
      :tabindex="clickThrough ? undefined : 0"
      :aria-label="unmuted ? $t('camera.mute') : $t('camera.listen')"
      :title="unmuted ? $t('camera.mute') : $t('camera.listen')"
      class="pointer-events-auto absolute top-1 right-1 z-20 inline-flex cursor-pointer items-center justify-center rounded border backdrop-blur-sm transition-colors"
      :class="[
        dense ? 'h-5 w-5' : 'h-6 w-6',
        unmuted
          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-black/70 text-[hsl(var(--tac-amber))]'
          : 'border-white/20 bg-black/60 text-white/70 hover:text-white',
      ]"
      @click.stop="emit('update:unmuted', !unmuted)"
      @keydown.enter.stop.prevent="emit('update:unmuted', !unmuted)"
    >
      <component
        :is="unmuted ? LucideVolume2 : LucideVolumeX"
        :class="dense ? 'h-2.5 w-2.5' : 'h-3 w-3'"
      />
    </span>
  </div>
</template>
