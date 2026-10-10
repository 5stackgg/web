<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useSlots,
  watch,
} from "vue";
import { useElementSize } from "@vueuse/core";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { useBackDismiss } from "~/composables/useBackDismiss";
import { escapeReachedPage } from "~/utilities/escapeKey";
import {
  sheetDetents,
  sheetPeekShare,
  sheetReleaseTarget,
  sheetSnapAt,
  sheetSnapOf,
  sheetSnapPoints,
  sheetTakesDrag,
  sheetTapTarget,
  type SheetSnap,
} from "~/utilities/sheetSnap";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** Off, this is a plain column in the page; on, a sheet over the map. */
  enabled: boolean;
}>();

const slots = useSlots();

// vaul follows the finger, picks the snap point a release goes to and
// animates there. What is here is what it has no notion of: which drags are
// the sheet's at all, how tall the card is at each snap, the peek's strip,
// and what Back undoes.
const snap = ref<SheetSnap>("half");
const hasPeek = computed(() => !!slots.peek);

// Only a raise to full by hand is Back's to undo: half and the peek are both
// the page as it arrives, and what the page raises (under a lineup) it lowers
// again itself.
const raisedByHand = ref(false);
let raisedFrom: SheetSnap = "half";
let held = false;
let heldFrom: SheetSnap = "half";

const dragging = ref(false);
const settling = ref(false);
let settleTimer: ReturnType<typeof setTimeout> | null = null;

// Leaving the phone layout (rotating a tablet) must not strand the next visit
// at full height over a map you never saw.
watch(
  () => props.enabled,
  (on) => {
    if (!on) {
      snap.value = "half";
      raisedByHand.value = false;
      held = false;
      dragging.value = false;
      rest();
    }
  },
);

const TOP_GAP = 72;
const HALF_SHARE = 0.4;
const HANDLE = 28;
// Until the strip has been measured.
const PEEK_ROW = 60;
// vaul's own settle, which the card and the strip keep time with.
const SETTLE_MS = 500;
const SETTLE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// window.innerHeight because that is what vaul measures snap points by.
const viewportHeight = ref(import.meta.client ? window.innerHeight : 0);
const full = computed(() => Math.max(0, viewportHeight.value - TOP_GAP));
const half = computed(() => Math.round(viewportHeight.value * HALF_SHARE));

function measure() {
  viewportHeight.value = window.innerHeight;
}

const peekEl = ref<HTMLElement | null>(null);
const { height: peekRow } = useElementSize(peekEl, undefined, {
  box: "border-box",
});
const peek = computed(() => HANDLE + Math.round(peekRow.value || PEEK_ROW));

const detents = computed(() =>
  sheetDetents(full.value, half.value, hasPeek.value ? peek.value : null),
);
const points = computed(() =>
  sheetSnapPoints(detents.value, viewportHeight.value),
);
const snapPoints = computed(() => points.value.map((entry) => entry.point));
const activePoint = computed(
  () =>
    points.value.find((entry) => entry.snap === snap.value)?.point ??
    points.value[0]?.point ??
    null,
);

function offsetFor(to: SheetSnap) {
  return detents.value[to] ?? detents.value.half;
}

// The drawer is drawn through a portal, so it is reached from the handle
// inside it.
const handleEl = ref<HTMLElement | null>(null);
const drawerEl = computed(
  () =>
    (handleEl.value?.closest("[data-vaul-drawer]") as HTMLElement | null) ??
    null,
);

// Read off the transform vaul writes on the drawer as it follows a finger.
const dragOffset = ref<number | null>(null);

