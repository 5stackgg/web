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

// Three places to rest, not a free drag. Half is where it starts: the map is
// readable above the sheet, so a tap on a spot and the list it filters are on
// screen together. Full is for reading the list. The peek hands the screen to
// the map and keeps only a strip along the bottom edge -- whatever the `peek`
// slot holds, which stays usable there. It never leaves the screen.
//
// The sheet is the shared Drawer. It follows the finger, picks the place a
// release goes to and animates there; this component gives it the three
// places as snap points and keeps what it has no notion of: which drags are
// the sheet's at all, how tall the card inside is at each place, the strip,
// and what Back undoes.
const snap = ref<SheetSnap>("half");
const hasPeek = computed(() => !!slots.peek);

// Raised to full by a hand, when the page had not asked for full. Only this
// is Back's to undo: half and the peek are both the page as it arrives, and
// what the page raises (under a lineup) it lowers again itself.
const raisedByHand = ref(false);
let raisedFrom: SheetSnap = "half";
// The page is holding the sheet at full, and where it goes back to after.
let held = false;
let heldFrom: SheetSnap = "half";

// A finger has the sheet, or it is on its way to rest after one let go.
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
// Until the strip has been measured: a row of 44px chips and its padding.
const PEEK_ROW = 60;
// The drawer's own settle, which the card and the strip keep time with.
const SETTLE_MS = 500;
const SETTLE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// The window's height, which is what the drawer measures its snap points by.
const viewportHeight = ref(import.meta.client ? window.innerHeight : 0);
const full = computed(() => Math.max(0, viewportHeight.value - TOP_GAP));
const half = computed(() => Math.round(viewportHeight.value * HALF_SHARE));

function measure() {
  viewportHeight.value = window.innerHeight;
}

// The strip is as tall as what is in it, which includes the room it leaves
// for the home indicator.
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

// The drawer's element. It is drawn through a portal, so it is reached from
// the handle inside it.
const handleEl = ref<HTMLElement | null>(null);
const drawerEl = computed(
  () =>
    (handleEl.value?.closest("[data-vaul-drawer]") as HTMLElement | null) ??
    null,
);

// How far down the drawer is drawn, read off the transform it writes on
// itself as it follows a finger.
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

// Everything keeps the shape it has while moving until the drawer has
// arrived; transitionend does not fire for a tab that went to the background.
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

// Puts the drawer where the page says it rests, by hand. The drawer does
// this itself whenever its snap point changes; this is for when it has not.
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

// A hand put the sheet somewhere. Up to full is one step Back undoes, and
// down from it takes that step back. Not while the page holds the sheet at
// full: where a hand puts it then is only until the page lets go, and
// whatever step it had made before is still under the page's own.
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

// The drawer let go and is on its way to one of its snap points. Let go at
// the lowest with a flick downwards it reports none at all, and stays where
// it is. Where it reports a place the release should not reach (see
// sheetReleaseTarget) the page's own answer goes back to it as its snap
// point, and it turns round before it has moved.
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
 * Which drags are the sheet's. The drawer would take every one of them: any
 * movement at all, in any direction, on anything inside it. So it is kept
 * from dragging (`data-vaul-no-drag`, which it checks before it starts) until
 * a press has moved far enough to say what it is, and let go only for the
 * ones `sheetTakesDrag` gives it. A tap, a sideways swipe and a scroll of the
 * list then never reach it, and it never settles after them either.
 */
type Gesture = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  target: Element | null;
  // Where the sheet rested when the press began.
  from: SheetSnap;
  turn: "undecided" | "sheet" | "content";
};
let gesture: Gesture | null = null;
let draggedAt = 0;

const SLOP = 6;
// Not from these: they are things you drag for their own sake.
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

// What scrolls up and down between `target` and the drawer, innermost first.
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
 * A list at its top has nothing to scroll for a finger pulling down, and
 * that pull is the sheet's. Said to the browser ahead of the touch, where it
 * can be: `pan-down` lets a touch start a scroll only in the direction the
 * list can go, so the pull down is never the browser's to take. A browser
 * that does not know the value drops it, and there the pull is taken from it
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

// The lists that are there to be scrolled, found by how the app writes them:
// asking every element in the card for its computed overflow would be a
// style pass over the whole sheet.
function markLists() {
  drawerEl.value
    ?.querySelectorAll<HTMLElement>(
      "[class*='overflow-y-auto'], [class*='overflow-auto'], [class*='overflow-y-scroll']",
    )
    .forEach(markTop);
}

