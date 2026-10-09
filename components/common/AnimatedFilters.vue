<script lang="ts" setup>
import {
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  computed,
} from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

type FilterOption = {
  key: string;
  label: string;
  title?: string;
  desc?: string;
  count?: number;
  disabled?: boolean;
  icon?: any;
};

const props = defineProps<{
  options: FilterOption[];
  square?: boolean;
  size?: "lg";
  block?: boolean;
  fill?: boolean;
  // Count over label, in equal columns. For narrow columns where a row of
  // label-plus-count pills does not fit and wrapping strands the last one.
  stacked?: boolean;
  // Icons only, with the selected tab wearing its label: the label grows in on
  // the tab you pick and shrinks out of the one you left. For a strip too
  // narrow to label every tab.
  collapse?: boolean;
}>();

const model = defineModel<string>();

const containerShape = "rounded-md";
const indicatorShape = "rounded-sm";
const buttonShape = computed(() => {
  const base = props.collapse ? "" : props.block ? "min-w-0 flex-1" : "";
  const gap = props.collapse ? "" : "gap-1.5";
  if (props.stacked) {
    return "flex min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 py-1.5";
  }
  if (props.size === "lg") {
    return `inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-2.5 font-mono text-[0.72rem] font-bold uppercase leading-tight tracking-[0.08em] ${base}`;
  }
  // h-[1.375rem] + the container's p-1 and 1px border lands the whole strip on
  // exactly 2rem, so a square filter group lines up with adjacent h-8 buttons.
  return props.square
    ? `inline-flex h-[1.375rem] items-center justify-center ${gap} rounded-sm px-2.5 font-mono text-[0.65rem] font-semibold uppercase leading-none tracking-[0.12em] ${base}`
    : `inline-flex items-center justify-center ${gap} rounded-sm px-3 py-1.5 text-xs tracking-[0.06em] ${base}`;
});

// The picked tab takes the spare width and the rest hug their icons. The
// layout changes at once; what you see between the two states is drawn with
// transforms and opacity only (see swap() below), because a width that eases
// through layout stutters the moment the page is busy -- and switching tabs is
// exactly when it is, with the tab's whole content mounting underneath.
function buttonMotion(opt: FilterOption) {
  if (!props.collapse) {
    return "transition-colors duration-200";
  }
  return [
    "transition-colors duration-200",
    model.value === opt.key ? "min-w-0 grow" : "shrink-0 grow-0",
  ];
}

function labelMotion(opt: FilterOption) {
  return model.value === opt.key ? "grid-cols-[1fr]" : "grid-cols-[0fr] opacity-0";
}
function countTone(opt: FilterOption) {
  if (model.value === opt.key || opt.disabled) {
    return "";
  }
  return (opt.count ?? 0) === 0 ? "opacity-35" : "";
}

function buttonState(opt: FilterOption) {
  const selected = model.value === opt.key;
  if (opt.disabled) {
    return selected
      ? "cursor-not-allowed font-bold text-black"
      : "cursor-not-allowed text-muted-foreground/40";
  }
  return selected
    ? "font-bold text-black"
    : "text-muted-foreground hover:text-foreground";
}

const containerRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);
const ghostRef = ref<HTMLElement | null>(null);
// Not reactive, and neither is where the indicator sits: kept in state, every
// move of the pill re-rendered the whole strip to change four numbers.
const btns = new Map<string, HTMLElement>();

function setBtn(el: Element | null, key: string) {
  if (el) {
    btns.set(key, el as HTMLElement);
  } else {
    btns.delete(key);
  }
}

type Rect = { left: number; top: number; width: number; height: number };

let placed: Rect | null = null;

function place(rect: Rect | null) {
  const el = indicatorRef.value;
  if (!el) {
    return;
  }
  placed = rect;
  if (!rect) {
    el.style.opacity = "0";
    return;
  }
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.opacity = "1";
}

function tabRect(): Rect | null {
  const el = model.value ? btns.get(model.value) : null;
  if (!el || !containerRef.value || el.offsetWidth === 0) {
    return null;
  }
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  };
}

