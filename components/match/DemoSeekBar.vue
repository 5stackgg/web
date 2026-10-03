<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Skull } from "lucide-vue-next";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useDemoPlayhead } from "~/composables/useDemoPlayhead";
import { formatClock, roundIndexAt } from "~/utilities/demoTickEstimate";

// The demo timeline. Built to stay off Vue's render path while the demo
// plays: the fill, thumb, clock and hover preview are written straight to
// the DOM from a rAF loop as transforms / textContent, so a playing demo
// costs a compositor update per frame rather than a component re-render
// (the old reka Slider re-rendered the whole controls bar on every
// thumb step and positioned the thumb with `left`, i.e. layout).
//
// Vue only renders the markers, and only when the kill list or filter
// changes.

const emit = defineEmits<{
  // The tick on screen — the playhead, or the drag position while
  // scrubbing. Fires per frame; listeners should only act on change.
  (e: "position", tick: number): void;
}>();

const { t } = useI18n();
const { store, seek, jumpToKillTick } = useDemoPlayback();

const trackEl = ref<HTMLDivElement | null>(null);
const fillEl = ref<HTMLDivElement | null>(null);
const thumbEl = ref<HTMLDivElement | null>(null);
const clockEl = ref<HTMLSpanElement | null>(null);
const hoverEl = ref<HTMLDivElement | null>(null);
const hoverLabelEl = ref<HTMLSpanElement | null>(null);

// Clicks this close to a round marker land on the round start.
const ROUND_SNAP_PX = 6;
// Movement under this is a click, not a drag.
const CLICK_SLOP_PX = 4;

const sortedRounds = computed(() =>
  store.roundTicks.slice().sort((a, b) => a.start_tick - b.start_tick),
);

const formattedTotal = computed(() => formatClock(store.totalSeconds));

function pct(tick: number) {
  const total = store.totalTicks;
  return total > 0 ? `${(tick / total) * 100}%` : "0%";
}

const roundMarkers = computed(() =>
  store.totalTicks > 0
    ? sortedRounds.value.map((r) => ({
        round: r.round,
        tick: r.start_tick,
        left: pct(r.start_tick),
      }))
    : [],
);

function nameFor(steamId: string | undefined): string | null {
  if (!steamId) return null;
  return store.playerNames[steamId] ?? `#${steamId.slice(-4)}`;
}
function killLabel(k: {
  killer?: string;
  victim?: string;
  headshot?: boolean;
  weapon?: string;
}) {
  const killer = nameFor(k.killer);
  const victim = nameFor(k.victim);
  const verb = k.headshot ? "headshot" : "killed";
  const weapon = k.weapon ? ` (${k.weapon})` : "";
  if (killer && victim) return `${killer} ${verb} ${victim}${weapon}`;
  if (victim) return `${victim} died${weapon}`;
  return k.headshot ? "Headshot kill" : "Kill";
}

// Kills shown on the rail respect the active player filter + mode
// (kills BY the player, or deaths OF the player). Downsampled so a
// 36-round match doesn't render hundreds.
const killMarkers = computed(() => {
  if (store.totalTicks <= 0) return [];
  const sid = store.killFilterSteamId;
  const kills = sid
    ? store.kills.filter((k) =>
        store.killFilterMode === "victim" ? k.victim === sid : k.killer === sid,
      )
    : store.kills;
  const stride = Math.max(1, Math.floor(kills.length / 80));
  const out: Array<{
    tick: number;
    left: string;
    victimTeam?: "ct" | "t";
    headshot: boolean;
    label: string;
  }> = [];
  for (let i = 0; i < kills.length; i += stride) {
    const k = kills[i];
    out.push({
      tick: k.tick,
      left: pct(k.tick),
      victimTeam: k.victim_team,
      headshot: !!k.headshot,
      label: killLabel(k),
    });
  }
  return out;
});

// ---- Painting -------------------------------------------------------

