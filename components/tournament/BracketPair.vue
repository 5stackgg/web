<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import TournamentBracketViewer from "./TournamentBracketViewer.vue";
import { useBracketView } from "~/composables/useBracketView";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  UnfoldVertical,
  FoldVertical,
  GripHorizontal,
} from "lucide-vue-next";

const props = defineProps<{
  stage: any;
  tournament: any;
  upperRounds: Map<number, any>;
  lowerRounds: Map<number, any> | null;
  isFinalStage: boolean;
  stageType: string | null;
  embed?: boolean;
  pageScroll?: boolean;
  hideFinishedRounds?: boolean;
  /** Stable key for persisting manual split ratio (e.g. "stage-id:division") */
  persistenceKey?: string;
}>();

const DIVIDER_HEIGHT = 14;
const MIN_PANEL = 180;

const { isFullscreen, bracketScope } = useBracketView();

const verticalReserve = computed(() => {
  if (isFullscreen.value) return 140;
  return props.embed ? 80 : 240;
});

const focused = ref<"wb" | "lb" | null>(null);
const manualRatio = ref<number | null>(null);

const viewportHeight = ref(
  typeof window !== "undefined" ? window.innerHeight : 900,
);

const updateViewport = () => {
  if (typeof window !== "undefined") {
    viewportHeight.value = window.innerHeight;
  }
};

onMounted(() => {
  if (typeof window === "undefined") return;
  window.addEventListener("resize", updateViewport);
  if (props.persistenceKey) {
    const stored = localStorage.getItem(`bracket-pair:${props.persistenceKey}`);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (Number.isFinite(parsed) && parsed > 0.05 && parsed < 0.95) {
        manualRatio.value = parsed;
      }
    }
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", updateViewport);
  }
});

watch(manualRatio, (value) => {
  if (!props.persistenceKey || typeof localStorage === "undefined") return;
  if (value == null) {
    localStorage.removeItem(`bracket-pair:${props.persistenceKey}`);
  } else {
    localStorage.setItem(`bracket-pair:${props.persistenceKey}`, String(value));
  }
});

const hasLB = computed(() => !!props.lowerRounds && props.lowerRounds.size > 0);

watch(
  [isFullscreen, focused, hasLB],
  () => {
    if (!isFullscreen.value) {
      bracketScope.value = null;
      return;
    }
    if (focused.value === "wb") bracketScope.value = "upper";
    else if (focused.value === "lb") bracketScope.value = "lower";
    else bracketScope.value = hasLB.value ? null : "upper";
  },
  { immediate: true },
);

onUnmounted(() => {
  bracketScope.value = null;
});

const wbMaxMatches = computed(() => {
  let max = 0;
  for (const [, round] of props.upperRounds) {
    if (round?.length > max) max = round.length;
  }
  return max || 1;
});

const lbMaxMatches = computed(() => {
  if (!props.lowerRounds) return 0;
  let max = 0;
  for (const [, round] of props.lowerRounds) {
    if (round?.length > max) max = round.length;
  }
  return max;
});

const proportionalRatio = computed(() => {
  if (!hasLB.value) return 1;
  const total = wbMaxMatches.value + lbMaxMatches.value;
  if (!total) return 0.5;
  return wbMaxMatches.value / total;
});

const effectiveRatio = computed(() => {
  if (!hasLB.value) return 1;
  if (focused.value === "wb") return 1;
  if (focused.value === "lb") return 0;
  return manualRatio.value ?? proportionalRatio.value;
});

const totalAvailable = computed(() =>
  Math.max(360, viewportHeight.value - verticalReserve.value),
);

const wbHeight = computed(() => {
  if (!hasLB.value) return totalAvailable.value;
  if (focused.value === "lb") return 48; // collapsed strip
  if (focused.value === "wb") return totalAvailable.value - 48;
  const usable = totalAvailable.value - DIVIDER_HEIGHT;
  return Math.max(MIN_PANEL, Math.round(usable * effectiveRatio.value));
});

const lbHeight = computed(() => {
  if (!hasLB.value) return 0;
  if (focused.value === "wb") return 48;
  if (focused.value === "lb") return totalAvailable.value - 48;
  const usable = totalAvailable.value - DIVIDER_HEIGHT;
  return Math.max(MIN_PANEL, usable - wbHeight.value);
});

const focusWB = () => {
  focused.value = focused.value === "wb" ? null : "wb";
};

const focusLB = () => {
  focused.value = focused.value === "lb" ? null : "lb";
};

const isDragging = ref(false);

