<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  useEventListener,
  useMediaQuery,
  useResizeObserver,
} from "@vueuse/core";
import { HoverCard, HoverCardContent } from "~/components/ui/hover-card";
import UtilityLineupPeek from "~/components/utility/UtilityLineupPeek.vue";
import { useUtilityPeek } from "~/composables/useUtilityPeek";
import { utilityPeekPlacement } from "~/utilities/utilityPeekPlacement";
import type { UtilityLineup } from "~/types/utility";

// Rest the mouse on a lineup's row, or on its marker on the radar, and the
// throw opens beside it. The card primitive dismisses the peek, but it is
// anchored rather than given a trigger: the trigger also opens on focus, which
// would pop a peek under every row a click or the keyboard lands on.
const props = withDefaults(
  defineProps<{
    lineup: UtilityLineup;
    anchor: Element | null;
    enabled?: boolean;
    // "beside" opens next to the anchor (a row); "pointer" works from where
    // the pointer came to rest (a marker). Either way it keeps off the throw.
    placement?: "beside" | "pointer";
  }>(),
  { enabled: true, placement: "beside" },
);

// Below md the card is a sheet over the map, with no room beside it.
const canPeek = useMediaQuery(
  "(hover: hover) and (pointer: fine) and (min-width: 768px)",
);

// The peek never takes the pointer: it lets every event through to the rows
// and markers under it, and goes almost as soon as the pointer leaves what it
// is about, so it can never stand between the pointer and the next throw.
// Once one is up, the next takes over at once -- sweeping across markers is
// scrubbing through them.
const COLD_OPEN_MS = 300;
const CLOSE_MS = 100;

const peek = useUtilityPeek();
const owner = peek.claimOwner();
const open = computed(() => peek.holder.value === owner);

let pointerX = 0;
let pointerY = 0;
let restedAt = { x: 0, y: 0 };

const body = ref<HTMLElement | null>(null);

// The peek's own size, unscaled. It grows as its still and run-up load, and
// the primitive re-places it when the box around it changes.
const natural = ref({ width: 384, height: 520 });
useResizeObserver(body, () => {
  const element = body.value;
  if (element) {
    natural.value = {
      width: element.offsetWidth,
      height: element.offsetHeight,
    };
  }
});

// Where there is no clear room on the radar at full size, the peek is drawn
// smaller rather than over the throw or off the radar.
const scale = ref(1);

function place(size: { width: number; height: number }) {
  const anchor =
    props.placement === "pointer"
      ? { left: restedAt.x, top: restedAt.y, width: 0, height: 0 }
      : props.anchor?.getBoundingClientRect();
  const board = peek.board.value;
  const at = utilityPeekPlacement({
    anchor: anchor ?? { left: 0, top: 0, width: 0, height: 0 },
    peek: { width: size.width + 2, height: size.height + 2 },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    board: board?.rect() ?? null,
    line: board?.line(props.lineup.id) ?? null,
    beside: props.placement === "beside",
    gap: props.placement === "pointer" ? 20 : 12,
  });
  if (scale.value !== at.scale) {
    scale.value = at.scale;
  }
  return at;
}

const frame = computed(() =>
  scale.value < 1
    ? {
        width: `${natural.value.width * scale.value}px`,
        height: `${natural.value.height * scale.value}px`,
      }
    : undefined,
);

// A new reference whenever the measured size changes, so the primitive
// places the peek again once its content has actually rendered.
const reference = computed(() => {
  const size = natural.value;
  return {
    getBoundingClientRect: () => {
      const at = place(size);
      return new DOMRect(at.left, at.top, 0, 0);
    },
    contextElement: props.anchor ?? undefined,
  };
});

function track(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
}

const leaveInstantly = ref(false);

let hovering = false;
let pressed = false;
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function close(cool = false) {
  clearTimers();
  peek.hide(owner, cool);
}

function show() {
  leaveInstantly.value = false;
  restedAt = { x: pointerX, y: pointerY };
  peek.show(owner);
}

function onEnter(event: PointerEvent) {
  if (event.pointerType !== "mouse") {
    return;
  }
  track(event);
  hovering = true;
  pressed = false;
  clearTimers();
  if (!props.enabled || !canPeek.value || open.value) {
    return;
  }
  if (peek.isWarm()) {
    show();
    return;
  }
  openTimer = setTimeout(() => {
    openTimer = null;
    if (hovering && !pressed && props.enabled) {
      show();
    }
  }, COLD_OPEN_MS);
}

function onLeave(event: PointerEvent) {
  if (event.pointerType !== "mouse") {
    return;
  }
  hovering = false;
  clearTimers();
  if (open.value) {
    closeTimer = setTimeout(close, CLOSE_MS);
  }
}

// A press acts on the row, so the peek stays down until the pointer leaves
// and comes back.
function onPress() {
  pressed = true;
  close();
}

useEventListener(() => props.anchor, "pointerenter", onEnter);
useEventListener(() => props.anchor, "pointerleave", onLeave);
useEventListener(() => props.anchor, "pointerdown", onPress);
useEventListener(
  () => (props.placement === "pointer" ? props.anchor : null),
  "pointermove",
  track,
  { passive: true },
);

// A list scrolling under a resting pointer carries the row away from the
// peek; and while the wheel turns, the rows sliding under the pointer must
// each wait the full delay, or peeks flicker open between ticks.
useEventListener(
  () => (open.value ? window : null),
  "scroll",
  (event: Event) => {
    if (
      props.anchor &&
      event.target instanceof Node &&
      event.target.contains(props.anchor)
    ) {
      pressed = hovering;
      close(true);
    }
  },
  { capture: true, passive: true },
);

// The peek cannot be clicked, so its stills step from the keyboard -- only
// while it is up, and never out from under a field being typed in.
const content = ref<InstanceType<typeof UtilityLineupPeek> | null>(null);

useEventListener(
  () => (open.value ? window : null),
  "keydown",
  (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
    content.value?.step(event.key === "ArrowLeft" ? -1 : 1);
  },
);

// Escape or a press elsewhere. Opening is never taken from the primitive.
function onOpenChange(value: boolean) {
  if (value) {
    return;
  }
  pressed = hovering;
  close();
}

// Handed over to another row: go at once rather than fading out beside it.
watch(peek.holder, (holder, previous) => {
  if (previous === owner && holder !== null) {
    leaveInstantly.value = true;
  }
});

watch(
  () => props.enabled,
  (enabled) => {
    if (!enabled) {
      close();
    }
  },
);

onBeforeUnmount(() => close());

const contentClass = computed(() => [
  "utility-peek pointer-events-none w-auto select-none overflow-hidden rounded-xl border-white/[0.1] bg-sidebar p-0 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)] motion-reduce:!animate-none",
  leaveInstantly.value ? "data-[state=closed]:!animate-none" : "",
]);
</script>

<template>
  <HoverCard :open="open" @update:open="onOpenChange">
    <HoverCardContent
      :reference="reference"
      side="bottom"
      align="start"
      :side-offset="0"
      :avoid-collisions="false"
      :class="contentClass"
    >
      <div class="overflow-hidden" :style="frame">
        <div
          ref="body"
          class="w-[24rem] origin-top-left"
          :style="scale < 1 ? { transform: `scale(${scale})` } : undefined"
        >
          <UtilityLineupPeek ref="content" :lineup="lineup" />
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>

<style>
/* The primitive positions the peek inside a wrapper of its own, which would
   still catch the pointer over the peek's whole box. */
[data-reka-popper-content-wrapper]:has(> .utility-peek) {
  pointer-events: none;
}
</style>