function drawnOffset() {
  const match = /translate3d\(\s*[^,]+,\s*(-?\d+(?:\.\d+)?)px/.exec(
    drawerEl.value?.style.transform ?? "",
  );
  return match ? Number(match[1]) : null;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function rest() {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  settling.value = false;
  dragOffset.value = null;
  if (snap.value === "full") {
    void nextTick(markLists);
  }
}

// The timer because transitionend does not fire for a tab in the background.
function settle() {
  rest();
  if (reducedMotion()) {
    return;
  }
  settling.value = true;
  settleTimer = setTimeout(rest, SETTLE_MS + 60);
}

function onSettled(event: TransitionEvent) {
  if (
    event.target === drawerEl.value &&
    event.propertyName === "transform" &&
    settling.value &&
    !dragging.value
  ) {
    rest();
  }
}

// vaul does this itself whenever its snap point changes; this is for when it
// has not.
function place(animate: boolean) {
  const element = drawerEl.value;
  if (!element) {
    return;
  }
  element.style.transition =
    animate && !reducedMotion()
      ? `transform ${SETTLE_MS}ms ${SETTLE_EASE}`
      : "none";
  element.style.transform = `translate3d(0, ${offsetFor(snap.value)}px, 0)`;
}

function moveTo(to: SheetSnap) {
  if (to === snap.value) {
    return;
  }
  snap.value = to;
  settle();
}

// Not while the page holds the sheet at full: where a hand puts it then is
// only until the page lets go, and whatever step it had made in the history
// before is still under the page's own.
function byHand(to: SheetSnap) {
  if (held) {
    return;
  }
  if (to !== "full") {
    raisedByHand.value = false;
    return;
  }
  if (!raisedByHand.value) {
    raisedFrom = snap.value === "full" ? "half" : snap.value;
    raisedByHand.value = true;
  }
}

function lowerForBack() {
  raisedByHand.value = false;
  if (held) {
    heldFrom = raisedFrom;
    return;
  }
  moveTo(raisedFrom);
}

// Let go at its lowest snap with a flick downwards, vaul reports no snap
// point at all. Where it reports one a release should not reach (see
// sheetReleaseTarget), the right one goes back to it as its snap point and it
// turns round before it has moved.
function onSnapped(point: string | number | null) {
  const wanted = sheetSnapOf(point, points.value);
  if (!wanted) {
    return;
  }
  const to =
    gesture?.turn === "sheet"
      ? sheetReleaseTarget(
          gesture.from,
          wanted,
          dragOffset.value,
          detents.value,
        )
      : wanted;
  if (to === snap.value) {
    return;
  }
  byHand(to);
  snap.value = to;
}

/**
 * vaul drags on any movement at all, in any direction, on anything inside
 * it, and settles after every release. So it is kept from dragging
 * (`data-vaul-no-drag`, which it checks before it starts) until a press has
 * moved far enough to say what it is, and let go only for the drags
 * `sheetTakesDrag` gives it.
 */
type Gesture = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  target: Element | null;
  from: SheetSnap;
  mouse: boolean;
  // Moved far enough to be a drag rather than a press that shook.
  far: boolean;
  touched: boolean;
  turn: "undecided" | "sheet" | "content";
};
let gesture: Gesture | null = null;
let draggedAt = 0;

const SLOP = 6;
const REFUSES =
  "[data-no-sheet-drag], input, textarea, select, [contenteditable='true'], [role='slider']";

function gate(closed: boolean) {
  const element = drawerEl.value;
  if (!element) {
    return;
  }
  if (closed) {
    element.setAttribute("data-vaul-no-drag", "");
  } else {
    element.removeAttribute("data-vaul-no-drag");
  }
}

function scrollers(target: Element | null) {
  const found: HTMLElement[] = [];
  let node = target;
  while (node && node !== drawerEl.value) {
    if (
      node instanceof HTMLElement &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        found.push(node);
      }
    }
    node = node.parentElement;
  }
  return found;
}

function scrolledAway(target: Element | null) {
  return scrollers(target).some((node) => node.scrollTop > 0);
}

/**
 * A pull down on a list at its top is the sheet's. Said to the browser ahead
 * of the touch where it can be: `pan-down` lets a touch start a scroll only
 * downwards, so the pull is never the browser's to take. A browser that does
 * not know the value (Safari) drops it, and there the pull is taken from it
 * as it starts instead (see onTouchMove).
 */