let paintedFraction = -1;
let paintedSecond = -1;

function paint(tick: number) {
  const total = store.totalTicks;
  const clamped = Math.max(0, Math.min(tick, total));
  const fraction = total > 0 ? clamped / total : 0;
  if (fraction !== paintedFraction) {
    paintedFraction = fraction;
    // Both wrappers span the track, so these are compositor-only.
    if (fillEl.value) fillEl.value.style.transform = `scaleX(${fraction})`;
    if (thumbEl.value) {
      thumbEl.value.style.transform = `translate3d(${fraction * 100}%,0,0)`;
    }
  }
  const second = store.tickRate > 0 ? Math.floor(clamped / store.tickRate) : 0;
  if (second !== paintedSecond) {
    paintedSecond = second;
    const label = formatClock(second);
    if (clockEl.value) clockEl.value.textContent = label;
    if (trackEl.value) {
      trackEl.value.setAttribute("aria-valuenow", String(clamped));
      trackEl.value.setAttribute("aria-valuetext", label);
    }
  }
  emit("position", clamped);
}

const { refresh } = useDemoPlayhead((tick) => {
  if (dragging) return;
  paint(tick);
});

// ---- Pointer --------------------------------------------------------

let dragging = false;
let dragTick = 0;
let downX = 0;
let rect: DOMRect | null = null;

function tickAtX(clientX: number) {
  if (!rect || rect.width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return Math.round(ratio * store.totalTicks);
}

function snapToRound(clientX: number, tick: number) {
  if (!rect || rect.width <= 0 || store.totalTicks <= 0) return tick;
  const pxPerTick = rect.width / store.totalTicks;
  let best = tick;
  let bestPx = ROUND_SNAP_PX + 1;
  for (const r of sortedRounds.value) {
    const px = Math.abs(rect.left + r.start_tick * pxPerTick - clientX);
    if (px < bestPx) {
      bestPx = px;
      best = r.start_tick;
    }
  }
  return best;
}

function showHover(clientX: number, tick: number) {
  const el = hoverEl.value;
  const label = hoverLabelEl.value;
  if (!el || !label || !rect || rect.width <= 0) return;
  const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  el.style.transform = `translate3d(${fraction * 100}%,0,0)`;
  el.style.opacity = "1";
  const idx = roundIndexAt(sortedRounds.value, tick);
  const clock = formatClock(store.tickRate > 0 ? tick / store.tickRate : 0);
  label.textContent =
    idx >= 0
      ? `${t("common.round", { number: sortedRounds.value[idx].round })} · ${clock}`
      : clock;
}

function hideHover() {
  if (hoverEl.value) hoverEl.value.style.opacity = "0";
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !trackEl.value || store.totalTicks <= 0) return;
  e.preventDefault();
  rect = trackEl.value.getBoundingClientRect();
  trackEl.value.setPointerCapture?.(e.pointerId);
  dragging = true;
  downX = e.clientX;
  dragTick = tickAtX(e.clientX);
  paint(dragTick);
  showHover(e.clientX, dragTick);
}

function onPointerMove(e: PointerEvent) {
  if (!trackEl.value || store.totalTicks <= 0) return;
  if (!dragging) rect = trackEl.value.getBoundingClientRect();
  const tick = tickAtX(e.clientX);
  if (dragging) {
    dragTick = tick;
    paint(dragTick);
  }
  // Touch has no hover; only show the preview while a finger drags.
  if (e.pointerType !== "touch" || dragging) showHover(e.clientX, tick);
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  const isClick = Math.abs(e.clientX - downX) < CLICK_SLOP_PX;
  const target = isClick ? snapToRound(e.clientX, dragTick) : dragTick;
  paint(target);
  seek(target);
  if (e.pointerType === "touch") hideHover();
}

function onPointerCancel() {
  if (!dragging) return;
  dragging = false;
  hideHover();
  // Put the thumb back on the real playhead.
  refresh();
}

