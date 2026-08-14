<script setup lang="ts">
import { ref, watch, onScopeDispose } from "vue";
import { LucideEyeOff, LucideRotateCcw } from "lucide-vue-next";
import { useCameraReframe } from "~/composables/useCameraReframe";
import { useCameraGestures } from "~/composables/useCameraGestures";
import type { CameraPipeline } from "~/composables/useCameraPipeline";

// The camera as the player sees it, and the reframe applied to it. This owns
// every element the media touches -- preview, crop canvas, and the offscreen
// source the canvas draws from -- which is why the reframe and gesture
// composables are built here rather than in the page: they are the only things
// that need those elements, and handing refs up would be plumbing for nothing.
const props = defineProps<{
  pipeline: CameraPipeline;
  previewVisible: boolean;
  // False while the camera is still opening or has failed -- there is nothing
  // to reframe, and a drag on the error state is an accident.
  interactive: boolean;
}>();

const emit = defineEmits<{
  (e: "output-track", track: MediaStreamTrack | null): void;
}>();

const stageEl = ref<HTMLElement | null>(null);
const previewEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const sourceEl = ref<HTMLVideoElement | null>(null);

// Detaching the stream is what actually frees the decode; hiding the element
// alone would keep the player's machine rendering a video it cannot see. The
// publish is a separate pipeline and is untouched either way.
//
// While cropping, the canvas is what gets shown -- it is already the exact
// surface being published. Feeding its captured stream back into a <video>
// would decode the frames this machine just finished drawing.
function syncPreview() {
  const el = previewEl.value;

  if (!el) {
    return;
  }

  const next =
    props.previewVisible && !reframe.cropping.value
      ? props.pipeline.stream()
      : null;

  if (el.srcObject !== next) {
    el.srcObject = next;
  }
}

const reframe = useCameraReframe({
  sourceEl,
  canvasEl,
  stream: () => props.pipeline.stream(),
  deviceId: () => props.pipeline.deviceId.value,
  onOutputTrack: (track) => emit("output-track", track),
  onSurfaceChange: syncPreview,
});

const gestures = useCameraGestures({
  stageEl,
  previewEl,
  canvasEl,
  reframe,
  enabled: () => !!props.pipeline.stream() && props.previewVisible,
});

watch([() => props.previewVisible, reframe.cropping], syncPreview);

// A replaced track is a different camera behind the same stream handle, so the
// preview has to be re-pointed even though nothing reactive changed.
onScopeDispose(props.pipeline.onTrack(syncPreview));

// Called after the camera opens or changes: pick up that camera's remembered
// framing and apply it without re-persisting what was just read.
async function adopt() {
  reframe.load();
  syncPreview();
  await reframe.apply(false);
}

// Functions rather than the refs themselves: defineExpose hands the caller a
// proxyRefs wrapper, so an exposed ref arrives already unwrapped at runtime
// while the generated types still call it a ref. Reading `.value` off one is
// silently undefined -- and here that would mean publishing the raw camera over
// a player's deliberate crop.
defineExpose({
  adopt,
  isCropping: () => reframe.cropping.value,
  croppedTrack: reframe.croppedTrack,
});
</script>

<template>
  <!-- The stage is reserved from the device class, never from the track:
       dimensions only arrive on loadedmetadata and the page must not move
       when they do. The frame is contained inside it, so it is letterboxed
       at its true ratio and never cropped -- cropping here is only ever the
       deliberate reframe. -->
  <div
    ref="stageEl"
    class="relative w-full overflow-hidden rounded-xl border bg-black"
    :class="pipeline.coarsePointer.value ? 'aspect-[3/4]' : 'aspect-video'"
  >
    <video
      v-show="previewVisible && !reframe.cropping.value"
      ref="previewEl"
      class="absolute inset-0 h-full w-full object-contain"
      autoplay
      playsinline
      muted
    ></video>

    <!-- The published surface itself, shown in place of the preview while
         cropping. Shrunk rather than hidden when it is not on show: this is
         what captureStream is publishing, and display:none is not a state
         worth betting a player's feed on. -->
    <canvas
      ref="canvasEl"
      aria-hidden="true"
      :class="
        previewVisible && reframe.cropping.value
          ? 'absolute inset-0 h-full w-full object-contain'
          : 'pointer-events-none absolute left-0 top-0 h-px w-px opacity-0'
      "
    ></canvas>

    <div
      v-show="!previewVisible"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <LucideEyeOff class="h-5 w-5 text-muted-foreground/60" />
      <p
        class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ $t("camera.preview_hidden") }}
      </p>
      <p class="max-w-xs text-[11px] leading-snug text-muted-foreground/80">
        {{ $t("camera.preview_hidden_hint") }}
      </p>
    </div>

    <div
      v-show="previewVisible && interactive"
      class="absolute inset-0 z-10 touch-none select-none"
      :class="
        reframe.cropping.value
          ? reframe.dragging.value
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : ''
      "
      @pointerdown="gestures.onPointerDown"
      @pointermove="gestures.onPointerMove"
      @pointerup="gestures.onPointerUp"
      @pointercancel="gestures.onPointerUp"
    >
      <div
        v-show="reframe.cropping.value"
        class="absolute inset-3 border border-[hsl(var(--tac-amber)/0.4)]"
      >
        <span
          class="absolute inset-y-0 left-1/3 w-px bg-[hsl(var(--tac-amber)/0.2)]"
        ></span>
        <span
          class="absolute inset-y-0 left-2/3 w-px bg-[hsl(var(--tac-amber)/0.2)]"
        ></span>
        <span
          class="absolute inset-x-0 top-1/3 h-px bg-[hsl(var(--tac-amber)/0.2)]"
        ></span>
        <span
          class="absolute inset-x-0 top-2/3 h-px bg-[hsl(var(--tac-amber)/0.2)]"
        ></span>
      </div>
    </div>

    <span
      v-if="reframe.cropping.value && previewVisible"
      class="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-black/70 px-2 py-0.5 font-mono text-[0.55rem] tabular-nums text-[hsl(var(--tac-amber))] backdrop-blur-sm"
    >
      {{ reframe.zoomPercent.value }}%
    </span>

    <button
      v-if="reframe.cropping.value && previewVisible"
      type="button"
      class="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white"
      @click="reframe.reset"
    >
      <LucideRotateCcw class="h-2.5 w-2.5" />
      {{ $t("camera.reframe_reset") }}
    </button>

    <slot name="overlay" />

    <!-- Kept renderable rather than hidden: a display:none video is free to
         stop decoding, and this one is what the crop draws from. -->
    <video
      ref="sourceEl"
      class="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      aria-hidden="true"
      autoplay
      playsinline
      muted
    ></video>
  </div>
</template>