function markTop(node: HTMLElement) {
  const atTop = node.scrollTop <= 0 && !scrolledAway(node.parentElement);
  const wanted = atTop ? "pan-x pan-down" : "";
  if (node.dataset.sheetTop !== wanted) {
    node.dataset.sheetTop = wanted;
    node.style.touchAction = wanted;
  }
}

function onScroll(event: Event) {
  if (event.target instanceof HTMLElement && event.target !== drawerEl.value) {
    markTop(event.target);
  }
}

// Found by class: asking every element in the card for its computed overflow
// would be a style pass over the whole sheet.
function markLists() {
  drawerEl.value
    ?.querySelectorAll<HTMLElement>(
      "[class*='overflow-y-auto'], [class*='overflow-auto'], [class*='overflow-y-scroll']",
    )
    .forEach(markTop);
}

function decide(x: number, y: number, slop = SLOP) {
  const current = gesture;
  if (!current) {
    return;
  }
  current.lastX = x;
  current.lastY = y;
  const dx = x - current.x;
  const dy = y - current.y;
  if (Math.hypot(dx, dy) >= SLOP) {
    current.far = true;
  }
  if (current.turn !== "undecided" || Math.hypot(dx, dy) < slop) {
    return;
  }
  const taken = sheetTakesDrag({
    dx,
    dy,
    snap: snap.value,
    onHandle: !!current.target?.closest("[data-sheet-handle]"),
    refused: !!current.target?.closest(REFUSES),
    scrolledAway: scrolledAway(current.target),
    byMouse: current.mouse,
  });
  current.turn = taken ? "sheet" : "content";
  if (taken) {
    gate(false);
    rest();
    dragging.value = true;
  }
}

function onPress(event: PointerEvent) {
  if (!event.isPrimary) {
    // Kept from vaul, which would restart its drag from a second finger.
    if (gesture?.turn === "sheet") {
      event.stopPropagation();
    }
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  gate(true);
  scrollers(event.target instanceof Element ? event.target : null).forEach(
    markTop,
  );
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    target: event.target instanceof Element ? event.target : null,
    from: snap.value,
    mouse: event.pointerType === "mouse",
    far: false,
    touched: false,
    turn: "undecided",
  };
}

function onMove(event: PointerEvent) {
  if (!gesture) {
    return;
  }
  if (event.pointerId !== gesture.id) {
    if (gesture.turn === "sheet") {
      event.stopPropagation();
    }
    return;
  }
  decide(event.clientX, event.clientY);
}

function onMoved(event: PointerEvent) {
  if (gesture?.turn === "sheet" && event.pointerId === gesture.id) {
    dragOffset.value = drawnOffset();
  }
}

// Let go exactly on fully open, vaul does nothing at all (it reads a drawn
// offset of 0 as nothing having been dragged) and the drawer stays wherever
// the finger left it. What it left behind is put right here, after it has
// had its say.
async function reconcile() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  const drawn = drawnOffset();
  if (drawn !== null && Math.abs(drawn - offsetFor(snap.value)) < 1) {
    return;
  }
  const to = drawn === null ? snap.value : sheetSnapAt(drawn, detents.value);
  if (to === snap.value) {
    place(true);
    return;
  }
  byHand(to);
  snap.value = to;
}

function onRelease(event: PointerEvent) {
  const ended = gesture;
  if (!ended || event.pointerId !== ended.id) {
    return;
  }
  gesture = null;
  // vaul has no handler for a cancelled press and waits for a release: it
  // is handed the one it missed, from where the finger last was.
  if (event.type === "pointercancel") {
    drawerEl.value?.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: ended.id,
        pointerType: event.pointerType,
        clientX: ended.lastX,
        clientY: ended.lastY,
      }),
    );
  }
  gate(true);
  if (ended.turn !== "sheet") {
    return;
  }
  dragging.value = false;
  if (ended.far) {
    draggedAt = event.timeStamp;
  }
  settle();
  void reconcile();
}