function onPointerLeave() {
  if (!dragging) hideHover();
}

onMounted(() => {
  paint(store.tickNow());
});

onBeforeUnmount(() => {
  dragging = false;
});
</script>

<template>
  <div class="flex items-center gap-4">
    <!-- Doubles as the seek-settle indicator — a settling gototick
         freezes the video, which reads as a hang without feedback.
         Text is written by paint(), not Vue. -->
    <span
      ref="clockEl"
      class="font-mono text-sm tabular-nums min-w-[3.5rem] text-right"
      :class="
        store.seeking
          ? 'text-[hsl(var(--tac-amber))] animate-pulse'
          : 'text-muted-foreground'
      "
      :title="store.seeking ? $t('match.demo_playback.seeking') : undefined"
    />

    <div class="flex-1 relative">
      <!-- Skull rail — two-tone by victim team. Clicks go through
           jumpToKillTick so the N/P anchor tracks the clicked kill. -->
      <div class="relative h-4 mb-1 pointer-events-none">
        <button
          v-for="m in killMarkers"
          :key="`s-${m.tick}`"
          type="button"
          :style="{ left: m.left }"
          class="absolute bottom-0 -translate-x-1/2 pointer-events-auto cursor-pointer transition-colors duration-100"
          :class="
            m.victimTeam === 'ct'
              ? 'text-blue-400 hover:text-blue-200'
              : m.victimTeam === 't'
                ? 'text-amber-400 hover:text-amber-200'
                : 'text-red-400/70 hover:text-red-300'
          "
          :title="$t('match.demo_playback.click_to_jump', { label: m.label })"
          :aria-label="m.label"
          @click="jumpToKillTick(m.tick)"
        >
          <Skull
            :class="m.headshot ? 'h-4 w-4' : 'h-3 w-3'"
            :stroke-width="m.headshot ? 3 : 2.25"
          />
        </button>
      </div>

      <div
        ref="trackEl"
        role="slider"
        tabindex="0"
        :aria-label="$t('ui_extras.seek')"
        aria-valuemin="0"
        :aria-valuemax="store.totalTicks"
        class="relative h-6 cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @lostpointercapture="onPointerCancel"
        @pointerleave="onPointerLeave"
      >
        <div
          class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 overflow-hidden rounded-full bg-primary/20"
        >
          <div
            ref="fillEl"
            class="absolute inset-0 origin-left bg-primary will-change-transform"
            style="transform: scaleX(0)"
          />
        </div>

        <div
          class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 pointer-events-none"
          aria-hidden="true"
        >
          <span
            v-for="m in roundMarkers"
            :key="`r-${m.round}`"
            :style="{ left: m.left }"
            class="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[hsl(var(--tac-amber))]"
          />
        </div>

        <!-- Thumb: the wrapper spans the track, so translateX(n%) is n% of
             the track. -->
        <div
          ref="thumbEl"
          class="absolute inset-x-0 top-1/2 h-0 pointer-events-none will-change-transform"
          aria-hidden="true"
        >
          <span
            class="absolute left-0 top-0 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
          />
        </div>

        <!-- Hover / scrub preview. -->
        <div
          ref="hoverEl"
          class="absolute inset-x-0 bottom-full h-0 pointer-events-none opacity-0 will-change-transform"
          aria-hidden="true"
        >
          <span
            ref="hoverLabelEl"
            class="absolute bottom-1 left-0 -translate-x-1/2 whitespace-nowrap rounded-[3px] border border-white/[0.09] bg-[#0c0c0f] px-1.5 py-0.5 font-mono text-[0.68rem] tabular-nums text-foreground shadow-[0_8px_20px_-8px_rgba(0,0,0,0.9)]"
          />
        </div>
      </div>
    </div>

    <span
      class="font-mono text-sm tabular-nums text-muted-foreground min-w-[3.5rem]"
    >
      {{ formattedTotal }}
    </span>
  </div>
</template>
