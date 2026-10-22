<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-vue-next";
import {
  streamControlBarClasses,
  streamControlButtonClasses,
  streamControlIconClasses,
} from "~/components/match/streamControlClasses";

// No pointer-events class anywhere: a click-through host (camera tiles) turns
// them off on its root. A null fullscreen, muted or volume leaves that
// control out.
const props = withDefaults(
  defineProps<{
    fullscreen?: boolean | null;
    muted?: boolean | null;
    volume?: number | null;
    unmutePill?: boolean;
    // null reveals on hover of the nearest unnamed `group`.
    visible?: boolean | null;
    fullscreenShortcut?: boolean;
    placement?: "bottom" | "top";
    align?: "split" | "end";
  }>(),
  {
    fullscreen: null,
    muted: null,
    volume: null,
    unmutePill: false,
    visible: null,
    fullscreenShortcut: false,
    placement: "bottom",
    align: "split",
  },
);

const emit = defineEmits<{
  (e: "toggle-fullscreen"): void;
  (e: "toggle-mute"): void;
  (e: "update:volume", volume: number): void;
}>();

// Touch has no hover, so its controls stay up.
const touch = ref(false);
onMounted(() => {
  if (window.matchMedia) {
    touch.value = window.matchMedia("(pointer: coarse)").matches;
  }
});

const revealClasses = computed(() => {
  if (props.visible === false) {
    return "opacity-0 hover:opacity-100 focus-within:opacity-100";
  }
  if (touch.value || props.visible === true) {
    return "opacity-100";
  }
  return "opacity-0 group-hover:opacity-100 focus-within:opacity-100";
});

const edgeClasses = computed(() =>
  props.placement === "top"
    ? "top-[var(--stream-control-inset)]"
    : "bottom-[var(--stream-control-inset)]",
);

const rootClasses = computed(() =>
  props.align === "end"
    ? [
        "absolute right-[var(--stream-control-inset)] z-10 flex items-center gap-2",
        edgeClasses.value,
      ]
    : "contents",
);

function cornerClasses(side: "left" | "right") {
  if (props.align === "end") {
    return "";
  }
  return [
    "absolute z-10",
    edgeClasses.value,
    side === "left"
      ? "left-[var(--stream-control-inset)]"
      : "right-[var(--stream-control-inset)]",
  ];
}
</script>

<template>
  <div class="stream-controls" :class="[rootClasses, { 'is-touch': touch }]">
    <div
      v-if="fullscreen !== null || $slots.default"
      class="transition-opacity duration-150"
      :class="[streamControlBarClasses, cornerClasses('left'), revealClasses]"
    >
      <button
        v-if="fullscreen !== null"
        type="button"
        :aria-label="
          fullscreen
            ? $t('ui_extras.exit_fullscreen')
            : $t('ui_extras.fullscreen')
        "
        :title="
          fullscreen
            ? $t('ui_extras.exit_fullscreen')
            : fullscreenShortcut
              ? $t('replay_extras.fullscreen_key')
              : $t('ui_extras.fullscreen')
        "
        :class="streamControlButtonClasses"
        @click.stop="emit('toggle-fullscreen')"
      >
        <Minimize2 v-if="fullscreen" :class="streamControlIconClasses" />
        <Maximize2 v-else :class="streamControlIconClasses" />
      </button>
      <slot />
    </div>

    <template v-if="muted !== null">
      <button
        v-if="muted && unmutePill"
        type="button"
        :aria-label="$t('ui.unmute')"
        class="inline-flex h-[var(--stream-control)] cursor-pointer items-center gap-2 rounded-[calc(var(--stream-control)/4)] bg-foreground pl-2.5 pr-3.5 text-[13px] font-semibold text-background shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_8px_24px_-8px_rgb(0_0_0/0.7)] transition-colors duration-150 hover:bg-foreground/85"
        :class="cornerClasses('right')"
        @click.stop="emit('toggle-mute')"
      >
        <VolumeX class="size-4" />
        {{ $t("match.tap_to_unmute") }}
      </button>

      <div
        v-else
        class="transition-opacity duration-150"
        :class="[
          streamControlBarClasses,
          cornerClasses('right'),
          revealClasses,
        ]"
      >
        <button
          type="button"
          :aria-label="muted ? $t('ui.unmute') : $t('ui.mute')"
          :title="muted ? $t('ui.unmute') : $t('ui.mute')"
          :class="streamControlButtonClasses"
          @click.stop="emit('toggle-mute')"
        >
          <VolumeX v-if="muted" :class="streamControlIconClasses" />
          <Volume2 v-else :class="streamControlIconClasses" />
        </button>
        <!-- Phones set volume with their own keys; iOS ignores it anyway. -->
        <input
          v-if="volume !== null && !muted && !touch"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          :aria-label="$t('ui.volume')"
          class="vol-slider ml-0.5 mr-2.5 w-[var(--stream-control-slider)] cursor-pointer"
          :style="{ '--stream-volume': `${volume * 100}%` }"
          @click.stop
          @mousedown.stop
          @input="
            emit(
              'update:volume',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Sized by the host's inline-size container, never by fullscreen: a
   fullscreened deck would blow up the camera tiles inside it. Labels drop out
   on small players, where they would run into the unmute pill. */
.stream-controls {
  --stream-control: 36px;
  --stream-control-icon: 18px;
  --stream-control-inset: 12px;
  --stream-control-slider: 84px;
}
.stream-controls :deep(.stream-control-labelled) {
  padding-inline: 10px 12px;
}
@container (min-width: 1280px) {
  .stream-controls {
    --stream-control: 40px;
    --stream-control-icon: 20px;
    --stream-control-inset: 16px;
    --stream-control-slider: 96px;
  }
}
@container (max-width: 559px) {
  .stream-controls {
    --stream-control: 28px;
    --stream-control-icon: 14px;
    --stream-control-inset: 8px;
    --stream-control-slider: 56px;
  }
  .stream-controls :deep(.stream-control-labelled) {
    padding-inline: 0;
  }
  .stream-controls :deep(.stream-control-label) {
    display: none;
  }
}
@container (max-width: 319px) {
  .stream-controls {
    --stream-control: 24px;
    --stream-control-icon: 12px;
    --stream-control-inset: 6px;
    --stream-control-slider: 44px;
  }
}
.stream-controls.is-touch {
  --stream-control: 40px;
  --stream-control-icon: 18px;
}

.vol-slider {
  appearance: none;
  height: 0.25rem;
  background: transparent;
}
.vol-slider:focus {
  outline: none;
}
.vol-slider::-webkit-slider-runnable-track {
  height: 0.25rem;
  background: linear-gradient(
    to right,
    white var(--stream-volume, 100%),
    rgba(255, 255, 255, 0.25) var(--stream-volume, 100%)
  );
  border-radius: 9999px;
}
.vol-slider::-moz-range-track {
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
}
.vol-slider::-moz-range-progress {
  height: 0.25rem;
  background: white;
  border-radius: 9999px;
}
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
  margin-top: -0.25rem;
}
.vol-slider::-moz-range-thumb {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
}
.vol-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45);
}
.vol-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45);
}
</style>
