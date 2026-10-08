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
const btns = ref<Record<string, HTMLElement | null>>({});
const indicator = ref({ left: 0, top: 0, width: 0, height: 0, ready: false });
const animate = ref(false);

function setBtn(el: Element | null, key: string) {
  if (el) {
    btns.value[key] = el as HTMLElement;
  } else {
    delete btns.value[key];
  }
}

function updateIndicator() {
  const el = model.value ? btns.value[model.value] : null;
  if (!el || !containerRef.value || el.offsetWidth === 0) {
    indicator.value = { ...indicator.value, ready: false };
    animate.value = false;
    return;
  }
  const wasReady = indicator.value.ready;
  indicator.value = {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    ready: true,
  };
  if (!wasReady) {
    animate.value = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        animate.value = true;
      }),
    );
  }
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
  for (const [key, el] of Object.entries(btns.value)) {
    if (!el) {
      continue;
    }
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
    if (props.collapse && containerRef.value && indicator.value.ready) {
      before = measure();
      leaving = previous ?? null;
    }
  },
  { flush: "pre" },
);

async function swap() {
  const first = before;
  before = null;
  const key = model.value;
  if (
    !first ||
    !key ||
    !containerRef.value ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  const moving = [
    ...Object.values(btns.value),
    indicatorRef.value,
    ghostRef.value,
  ];
  for (const el of moving) {
    el?.getAnimations().forEach((animation) => animation.cancel());
  }
  const last = measure();
  // The indicator's own box has to be the picked tab's before it is played in
  // from somewhere else.
  await nextTick();

  const timing = { duration: SWAP_MS, easing: SWAP_EASE };
  const from = (start: Box, end: Box) => [
    {
      transform: `translateX(${start.left - end.left}px) scaleX(${start.width / end.width})`,
    },
    { transform: "none" },
  ];

  for (const [name, el] of Object.entries(btns.value)) {
    if (!el || !first[name] || !last[name]) {
      continue;
    }
    const shift = first[name].icon - last[name].icon;
    if (Math.abs(shift) > 0.5) {
      el.animate(
        [{ transform: `translateX(${shift}px)` }, { transform: "none" }],
        timing,
      );
    }
  }

  if (indicatorRef.value && first[key] && last[key]) {
    indicatorRef.value.animate(from(first[key], last[key]), timing);
  }

  const old = leaving;
  const tab = old ? btns.value[old] : null;
  if (ghostRef.value && old && tab && old !== key && first[old] && last[old]) {
    Object.assign(ghostRef.value.style, {
      left: `${tab.offsetLeft}px`,
      top: `${tab.offsetTop}px`,
      width: `${tab.offsetWidth}px`,
      height: `${tab.offsetHeight}px`,
    });
    ghostRef.value.animate(from(first[old], last[old]), timing);
    ghostRef.value.animate(
      [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }],
      { duration: SWAP_MS },
    );
  }

  // The label arrives once the pill has grown enough to be under it.
  btns.value[key]
    ?.querySelector(".af-label")
    ?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], {
      duration: SWAP_MS,
    });
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  nextTick(updateIndicator);
  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    ro = new ResizeObserver(() => updateIndicator());
    ro.observe(containerRef.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());

watch(
  () => [model.value, props.options.map((o) => o.key).join(",")],
  () =>
    nextTick(() => {
      updateIndicator();
      if (props.collapse) {
        void swap();
      }
    }),
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
      class="pointer-events-none absolute origin-left bg-[hsl(var(--tac-amber))] opacity-0"
      :class="indicatorShape"
    />
    <span
      ref="indicatorRef"
      class="pointer-events-none absolute origin-left bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_-2px_hsl(var(--tac-amber)/0.6)]"
      :class="[
        indicatorShape,
        indicator.ready ? 'opacity-100' : 'opacity-0',
        animate && !collapse
          ? 'transition-all [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
          : '',
      ]"
      :style="{
        left: `${indicator.left}px`,
        top: `${indicator.top}px`,
        width: `${indicator.width}px`,
        height: `${indicator.height}px`,
      }"
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
