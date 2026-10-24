<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronLeft, ChevronRight, Clock, Skull } from "lucide-vue-next";
import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";
import {
  canRewindTo,
  sidesIn,
  type RewindRound,
  type RewindRounds,
} from "~/utilities/rewind";
import { faqHotClasses } from "~/utilities/faqClasses";

const props = defineProps<{
  data: RewindRounds;
  lineup1: string;
  lineup2: string;
  rewinding?: boolean;
  target?: number | null;
  canRewind?: boolean;
  hot?: "playhead";
}>();

const emit = defineEmits<{ "update:target": [number] }>();

const { t } = useI18n();

type Column = {
  round: number;
  row?: RewindRound;
  state: "played" | "live" | "undone" | "future";
  selectable: boolean;
};

const lastUndone = computed(
  () => props.data.rounds.filter((row) => row.undone).at(-1)?.round ?? 0,
);

const columns = computed<Column[]>(() => {
  const live = props.data.live_round;
  const count = Math.max(props.data.regulation, live, lastUndone.value);
  const rows = new Map(props.data.rounds.map((row) => [row.round, row]));
  return Array.from({ length: count }, (_, index) => {
    const round = index + 1;
    const row = rows.get(round);
    const state: Column["state"] =
      round === live && !props.data.finished
        ? "live"
        : row?.undone
          ? "undone"
          : row && round <= live
            ? "played"
            : "future";
    return {
      round,
      row,
      state,
      selectable:
        round <= Math.max(live, lastUndone.value + 1) &&
        canRewindTo(props.data, round),
    };
  });
});

const selectable = computed(() =>
  columns.value.filter((column) => column.selectable).map((c) => c.round),
);

const sidesNow = computed(() => {
  const at =
    props.rewinding && props.target ? props.target : props.data.live_round;
  return sidesIn(props.data, at);
});

function step(by: number, focus = false) {
  const list = selectable.value;
  const from = props.target ?? props.data.live_round;
  const next =
    by < 0
      ? list.filter((round) => round < from).at(by)
      : list.filter((round) => round > from).at(by - 1);
  if (!next) {
    return;
  }
  emit("update:target", next);
  if (focus) {
    void nextTick(() =>
      track.value
        ?.querySelector<HTMLElement>(`[data-round="${next}"]`)
        ?.focus(),
    );
  }
}

const canStepBack = computed(
  () =>
    selectable.value[0] !== undefined &&
    (props.target ?? 0) > selectable.value[0],
);
const canStepForward = computed(
  () => (props.target ?? 0) < (selectable.value.at(-1) ?? 0),
);

function onKeydown(event: KeyboardEvent) {
  if (!props.canRewind) {
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    step(event.key === "ArrowLeft" ? -1 : 1, true);
  }
}

function wonBy(row: RewindRound | undefined, lineup: 1 | 2) {
  if (!row?.winning_side) {
    return false;
  }
  return (
    row.winning_side === (lineup === 1 ? row.lineup_1_side : row.lineup_2_side)
  );
}

function cellClass(column: Column, lineup: 1 | 2) {
  if (column.state === "live") {
    return "border border-dashed border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)]";
  }
  if (column.state === "future") {
    return "bg-muted/20";
  }
  if (!wonBy(column.row, lineup)) {
    return "bg-black/30 ring-1 ring-inset ring-border/30";
  }
  if (column.row?.winning_side === e_sides_enum.CT) {
    return "bg-sky-500/15 ring-1 ring-inset ring-sky-400/50 shadow-[inset_0_-2px_0_0_theme(colors.sky.400)]";
  }
  return "bg-amber-500/15 ring-1 ring-inset ring-amber-400/50 shadow-[inset_0_-2px_0_0_theme(colors.amber.400)]";
}

function sideTextClass(side?: e_sides_enum | null) {
  if (side === e_sides_enum.CT) return "text-sky-300";
  if (side === e_sides_enum.TERRORIST) return "text-amber-300";
  return "text-muted-foreground";
}

function sideDotClass(side?: e_sides_enum | null) {
  if (side === e_sides_enum.CT)
    return "bg-sky-400 shadow-[0_0_6px_theme(colors.sky.400)]";
  return "bg-amber-400 shadow-[0_0_6px_theme(colors.amber.400)]";
}

function reasonSvg(reason?: e_winning_reasons_enum | null) {
  if (reason === e_winning_reasons_enum.BombExploded) {
    return "/img/equipment/explosion.svg";
  }
  if (reason === e_winning_reasons_enum.BombDefused) {
    return "/img/equipment/defuser.svg";
  }
  return null;
}

function struck(column: Column) {
  return (
    props.rewinding &&
    !!props.target &&
    column.round >= props.target &&
    (column.state === "played" || column.state === "live")
  );
}

function columnLabel(column: Column) {
  return props.canRewind && column.selectable
    ? t("match.rewind.restore_from_round", { round: column.round })
    : t("common.round", { number: column.round });
}