function decide(x: number, y: number) {
  const current = gesture;
  if (!current) {
    return;
  }
  current.lastX = x;
  current.lastY = y;
  if (current.turn !== "undecided") {
    return;
  }
  const dx = x - current.x;
  const dy = y - current.y;
  if (Math.hypot(dx, dy) < SLOP) {
    return;
  }
  const taken = sheetTakesDrag({
    dx,
    dy,
    snap: snap.value,
    onHandle: !!current.target?.closest("[data-sheet-handle]"),
    refused: !!current.target?.closest(REFUSES),
    scrolledAway: scrolledAway(current.target),
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
    // A second finger while the sheet is being dragged is nothing to it.
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

// After the drawer has moved itself for this event.
function onMoved(event: PointerEvent) {
  if (gesture?.turn === "sheet" && event.pointerId === gesture.id) {
    dragOffset.value = drawnOffset();
  }
}

// After a release the drawer is where the page's state says, or is on its
// way there. Not always: let go exactly on fully open it does nothing at all
// (it reads a drawn offset of 0 as nothing having been dragged) and stays
// wherever the finger left it. What it left behind is put right here, once
// it has had its say.
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

// After the drawer has let go for this event.
function onRelease(event: PointerEvent) {
  const ended = gesture;
  if (!ended || event.pointerId !== ended.id) {
    return;
  }
  gesture = null;
  // A press the browser took away gets no release, and the drawer waits for
  // one: it is handed the one it missed, from where the finger last was.
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
  draggedAt = event.timeStamp;
  settle();
  void reconcile();
}

/**
 * The list inside scrolls by itself, and a browser that has started scrolling
 * takes the press away from the page. Refusing the scroll on the moves that
 * are the sheet's is what leaves the drawer a drag to follow.
 */
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (touch && event.touches.length === 1) {
    decide(touch.clientX, touch.clientY);
  }
  if (gesture?.turn === "sheet" && event.cancelable) {
    event.preventDefault();
  }
}

// A drag with a mouse ends on whatever it started on, which the browser
// calls a click.
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
  // Not passive: taking the drag for the sheet has to stop the list scrolling.
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
      // The drawer animates in from below the screen when it mounts. This one
      // is part of the page: it is simply there, where it rests.
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

// Only a plain tap moves it: a drag has already put it where it goes.
function onHandleClick() {
  const to = sheetTapTarget(snap.value);
  byHand(to);
  moveTo(to);
}

useBackDismiss(() => raisedByHand.value, lowerForBack, {
  enabled: () => props.enabled,
});

/**
 * At rest the card is exactly as tall as the part of the sheet on screen, so
 * what is pinned to its foot is on screen too. While the sheet moves the card
 * is as tall as it gets, so there is list all the way down what a drag
 * uncovers instead of a gap that fills in on release.
 */
const cardHeight = computed(() => {
  const shown =
    dragging.value || settling.value
      ? full.value
      : full.value - offsetFor(snap.value);
  return `${Math.max(0, shown - HANDLE)}px`;
});

// The strip and the card trade places on the way into the peek, in step with
// the sheet: under a finger, and through the settle that follows.
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

/**
 * The page needs the whole sheet for something it opened over the list -- a
 * lineup picked on the map, with the sheet down at the peek. When the page
 * lets go it is put back where it was, which is full if a hand had it there.
 */
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

defineExpose({ hold, release, snap: () => snap.value });
</script>

<template>
  <!-- Open for good, never modal and never dismissed: the map behind it
       stays the map, and there is nothing that closes it. It is a region of
       the page rather than a dialog, which is also what keeps everything
       that waits for "a dialog is open" from waiting on it forever.

       Opaque, with no blur of what is behind it: the sheet is its own layer
       and moves over a map, so a backdrop filter was a blur of half the
       screen on every frame of a drag and of anything animating inside. -->
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
      <!-- The card inside scrolls itself, so this only gives it the room.
           Nothing here sets overscroll-behavior on what is inside: a browser
           applies it to every scroll container, which an overflow-hidden row
           is, and one that may not chain cannot hand a drag on to the list
           it sits in -- the list stops scrolling under a finger. The drawer
           itself contains the scroll, which is what keeps it off the page
           behind. -->
      <div
        v-bind="$attrs"
        class="min-h-0 shrink-0 pb-[env(safe-area-inset-bottom)]"
        :class="[
          peekShare === 1 ? 'invisible' : '',
          // Below fully open nothing inside scrolls: every drag is the
          // sheet's. Said to the browser, so it never starts a scroll of its
          // own there and takes the press away mid-drag.
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
      <!-- The strip the peek leaves on screen. It sits where the top of the
           card is, so the one fades into the other as the sheet goes down,
           and it keeps clear of the home indicator. -->
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
    </DrawerContent>
  </Drawer>
  <div v-else v-bind="$attrs">
    <slot />
  </div>
</template>