// Mid-flight included, in the strip's own coordinates.
function drawnRect(): Rect | null {
  const el = indicatorRef.value;
  const strip = containerRef.value;
  if (!el || !strip || !placed) {
    return null;
  }
  const box = el.getBoundingClientRect();
  const origin = strip.getBoundingClientRect();
  return {
    left: box.left - origin.left - strip.clientLeft,
    top: box.top - origin.top - strip.clientTop,
    width: box.width,
    height: box.height,
  };
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Every move is a transform over a layout that has already landed, so the
// compositor runs it while the picked tab mounts its content on the main
// thread. Animating left and width laid the strip out on every frame.
const running = new Set<Animation>();

function play(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
) {
  if (!el || typeof el.animate !== "function") {
    return;
  }
  const animation = el.animate(keyframes, timing);
  running.add(animation);
  const done = () => running.delete(animation);
  animation.addEventListener("finish", done);
  animation.addEventListener("cancel", done);
}

function stop() {
  for (const animation of [...running]) {
    animation.cancel();
  }
  running.clear();
}

const GLIDE_MS = 240;
const GLIDE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function glide(from: Rect, to: Rect) {
  if (
    to.width === 0 ||
    to.height === 0 ||
    (Math.abs(from.left - to.left) < 0.5 &&
      Math.abs(from.top - to.top) < 0.5 &&
      Math.abs(from.width - to.width) < 0.5 &&
      Math.abs(from.height - to.height) < 0.5)
  ) {
    return;
  }
  play(
    indicatorRef.value,
    [
      {
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
      },
      { transform: "none" },
    ],
    { duration: GLIDE_MS, easing: GLIDE_EASE },
  );
}

// ---- collapse mode: one pill grows while the other shrinks ----
//
// The amber is the indicator, sitting exactly on the picked tab. On a switch
// it starts as the new tab's old icon-sized box and grows to its place, while a
// second pill starts as the old tab's full width, shrinks to its icon and
// lets go. Every tab's contents glide from where they were to where they are.
// All of it is FLIP: read the boxes before the change and after, then play the
// difference as a transform. Nothing in the layout moves once it has landed, so
// the motion keeps its rate whatever else the page is doing.
const SWAP_MS = 300;
const SWAP_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";

type Box = { left: number; width: number; icon: number };
let before: Record<string, Box> | null = null;
let leaving: string | null = null;

function measure() {
  const origin = containerRef.value?.getBoundingClientRect().left ?? 0;
  const out: Record<string, Box> = {};
  for (const [key, el] of btns) {
    const rect = el.getBoundingClientRect();
    out[key] = {
      left: rect.left - origin,
      width: rect.width,
      icon:
        (el.firstElementChild?.getBoundingClientRect().left ?? rect.left) -
        origin,
    };
  }
  return out;
}

// Before the DOM is patched: where everything is on screen right now,
// including anything still mid-flight from the last switch.
watch(
  model,
  (_next, previous) => {
    if (props.collapse && containerRef.value && placed) {
      before = measure();
      leaving = previous ?? null;
    }
  },
  { flush: "pre" },
);

function swap(first: Record<string, Box>, key: string) {
  const last = measure();
  const timing = { duration: SWAP_MS, easing: SWAP_EASE };
  const from = (start: Box, end: Box) => [
    {
      transform: `translateX(${start.left - end.left}px) scaleX(${start.width / (end.width || 1)})`,
    },
    { transform: "none" },
  ];

  for (const [name, el] of btns) {
    if (!first[name] || !last[name]) {
      continue;
    }
    const shift = first[name].icon - last[name].icon;
    if (Math.abs(shift) > 0.5) {
      play(
        el,
        [{ transform: `translateX(${shift}px)` }, { transform: "none" }],
        timing,
      );
    }
  }

  if (first[key] && last[key]) {
    play(indicatorRef.value, from(first[key], last[key]), timing);
  }

  const old = leaving;
  const tab = old ? btns.get(old) : null;
  if (ghostRef.value && old && tab && old !== key && first[old] && last[old]) {
    Object.assign(ghostRef.value.style, {
      left: `${tab.offsetLeft}px`,
      top: `${tab.offsetTop}px`,
      width: `${tab.offsetWidth}px`,
      height: `${tab.offsetHeight}px`,
    });
    play(ghostRef.value, from(first[old], last[old]), timing);
    play(
      ghostRef.value,
      [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }],
      { duration: SWAP_MS },
    );
  }

  // The label arrives once the pill has grown enough to be under it.
  play(
    btns.get(key)?.querySelector(".af-label"),
    [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }],
    { duration: SWAP_MS },
  );
}

function follow() {
  const first = before;
  before = null;
  const from = props.collapse ? null : drawnRect();
  stop();
  const to = tabRect();
  place(to);
  if (!to || reducedMotion()) {
    return;
  }
  if (props.collapse) {
    if (first && model.value) {
      swap(first, model.value);
    }
    return;
  }
  if (from) {
    glide(from, to);
  }
}

// Measured once per change of size, never per frame.
let ro: ResizeObserver | null = null;

function observe() {
  if (!ro || !containerRef.value) {
    return;
  }
  ro.disconnect();
  ro.observe(containerRef.value);
  for (const el of btns.values()) {
    ro.observe(el);
  }
}

onMounted(() => {
  nextTick(() => place(tabRect()));
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => place(tabRect()));
    observe();
  }
});

onBeforeUnmount(() => {
  ro?.disconnect();
  stop();
});