const onDividerPointerDown = (e: MouseEvent) => {
  if (focused.value) return;
  isDragging.value = true;
  e.preventDefault();
  const startY = e.clientY;
  const startWB = wbHeight.value;
  const usable = totalAvailable.value - DIVIDER_HEIGHT;

  const move = (ev: MouseEvent) => {
    const dy = ev.clientY - startY;
    let next = startWB + dy;
    next = Math.max(MIN_PANEL, Math.min(usable - MIN_PANEL, next));
    manualRatio.value = next / usable;
  };

  const up = () => {
    isDragging.value = false;
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  document.body.style.userSelect = "none";
  document.body.style.cursor = "row-resize";
};

const resetRatio = () => {
  manualRatio.value = null;
};
</script>

<template>
  <div class="flex flex-col">
    <!-- Upper bracket section (sticky scope) -->
    <div :class="pageScroll && hasLB ? 'relative' : ''">
      <!-- Upper bracket header -->
      <div
        v-if="hasLB && focused !== 'lb'"
        class="mb-2 flex items-center justify-between gap-2 rounded-md border-l-2 border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.06)] px-3 py-1.5"
        :class="pageScroll ? 'sticky top-0 z-30 backdrop-blur-sm' : ''"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[hsl(var(--tac-amber))]"
        >
          <ArrowUpToLine class="h-3.5 w-3.5" />
          {{ $t("tournament.match.upper_bracket") }}
        </div>
        <button
          v-if="!embed && !pageScroll"
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.2)]"
          @click="focusWB"
          :title="
            focused === 'wb'
              ? $t('tournament.bracket.restore_split')
              : $t('tournament.bracket.focus_upper')
          "
        >
          <component
            :is="focused === 'wb' ? FoldVertical : UnfoldVertical"
            class="h-3.5 w-3.5"
          />
        </button>
      </div>

      <!-- WB collapsed strip (when focused on LB) -->
      <button
        v-if="hasLB && focused === 'lb'"
        type="button"
        class="group mb-2 flex h-[44px] w-full items-center justify-between gap-2 rounded-md border-l-2 border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] px-3 transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
        @click="focused = null"
        :title="$t('tournament.bracket.expand_button')"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[hsl(var(--tac-amber))]"
        >
          <ArrowUpToLine class="h-3.5 w-3.5" />
          {{ $t("tournament.match.upper_bracket") }}
          <span
            class="font-sans normal-case tracking-normal text-muted-foreground group-hover:text-[hsl(var(--tac-amber))]"
          >
            · {{ $t("tournament.bracket.click_to_expand") }}
          </span>
        </div>
        <span
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] transition-colors group-hover:bg-[hsl(var(--tac-amber)/0.2)]"
        >
          <UnfoldVertical class="h-3.5 w-3.5" />
        </span>
      </button>

      <TournamentBracketViewer
        v-if="focused !== 'lb'"
        :stage="stage"
        :tournament="tournament"
        :rounds="upperRounds"
        :is-final-stage="isFinalStage"
        :is-loser-bracket="false"
        :total-groups="hasLB ? 2 : 1"
        :stage-type="stageType"
        :embed="embed"
        :hide-finished-rounds="hideFinishedRounds"
        :page-scroll="pageScroll"
        :fit-height="pageScroll ? null : wbHeight"
        :sticky-top-offset="hasLB ? 44 : 0"
      />
    </div>

    <!-- Divider (only in split mode with both brackets visible) -->
    <div
      v-if="hasLB && focused === null && !pageScroll && !embed"
      class="group relative my-1 flex h-[14px] cursor-row-resize items-center justify-center"
      :class="isDragging ? 'bg-[hsl(var(--tac-amber)/0.15)]' : ''"
      @mousedown="onDividerPointerDown"
      @dblclick="resetRatio"
      :title="$t('tournament.bracket.divider_hint')"
    >
      <div class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div
        class="relative z-10 rounded-md border border-border bg-background px-2 py-0.5 text-muted-foreground group-hover:border-[hsl(var(--tac-amber)/0.55)] group-hover:text-[hsl(var(--tac-amber))] transition-colors"
      >
        <GripHorizontal class="h-3 w-3" />
      </div>
    </div>

    <!-- LB collapsed strip (when focused on WB) -->
    <button
      v-if="hasLB && focused === 'wb'"
      type="button"
      class="group mt-2 flex h-[44px] w-full items-center justify-between gap-2 rounded-md border-l-2 border border-destructive/55 bg-destructive/5 px-3 transition-colors hover:bg-destructive/10"
      @click="focused = null"
      :title="$t('tournament.bracket.expand_button')"
    >
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.24em] text-destructive"
      >
        <ArrowDownToLine class="h-3.5 w-3.5" />
        {{ $t("tournament.match.lower_bracket") }}
        <span
          class="font-sans normal-case tracking-normal text-muted-foreground group-hover:text-destructive"
        >
          · {{ $t("tournament.bracket.click_to_expand") }}
        </span>
      </div>
      <span
        class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive/20"
      >
        <UnfoldVertical class="h-3.5 w-3.5" />
      </span>
    </button>

    <!-- Lower bracket section (sticky scope) -->
    <div :class="pageScroll && hasLB ? 'relative' : ''">
      <!-- LB header (when LB is visible) -->
      <div
        v-if="hasLB && focused !== 'wb'"
        class="mb-2 flex items-center justify-between gap-2 rounded-md border-l-2 border-destructive bg-destructive/5 px-3 py-1.5"
        :class="pageScroll ? 'mt-10 sticky top-0 z-30 backdrop-blur-sm' : ''"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.24em] text-destructive"
        >
          <ArrowDownToLine class="h-3.5 w-3.5" />
          {{ $t("tournament.match.lower_bracket") }}
        </div>
        <button
          v-if="!embed && !pageScroll"
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
          @click="focusLB"
          :title="
            focused === 'lb'
              ? $t('tournament.bracket.restore_split')
              : $t('tournament.bracket.focus_lower')
          "
        >
          <component
            :is="focused === 'lb' ? FoldVertical : UnfoldVertical"
            class="h-3.5 w-3.5"
          />
        </button>
      </div>

      <TournamentBracketViewer
        v-if="hasLB && focused !== 'wb'"
        :stage="stage"
        :tournament="tournament"
        :rounds="lowerRounds as Map<number, any>"
        :is-final-stage="isFinalStage"
        :is-loser-bracket="true"
        :total-groups="2"
        :stage-type="stageType"
        :embed="embed"
        :hide-finished-rounds="hideFinishedRounds"
        :page-scroll="pageScroll"
        :fit-height="pageScroll ? null : lbHeight"
        :sticky-top-offset="44"
      />
    </div>
  </div>
</template>