/**
 * A browser that has started scrolling takes the press away from the page,
 * and vaul with it; refusing the scroll on the moves that are the sheet's
 * leaves it a drag to follow.
 *
 * A browser can commit to the scroll on the first move it is not refused,
 * after which no later one can be. So a first move that goes down is decided
 * there and then, however short; any other waits to show which way it is
 * going.
 */
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (gesture && touch && event.touches.length === 1) {
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    const first = !gesture.touched;
    gesture.touched = true;
    decide(
      touch.clientX,
      touch.clientY,
      first && dy > 0 && dy >= Math.abs(dx) ? 0 : SLOP,
    );
  }
  if (gesture?.turn === "sheet" && event.cancelable) {
    event.preventDefault();
  }
}

// A drag with a mouse ends on what it started on, which makes a click.
function onClickCapture(event: MouseEvent) {
  if (draggedAt && event.timeStamp - draggedAt < 350) {
    event.stopPropagation();
    event.preventDefault();
  }
}

function listen(element: HTMLElement | null, on: boolean) {
  if (!element) {
    return;
  }
  const change = on ? "addEventListener" : "removeEventListener";
  const before = { capture: true };
  element[change]("pointerdown", onPress as EventListener, before);
  element[change]("pointermove", onMove as EventListener, before);
  element[change]("click", onClickCapture as EventListener, before);
  element[change]("pointermove", onMoved as EventListener);
  element[change]("pointerup", onRelease as EventListener);
  element[change]("pointercancel", onRelease as EventListener);
  element[change]("touchmove", onTouchMove as EventListener, {
    passive: false,
  });
  element[change]("transitionend", onSettled as EventListener);
  element[change]("scroll", onScroll, { capture: true, passive: true });
}

watch(
  drawerEl,
  (element, previous) => {
    listen(previous ?? null, false);
    listen(element, true);
    if (element) {
      gate(true);
      // vaul slides a drawer in from below the screen when it mounts.
      place(false);
    }
  },
  { flush: "post" },
);

onMounted(() => {
  measure();
  window.addEventListener("resize", measure);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", measure);
  listen(drawerEl.value, false);
  rest();
});

function onHandleClick() {
  const to = sheetTapTarget(snap.value);
  byHand(to);
  moveTo(to);
}

useBackDismiss(() => raisedByHand.value, lowerForBack, {
  enabled: () => props.enabled,
  id: "utility-sheet",
  reopen: () => {
    byHand("full");
    moveTo("full");
  },
});

// Registered ahead of the drawer, which is set up after this and listens on
// window too: see utilities/escapeKey.ts.
function onKeyAhead(event: KeyboardEvent) {
  if (event.key === "Escape") {
    escapeReachedPage(event);
  }
}

if (import.meta.client) {
  window.addEventListener("keydown", onKeyAhead);
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeyAhead));
}

// At rest the card is as tall as the part of the sheet on screen, so what is
// pinned to its foot is on screen too. While the sheet moves it is as tall as
// it gets, so a drag uncovers list rather than a gap.
const cardHeight = computed(() => {
  const shown =
    dragging.value || settling.value
      ? full.value
      : full.value - offsetFor(snap.value);
  return `${Math.max(0, shown - HANDLE)}px`;
});

const peekShare = computed(() =>
  dragging.value && dragOffset.value !== null
    ? sheetPeekShare(dragOffset.value, detents.value)
    : Number(snap.value === "peek"),
);

const fade = computed(() =>
  settling.value && !dragging.value
    ? `opacity ${SETTLE_MS}ms ${SETTLE_EASE}`
    : "none",
);

const sheetStyle = computed(() => ({
  height: `${full.value}px`,
  "--initial-transform": `${offsetFor(snap.value)}px`,
}));

// For something the page opens over the list. When the page lets go the
// sheet is put back where it was, which is full if a hand had it there.
function hold() {
  if (!held) {
    held = true;
    heldFrom = raisedByHand.value ? "full" : snap.value;
  }
  moveTo("full");
}