// One watcher for both, so a switch that also changes the set of tabs is
// followed once: a second pass would cancel what the first had just started.
watch(
  [model, () => props.options.map((option) => option.key).join(",")],
  ([, keys], [, previousKeys]) => {
    if (keys !== previousKeys) {
      observe();
    }
    follow();
  },
  { flush: "post" },
);
</script>

<template>
  <div
    ref="containerRef"
    class="relative max-w-full gap-1 border border-border bg-muted/30 p-1"
    :class="[
      containerShape,
      fill ? 'flex-1 self-stretch' : 'self-start',
      stacked
        ? 'grid w-full auto-cols-fr grid-flow-col'
        : block
          ? 'flex w-full'
          : 'inline-flex w-fit flex-wrap',
    ]"
  >
    <!-- The pill the old tab gives up, in collapse mode: placed and played by
         swap(), invisible the rest of the time. -->
    <span
      v-if="collapse"
      ref="ghostRef"
      aria-hidden="true"
      class="pointer-events-none absolute origin-top-left bg-[hsl(var(--tac-amber))] opacity-0"
      :class="indicatorShape"
    />
    <!-- Placed and moved from the script, never through a binding: see
         place() and glide(). -->
    <span
      ref="indicatorRef"
      data-filter-indicator
      class="pointer-events-none absolute origin-top-left bg-[hsl(var(--tac-amber))] opacity-0 shadow-[0_0_12px_-2px_hsl(var(--tac-amber)/0.6)]"
      :class="indicatorShape"
    />
    <template v-for="opt in options" :key="opt.key">
      <FiveStackToolTip
        v-if="opt.title || opt.desc"
        as-child
        side="top"
        :delay-duration="120"
        :tap-toggle="false"
      >
        <template #trigger>
          <button
            :ref="(el) => setBtn(el as Element | null, opt.key)"
            type="button"
            :disabled="opt.disabled"
            class="relative z-10"
            :class="[buttonShape, buttonState(opt), buttonMotion(opt)]"
            @click="!opt.disabled && (model = opt.key)"
          >
            <template v-if="stacked">
              <span
                class="text-[0.95rem] font-semibold leading-none tabular-nums tracking-tight"
                :class="countTone(opt)"
              >
                {{ opt.count ?? 0 }}
              </span>
              <span class="font-mono text-[0.5rem] uppercase leading-none tracking-[0.08em] opacity-80">
                {{ opt.label }}
              </span>
            </template>
            <template v-else>
              <component :is="opt.icon" v-if="opt.icon" class="h-4 w-4" />
              <!-- Wrapped so a caller can collapse the strip to its icons when its
                   container runs out of room: a bare text node cannot be hidden,
                   and as a flex item a span sits exactly where it did. -->
              <span
                v-if="opt.label && collapse"
                class="grid"
                :class="labelMotion(opt)"
              >
                <span class="min-w-0 overflow-hidden">
                  <span class="af-label block whitespace-nowrap pl-1.5 font-bold">{{ opt.label }}</span>
                </span>
              </span>
              <span v-else-if="opt.label" class="af-label">{{ opt.label }}</span>
              <span v-if="opt.count !== undefined" class="ml-1 opacity-60">{{
                opt.count
              }}</span>
            </template>
          </button>
        </template>
        <div class="max-w-[220px] space-y-0.5">
          <div
            v-if="opt.title"
            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
          >
            {{ opt.title }}
          </div>
          <div
            v-if="opt.desc"
            class="text-xs leading-snug text-muted-foreground"
          >
            {{ opt.desc }}
          </div>
        </div>
      </FiveStackToolTip>
      <button
        v-else
        :ref="(el) => setBtn(el as Element | null, opt.key)"
        type="button"
        :disabled="opt.disabled"
        class="relative z-10"
        :class="[buttonShape, buttonState(opt), buttonMotion(opt)]"
        @click="!opt.disabled && (model = opt.key)"
      >
        <template v-if="stacked">
          <span
            class="text-[0.95rem] font-semibold leading-none tabular-nums tracking-tight"
            :class="countTone(opt)"
          >
            {{ opt.count ?? 0 }}
          </span>
          <span class="font-mono text-[0.5rem] uppercase leading-none tracking-[0.08em] opacity-80">
            {{ opt.label }}
          </span>
        </template>
        <template v-else>
          <component :is="opt.icon" v-if="opt.icon" class="h-4 w-4" />
          <span
            v-if="opt.label && collapse"
            class="grid"
            :class="labelMotion(opt)"
          >
            <span class="min-w-0 overflow-hidden">
              <span class="af-label block whitespace-nowrap pl-1.5 font-bold">{{ opt.label }}</span>
            </span>
          </span>
          <span v-else-if="opt.label" class="af-label">{{ opt.label }}</span>
          <span v-if="opt.count !== undefined" class="ml-1 opacity-60">{{
            opt.count
          }}</span>
        </template>
      </button>
    </template>
  </div>
</template>
