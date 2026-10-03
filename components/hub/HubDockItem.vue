<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useHoverIntent } from "~/composables/useHoverIntent";
import { dockSettleMs, DOCK_TOLERANCE_PX } from "~/composables/useDockIntent";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { badgePopTransition } from "~/utilities/badgeCount";

// One app in the hub dock. It rests as a circle and squares off when hovered or
// open, without changing size -- an enlarging dock was tried and felt wrong.
// The bar on the dock's inner edge carries the state: short when something is
// new, taller under the pointer, tall and amber for the open panel.
const props = withDefaults(
  defineProps<{
    label: string;
    detail?: string | null;
    active?: boolean;
    unread?: boolean;
    disabled?: boolean;
    badge?: string | null;
    // red: needs an answer. fresh: new since you last looked, not urgent.
    // neutral: a standing count.
    badgeTone?: "red" | "fresh" | "neutral";
    pip?: boolean;
    tone?: "default" | "voice";
    ring?: boolean;
    caption?: string | null;
    captionTone?: "amber" | "green";
    avatar?: boolean;
    // The conversation you are reading inside the open Chat app: marked apart
    // from the app's own amber, so the dock never shows two "open" states.
    current?: boolean;
    // Sits inside the Chat group's background: when it squares off, its
    // corners follow the group's (outer radius minus the gap) instead of
    // fighting them.
    nested?: boolean;
    // The hub is open but not pinned, so it goes away when the pointer leaves:
    // the icon is outlined. Filled is kept for a pinned hub, which stays.
    preview?: boolean;
    // When a fresh badge is about one person, their picture (ringed in white)
    // takes the count's place.
    face?: { key: string; src?: string | null; initials: string } | null;
    // Bumped by the parent each time something new arrives.
    announce?: number;
  }>(),
  {
    detail: null,
    badge: null,
    badgeTone: "red",
    tone: "default",
    caption: null,
    captionTone: "amber",
  },
);

const emit = defineEmits<{ (e: "select"): void; (e: "intent"): void }>();

// Resting the mouse on an icon is a request too: the hub decides what it means
// (peek when closed, switch when open). Passing over it is not.
const intent = useHoverIntent(
  () => {
    if (!props.disabled) emit("intent");
  },
  { interval: dockSettleMs, sensitivity: DOCK_TOLERANCE_PX },
);

// A fresh badge or face rings once per arrival, so it gets noticed without
// nagging afterwards. The ring lives only briefly after each bump, so a badge
// that merely changes shape (two arrivals down to one face) doesn't ring again.
const ringing = ref(0);
let ringTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.announce,
  (value) => {
    if (!value) return;
    ringing.value = value;
    if (ringTimer) clearTimeout(ringTimer);
    ringTimer = setTimeout(() => {
      ringing.value = 0;
    }, 2200);
  },
);
onBeforeUnmount(() => {
  if (ringTimer) clearTimeout(ringTimer);
});

const ariaLabel = computed(() =>
  props.detail ? `${props.label}, ${props.detail}` : props.label,
);

const barClass = computed(() => {
  if (props.active) {
    return props.preview
      ? "h-5 bg-[hsl(var(--tac-amber)/0.6)]"
      : "h-8 bg-[hsl(var(--tac-amber))]";
  }
  if (props.disabled) {
    return "h-0";
  }
  return props.unread
    ? "h-2 bg-zinc-100 group-hover/dock:h-5"
    : "h-0 bg-zinc-100 group-hover/dock:h-5";
});

const buttonClass = computed(() => [
  "relative grid place-items-center transition-[border-radius,background-color,color,border-color,box-shadow,transform] active:scale-[0.96] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]",
  tileClass.value,
]);