const roomy = computed(() => props.canRewind || props.rewinding);

const scroller = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);
const playheadX = ref<number | null>(null);
const gliding = ref(false);

const label = ref<HTMLElement | null>(null);
const labelShift = ref(0);

function measure() {
  const column = track.value?.querySelector<HTMLElement>(
    `[data-round="${props.target}"]`,
  );
  playheadX.value =
    props.rewinding && props.target && column ? column.offsetLeft : null;
  void nextTick(clampLabel);
}

// The strip scrolls sideways and clips whatever hangs past its visible edges,
// so the label is kept inside what is showing rather than centred on the line.
function clampLabel() {
  const container = scroller.value;
  if (!container || !label.value || playheadX.value === null) {
    return;
  }
  const width = label.value.offsetWidth;
  const line = (track.value?.offsetLeft ?? 0) + playheadX.value - 3;
  const left = container.scrollLeft + 2;
  const right = container.scrollLeft + container.clientWidth - width - 2;
  labelShift.value =
    Math.min(Math.max(line - width / 2, left), Math.max(left, right)) - line;
}

watch(
  () => [props.rewinding, props.target] as const,
  async () => {
    const appearing = playheadX.value === null;
    await nextTick();
    if (appearing) {
      gliding.value = false;
    }
    measure();
    if (appearing && import.meta.client) {
      requestAnimationFrame(() => (gliding.value = true));
    }
  },
  { immediate: true },
);

let trackObserver: ResizeObserver | undefined;
watch(track, (element) => {
  trackObserver?.disconnect();
  if (element && typeof ResizeObserver !== "undefined") {
    trackObserver = new ResizeObserver(() => measure());
    trackObserver.observe(element);
  }
});
onBeforeUnmount(() => trackObserver?.disconnect());

function hatchDelay(column: Column) {
  if (!struck(column) || !props.target) {
    return "0ms";
  }
  return `${Math.min((column.round - props.target) * 14, 220)}ms`;
}

watch(
  () => [props.rewinding, props.target] as const,
  async ([rewinding]) => {
    if (!rewinding) {
      return;
    }
    await nextTick();
    const container = scroller.value;
    const column = container?.querySelector<HTMLElement>(
      '[aria-current="step"]',
    );
    if (
      !container ||
      !column ||
      container.scrollWidth <= container.clientWidth
    ) {
      return;
    }
    container.scrollTo({
      left:
        column.offsetLeft - container.clientWidth / 2 + column.offsetWidth / 2,
      behavior: "smooth",
    });
  },
  { immediate: true },
);

const showsHalf = (round: number) => round === props.data.halftime + 1;
</script>

