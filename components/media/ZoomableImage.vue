<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize, useEventListener } from "@vueuse/core";
import { Minus, Plus, RotateCcw } from "lucide-vue-next";
import {
  STILL_ZOOM_MAX,
  STILL_ZOOM_MIN,
  panStill,
  stillIsPastNative,
  zoomStillAt,
  type StillView,
} from "~/utilities/stillZoom";

// An image filling its frame that can be zoomed toward the pointer, dragged
// once zoomed, and put back. `baseScale` is where it rests -- a crop in on
// the centre -- and what reset returns to.
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    baseScale?: number;
    interactive?: boolean;
  }>(),
  { alt: "", baseScale: 1, interactive: true },
);

const STEP = 1.5;
const CLOSE_UP = 3;
const DOUBLE_TAP_MS = 300;

const frameEl = ref<HTMLElement | null>(null);
const { width, height } = useElementSize(frameEl);
const frame = computed(() => ({ width: width.value, height: height.value }));

const rest = (): StillView => ({ scale: props.baseScale, x: 0, y: 0 });
const view = ref<StillView>(rest());
const animate = ref(false);
const naturalWidth = ref(0);

const zoomed = computed(() => view.value.scale > props.baseScale + 0.01);
const atRest = computed(
  () =>
    view.value.scale === props.baseScale &&
    view.value.x === 0 &&
    view.value.y === 0,
);
const crisp = computed(() =>
  stillIsPastNative(
    view.value.scale,
    width.value,
    naturalWidth.value,
    import.meta.client ? window.devicePixelRatio : 1,
  ),
);

function pointIn(clientX: number, clientY: number) {
  const box = frameEl.value?.getBoundingClientRect();
  if (!box) {
    return { x: 0, y: 0 };
  }
  return {
    x: clientX - box.left - box.width / 2,
    y: clientY - box.top - box.height / 2,
  };
}

function zoomTo(scale: number, at = { x: 0, y: 0 }, smooth = true) {
  animate.value = smooth;
  view.value = zoomStillAt(view.value, scale, at, frame.value);
}

function zoomIn() {
  zoomTo(view.value.scale * STEP);
}

function zoomOut() {
  zoomTo(view.value.scale / STEP);
}

function reset() {
  animate.value = true;
  view.value = rest();
}

function toggle(at: { x: number; y: number }) {
  if (zoomed.value) {
    reset();
    return;
  }
  zoomTo(Math.max(CLOSE_UP, props.baseScale * STEP), at);
}

defineExpose({ zoomIn, zoomOut, reset });

// At either end of the range the wheel goes back to scrolling the page; a
// trackpad pinch (a wheel with ctrlKey) never does, or the page zooms instead.
useEventListener(
  frameEl,
  "wheel",
  (event: WheelEvent) => {
    if (!props.interactive) {
      return;
    }
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
    const scale = Math.min(
      STILL_ZOOM_MAX,
      Math.max(STILL_ZOOM_MIN, view.value.scale * factor),
    );
    if (scale === view.value.scale && !event.ctrlKey) {
      return;
    }
    event.preventDefault();
    zoomTo(scale, pointIn(event.clientX, event.clientY), false);
  },
  { passive: false },
);

const pointers = new Map<number, { x: number; y: number }>();
let pinchFrom: { distance: number; scale: number } | null = null;
let lastTap = { at: 0, x: 0, y: 0 };

function spread() {
  const [a, b] = [...pointers.values()];
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y),
    middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

function onPointerDown(event: PointerEvent) {
  if (!props.interactive || (event.pointerType === "mouse" && event.button)) {
    return;
  }
  frameEl.value?.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    pinchFrom = { distance: spread().distance, scale: view.value.scale };
  }
}

function onPointerMove(event: PointerEvent) {
  const last = pointers.get(event.pointerId);
  if (!last) {
    return;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  animate.value = false;
  if (pointers.size === 2 && pinchFrom) {
    const now = spread();
    zoomTo(
      (pinchFrom.scale * now.distance) / Math.max(1, pinchFrom.distance),
      pointIn(now.middle.x, now.middle.y),
      false,
    );
    return;
  }
  view.value = panStill(
    view.value,
    { x: event.clientX - last.x, y: event.clientY - last.y },
    frame.value,
  );
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) {
    pinchFrom = null;
  }
  if (event.pointerType !== "touch" || pointers.size > 0) {
    return;
  }
  const now = Date.now();
  if (
    now - lastTap.at < DOUBLE_TAP_MS &&
    Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24
  ) {
    lastTap = { at: 0, x: 0, y: 0 };
    toggle(pointIn(event.clientX, event.clientY));
    return;
  }
  lastTap = { at: now, x: event.clientX, y: event.clientY };
}

function onDoubleClick(event: MouseEvent) {
  if (props.interactive) {
    toggle(pointIn(event.clientX, event.clientY));
  }
}

const imageStyle = computed(() => ({
  transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
  imageRendering: crisp.value ? ("pixelated" as const) : undefined,
}));

const CONTROL =
  "flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-30";
</script>

<template>
  <div
    ref="frameEl"
    class="relative overflow-hidden"
    :class="
      interactive
        ? [
            zoomed
              ? 'cursor-grab touch-none active:cursor-grabbing'
              : 'touch-pan-y',
            'select-none',
          ]
        : ''
    "
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDoubleClick"
  >
    <img
      :src="src"
      :alt="alt"
      decoding="async"
      draggable="false"
      data-still-view
      class="h-full w-full object-cover"
      :class="
        animate
          ? 'transition-transform [transition-duration:220ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
          : ''
      "
      :style="imageStyle"
      @load="naturalWidth = ($event.target as HTMLImageElement).naturalWidth"
    />

    <div
      v-if="interactive"
      class="absolute right-2 top-2 z-[2] flex flex-col overflow-hidden rounded-md border border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
      @pointerdown.stop
      @dblclick.stop
    >
      <button
        type="button"
        :class="CONTROL"
        :disabled="view.scale >= STILL_ZOOM_MAX"
        :aria-label="$t('ui.tooltips.zoom_in')"
        :title="$t('ui.tooltips.zoom_in')"
        @click="zoomIn"
      >
        <Plus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        :class="[CONTROL, 'border-t border-white/10']"
        :disabled="view.scale <= STILL_ZOOM_MIN"
        :aria-label="$t('ui.tooltips.zoom_out')"
        :title="$t('ui.tooltips.zoom_out')"
        @click="zoomOut"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        :class="[CONTROL, 'border-t border-white/10']"
        :disabled="atRest"
        :aria-label="$t('ui.tooltips.zoom_reset')"
        :title="$t('ui.tooltips.zoom_reset')"
        @click="reset"
      >
        <RotateCcw class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