const tileClass = computed(() => {
  if (props.avatar) {
    const square = props.nested ? "rounded-[14px]" : "rounded-[10px]";
    return [
      "size-[34px] overflow-hidden",
      props.active
        ? `${square} shadow-[0_0_0_2px_#1e1e22,0_0_0_3.5px_hsl(var(--tac-amber))]`
        : props.current
          ? `${square} shadow-[0_0_0_2px_#1e1e22,0_0_0_3.5px_rgba(244,244,245,0.85)]`
          : props.nested
            ? "rounded-full group-hover/dock:rounded-[14px]"
            : "rounded-full group-hover/dock:rounded-[10px]",
    ];
  }

  if (props.active && props.preview) {
    return `size-10 ${props.nested ? "rounded-2xl" : "rounded-xl"} border border-[hsl(var(--tac-amber)/0.6)] bg-[linear-gradient(180deg,#46464e,#2e2e33)] text-[hsl(var(--tac-amber))] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`;
  }

  if (props.active) {
    return `size-10 ${props.nested ? "rounded-2xl" : "rounded-xl"} border border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] [background:linear-gradient(135deg,var(--tac-amber-cta-from)_0%,hsl(var(--tac-amber))_50%,var(--tac-amber-cta-to)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_-8px_hsl(var(--tac-amber)/0.7)]`;
  }

  const base =
    "size-10 rounded-[20px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]";

  if (props.disabled) {
    return `${base} cursor-not-allowed border-white/[0.05] bg-zinc-900/60 text-zinc-600`;
  }

  if (props.tone === "voice") {
    return [
      base,
      "border-emerald-400/45 bg-[linear-gradient(180deg,#123a2c,#0b1f18)] text-emerald-400 group-hover/dock:rounded-xl",
      props.ring
        ? "shadow-[0_0_0_2px_#1e1e22,0_0_0_3.5px_rgb(52_211_153)]"
        : "",
    ];
  }

  const hoverSquare = props.nested
    ? "group-hover/dock:rounded-2xl"
    : "group-hover/dock:rounded-xl";

  return `${base} ${hoverSquare} border-white/[0.07] bg-[linear-gradient(180deg,#34343a,#242428)] text-zinc-300 group-hover/dock:border-white/10 group-hover/dock:bg-[linear-gradient(180deg,#46464e,#2e2e33)] group-hover/dock:text-white`;
});
</script>

<template>
  <div
    class="group/dock relative z-[1] flex w-full flex-col items-center gap-1"
    @pointerenter="intent.onPointerEnter"
    @pointermove="intent.onPointerMove"
    @pointerleave="intent.onPointerLeave"
  >
    <div class="relative flex w-full justify-center">
      <span
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full transition-[height,background-color] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        :class="barClass"
      />

      <span class="relative inline-flex">
        <button
          type="button"
          :disabled="disabled"
          :aria-label="ariaLabel"
          :aria-current="active ? 'true' : undefined"
          :class="buttonClass"
          @click="emit('select')"
        >
          <slot />
        </button>

        <Transition v-bind="badgePopTransition">
          <span
            v-if="badge && !face"
            class="pointer-events-none absolute -right-2 -top-1.5 z-[2] inline-flex h-4 min-w-4 origin-center items-center justify-center rounded-full px-1 text-[0.6rem] font-bold leading-none tabular-nums shadow-[0_0_0_2px_#1e1e22] transition-colors [transition-duration:240ms] motion-reduce:![transition-duration:1ms]"
            :class="
              badgeTone === 'red'
                ? 'bg-red-500 text-white'
                : badgeTone === 'fresh'
                  ? 'bg-zinc-50 text-zinc-950'
                  : 'bg-zinc-700 text-zinc-200'
            "
          >
            <span
              v-if="ringing && badgeTone === 'fresh'"
              :key="ringing"
              aria-hidden="true"
              class="absolute inset-0 -z-10 rounded-full bg-zinc-50 motion-safe:animate-[ping_1s_cubic-bezier(0,0,0.2,1)_2_forwards]"
            />
            <AnimatedStat :value="badge" />
          </span>
        </Transition>
        <Transition v-bind="badgePopTransition">
          <span
            v-if="face"
            :key="face.key"
            class="pointer-events-none absolute -right-2 -top-2 z-[2] size-[18px] origin-center rounded-full bg-zinc-700 shadow-[0_0_0_2px_#1e1e22,0_0_0_3.5px_#fafafa]"
          >
            <span
              v-if="ringing"
              :key="ringing"
              aria-hidden="true"
              class="absolute inset-0 -z-10 rounded-full bg-zinc-50 motion-safe:animate-[ping_1s_cubic-bezier(0,0,0.2,1)_2_forwards]"
            />
            <img
              v-if="face.src"
              :src="face.src"
              alt=""
              draggable="false"
              class="size-full select-none rounded-full object-cover"
            />
            <span
              v-else
              class="grid size-full place-items-center text-[0.45rem] font-bold text-zinc-100"
            >
              {{ face.initials }}
            </span>
          </span>
        </Transition>
        <Transition v-bind="badgePopTransition">
          <span
            v-if="pip && !badge && !face"
            class="pointer-events-none absolute -right-1 -top-0.5 z-[2] size-2.5 origin-center rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_0_2px_#1e1e22]"
          />
        </Transition>
      </span>
    </div>

    <span
      v-if="caption"
      class="text-[0.62rem] font-semibold leading-none tabular-nums"
      :class="
        captionTone === 'green'
          ? 'text-emerald-400'
          : 'text-[hsl(var(--tac-amber))]'
      "
    >
      {{ caption }}
    </span>
  </div>
</template>