function release() {
  if (!held) {
    return;
  }
  held = false;
  moveTo(heldFrom);
}

// Where the sheet's top edge rests at this snap, down the window -- where
// it is going, not where a move has got to. It is laid along the window's
// bottom edge at its full height and pushed down from there.
function top(): number | null {
  if (!props.enabled) {
    return null;
  }
  return viewportHeight.value - full.value + offsetFor(snap.value);
}

defineExpose({ hold, release, snap: () => snap.value, top });
</script>

<template>
  <!-- role="region", not the drawer's own "dialog": everything in the app
       that waits for "a dialog is open" would wait on this one forever.

       Opaque, with no backdrop blur: the sheet is its own layer and moves
       over a map, so a filter was a blur of half the screen on every frame
       of a drag and of anything animating inside. -->
  <Drawer
    v-if="enabled"
    :open="true"
    :modal="false"
    :dismissible="false"
    :should-scale-background="false"
    :no-body-styles="true"
    :snap-points="snapPoints"
    :active-snap-point="activePoint"
    :fade-from-index="0"
    @update:active-snap-point="onSnapped"
  >
    <DrawerContent
      :overlay="false"
      :handle="false"
      data-utility-sheet
      role="region"
      :aria-describedby="undefined"
      class="z-30 mt-0 overscroll-contain rounded-t-2xl border-0 border-t border-white/10 bg-background shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.85)] motion-reduce:!transition-none"
      :style="sheetStyle"
      @interact-outside.prevent
      @focus-outside.prevent
      @pointer-down-outside.prevent
    >
      <!-- A dialog's focus scope wraps Tab round its own first and last
           control, trapped or not. Tab is kept from reaching it, so it walks
           out of the sheet as it would out of anything else. -->
      <div class="contents" @keydown.tab.stop>
        <DrawerTitle class="sr-only">
          {{ $t("pages.utility.title") }}
        </DrawerTitle>
        <button
          ref="handleEl"
          type="button"
          data-sheet-handle
          class="flex h-7 w-full shrink-0 items-center justify-center"
          :aria-label="
            snap === 'full'
              ? $t('pages.utility.sheet.collapse')
              : $t('pages.utility.sheet.expand')
          "
          :aria-expanded="snap === 'full'"
          @click="onHandleClick"
        >
          <span aria-hidden="true" class="h-1 w-10 rounded-full bg-white/25" />
        </button>
        <!-- No overscroll-behavior on what is inside: a browser applies it to
             every scroll container, which an overflow-hidden row is, and one
             that may not chain cannot hand a drag on to the list it sits in --
             the list stops scrolling under a finger.

             select-text: vaul turns selection off for everything inside a
             drawer wherever there is a mouse. -->
        <div
          v-bind="$attrs"
          class="min-h-0 shrink-0 select-text pb-[env(safe-area-inset-bottom)]"
          :class="[
            peekShare === 1 ? 'invisible' : '',
            // Below fully open every drag is the sheet's. Said to the browser,
            // so it never starts a scroll of its own and takes the press away.
            snap === 'full' ? '' : '[&_*]:!touch-none',
          ]"
          :style="{
            height: cardHeight,
            opacity: hasPeek ? 1 - peekShare : undefined,
            transition: fade,
          }"
          :inert="peekShare === 1 || undefined"
        >
          <slot />
        </div>
        <div
          v-if="hasPeek"
          ref="peekEl"
          data-sheet-peek
          class="absolute inset-x-0 top-7 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
          :class="peekShare === 1 ? '' : 'pointer-events-none'"
          :style="{ opacity: peekShare, transition: fade }"
          :inert="peekShare < 1 || undefined"
        >
          <slot name="peek" />
        </div>
      </div>
    </DrawerContent>
  </Drawer>
  <div v-else v-bind="$attrs">
    <slot />
  </div>
</template>