<template>
  <div
    class="relative rounded-md border bg-gradient-to-b from-background/70 to-background/20 transition-[border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none"
    :class="
      rewinding
        ? 'border-[hsl(var(--tac-amber)/0.6)] shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.08)]'
        : 'border-border/50'
    "
  >
    <div
      class="flex items-stretch gap-2 rounded-md px-2.5 pb-2.5 pt-2.5"
      role="group"
      :aria-label="$t('match.rewind.strip_label')"
      @keydown="onKeydown"
    >
      <button
        v-if="roomy"
        type="button"
        class="mt-7 grid w-7 shrink-0 place-items-center self-center rounded-md border border-border bg-background/60 py-5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        :disabled="!canRewind || (!!target && !canStepBack)"
        :aria-label="$t('match.rewind.previous_round')"
        @click="step(-1)"
      >
        <ChevronLeft class="size-4" />
      </button>

      <div
        class="flex w-[4.5rem] shrink-0 flex-col justify-between pb-0.5"
        :class="roomy ? 'pt-[1.875rem]' : 'pt-0.5'"
      >
        <div class="flex h-6 items-center gap-1.5">
          <span
            class="size-1.5 shrink-0 rounded-full"
            :class="sideDotClass(sidesNow.lineup1)"
          />
          <span
            class="truncate text-[10px] font-bold uppercase leading-none tracking-wider"
            :class="sideTextClass(sidesNow.lineup1)"
          >
            {{ lineup1 }}
          </span>
        </div>
        <span class="text-right font-mono text-[9px] text-muted-foreground/60"
          >RD</span
        >
        <div class="flex h-6 items-center gap-1.5">
          <span
            class="size-1.5 shrink-0 rounded-full"
            :class="sideDotClass(sidesNow.lineup2)"
          />
          <span
            class="truncate text-[10px] font-bold uppercase leading-none tracking-wider"
            :class="sideTextClass(sidesNow.lineup2)"
          >
            {{ lineup2 }}
          </span>
        </div>
      </div>

      <div
        ref="scroller"
        @scroll.passive="clampLabel"
        class="relative min-w-0 flex-1 overflow-x-auto"
        :class="roomy ? 'pt-7' : ''"
      >
        <div
          ref="track"
          class="relative flex min-w-[32rem] items-stretch gap-[3px]"
        >
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0"
            leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
            leave-to-class="opacity-0"
          >
            <span
              v-if="rewinding && target && playheadX !== null"
              aria-hidden="true"
              class="pointer-events-none absolute -bottom-1 -top-7 left-0 z-20 w-0.5 rounded bg-[hsl(var(--tac-amber))] shadow-[0_0_10px_hsl(var(--tac-amber)/0.6)]"
              :class="[
                gliding &&
                  'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
                hot === 'playhead' && faqHotClasses,
              ]"
              :style="{ transform: `translateX(${playheadX - 3}px)` }"
            >
              <span
                ref="label"
                class="absolute left-0 top-0 whitespace-nowrap rounded-sm bg-[hsl(var(--tac-amber))] px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-black"
                :class="
                  gliding &&
                  'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
                "
                :style="{ transform: `translateX(${labelShift}px)` }"
              >
                {{ $t("match.rewind.start_of", { round: target }) }}
              </span>
            </span>
          </Transition>
          <template v-for="column in columns" :key="column.round">
            <div
              v-if="showsHalf(column.round)"
              class="flex shrink-0 items-center px-0.5"
              aria-hidden="true"
            >
              <span
                class="rotate-180 font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground/60"
                style="writing-mode: vertical-rl"
              >
                {{ $t("match.rewind.half") }}
              </span>
            </div>
            <button
              type="button"
              class="group relative flex min-w-[14px] flex-1 flex-col items-stretch gap-[6px] rounded-[4px] py-0.5 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))] disabled:cursor-default"
              :class="[
                canRewind &&
                  column.selectable &&
                  'cursor-pointer hover:bg-[hsl(var(--tac-amber)/0.08)]',
                column.state === 'undone' && 'opacity-45',
              ]"
              :disabled="!canRewind || !column.selectable"
              :data-round="column.round"
              :aria-label="columnLabel(column)"
              :aria-current="
                rewinding && column.round === target ? 'step' : undefined
              "
              :title="columnLabel(column)"
              @click="emit('update:target', column.round)"
            >
              <span
                v-if="
                  canRewind &&
                  column.selectable &&
                  !(rewinding && column.round === target)
                "
                aria-hidden="true"
                class="pointer-events-none absolute -bottom-1 -left-[3px] -top-2 z-10 w-0.5 rounded bg-[hsl(var(--tac-amber)/0.5)] opacity-0 transition-opacity duration-100 group-hover:opacity-100 motion-reduce:transition-none"
              />
              <span
                v-for="lineup in [1, 2] as const"
                :key="lineup"
                class="flex h-6 items-center justify-center rounded-[3px]"
                :class="[cellClass(column, lineup), lineup === 2 && 'order-3']"
              >
                <template
                  v-if="
                    column.state !== 'live' &&
                    column.state !== 'future' &&
                    wonBy(column.row, lineup)
                  "
                >
                  <span
                    v-if="reasonSvg(column.row?.winning_reason)"
                    class="reason-mask inline-block size-3 bg-current"
                    :class="sideTextClass(column.row?.winning_side)"
                    :style="{
                      maskImage: `url(${reasonSvg(column.row?.winning_reason)})`,
                      WebkitMaskImage: `url(${reasonSvg(column.row?.winning_reason)})`,
                    }"
                  />
                  <component
                    :is="
                      column.row?.winning_reason ===
                      e_winning_reasons_enum.TimeRanOut
                        ? Clock
                        : Skull
                    "
                    v-else
                    class="size-3"
                    :class="sideTextClass(column.row?.winning_side)"
                    :stroke-width="2.25"
                  />
                </template>
              </span>
              <span
                class="order-2 rounded-sm border text-center font-mono text-[9px] tabular-nums leading-[14px]"
                :class="
                  column.state === 'live'
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                    : 'border-border/60 bg-card text-muted-foreground/80'
                "
              >
                {{ String(column.round).padStart(2, "0") }}
              </span>
              <span
                v-if="column.state === 'played' || column.state === 'live'"
                aria-hidden="true"
                class="rewind-hatch pointer-events-none absolute inset-0 rounded-[4px] transition-opacity duration-200 ease-out motion-reduce:transition-none"
                :class="struck(column) ? 'opacity-100' : 'opacity-0'"
                :style="{ transitionDelay: hatchDelay(column) }"
              />
            </button>
          </template>
        </div>
      </div>

      <button
        v-if="roomy"
        type="button"
        class="mt-7 grid w-7 shrink-0 place-items-center self-center rounded-md border border-border bg-background/60 py-5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        :disabled="!canRewind || (!!target && !canStepForward)"
        :aria-label="$t('match.rewind.next_round')"
        @click="step(1)"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.reason-mask {
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

.rewind-hatch {
  background-color: hsl(var(--background) / 0.55);
  background-image: repeating-linear-gradient(
    -45deg,
    hsl(var(--tac-amber) / 0.28) 0 2px,
    transparent 2px 6px
  );
}
</style>
