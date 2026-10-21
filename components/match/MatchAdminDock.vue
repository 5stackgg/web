<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ChevronUp, GripHorizontal, Shield } from "lucide-vue-next";
import MatchAdminSteps from "~/components/match/MatchAdminSteps.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// The admin dock's bar: where the match is, what to do now, and the console
// under it. The match page fills it with the real controls; the FAQ's demo
// match fills it with its own.
defineProps<{
  match: Record<string, any>;
  // The server takes commands, so the ADMIN chip lights up.
  controllable?: boolean;
}>();

defineSlots<{
  actions(props: { compact: boolean }): any;
  console(): any;
}>();

const open = ref(false);

const panelHeight = ref(240);
const dragging = ref(false);
const MIN_HEIGHT = 120;

function maxHeight() {
  return Math.round(window.innerHeight * 0.9);
}

let activeMove: ((ev: MouseEvent) => void) | null = null;
let activeUp: (() => void) | null = null;

function stopDrag() {
  if (activeMove) document.removeEventListener("mousemove", activeMove);
  if (activeUp) document.removeEventListener("mouseup", activeUp);
  activeMove = null;
  activeUp = null;
  dragging.value = false;
}

function startDrag(e: MouseEvent) {
  e.preventDefault();
  stopDrag();
  dragging.value = true;
  const startY = e.clientY;
  const startHeight = panelHeight.value;

  activeMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY;
    panelHeight.value = Math.max(
      MIN_HEIGHT,
      Math.min(maxHeight(), startHeight + delta),
    );
  };
  activeUp = () => stopDrag();

  document.addEventListener("mousemove", activeMove);
  document.addEventListener("mouseup", activeUp);
}

// The dock spans the content column, which a pinned chat or the hub can
// narrow at any screen size, so it fits itself to its own width: the
// fullest layout that does not overlap. The steps drop to the current one's
// label first, then the controls to icons (labels as tooltips), and last the
// steps go.
const FITS = ["full", "steps", "icons", "tight"] as const;
const fit = ref<(typeof FITS)[number]>("full");
const compact = computed(() => fit.value === "icons" || fit.value === "tight");
const rowEl = ref<HTMLElement | null>(null);
const leftEl = ref<HTMLElement | null>(null);
const actionsEl = ref<HTMLElement | null>(null);

const overflows = () => {
  const row = rowEl.value;
  const left = leftEl.value;
  if (!row) return false;
  return (
    row.scrollWidth > row.clientWidth + 1 ||
    (!!left && left.scrollWidth > left.clientWidth + 1)
  );
};

// Each try renders before the next frame paints, so only the one that fits
// is ever seen.
let fitting = false;
async function refit() {
  if (fitting || !rowEl.value) return;
  fitting = true;
  try {
    for (const next of FITS) {
      fit.value = next;
      await nextTick();
      if (!overflows()) break;
    }
  } finally {
    fitting = false;
  }
}

// The row's width, and the controls' (a step's own action comes and goes).
let fitObserver: ResizeObserver | undefined;
function observe(el: HTMLElement | null) {
  if (el) fitObserver?.observe(el);
}
function setRow(el: unknown) {
  rowEl.value = (el as HTMLElement) ?? null;
  observe(rowEl.value);
}
function setActions(el: unknown) {
  actionsEl.value = (el as HTMLElement) ?? null;
  observe(actionsEl.value);
}
if (typeof ResizeObserver !== "undefined") {
  fitObserver = new ResizeObserver(() => void refit());
}

onMounted(() => {
  panelHeight.value = Math.round(window.innerHeight * 0.45);
});

onBeforeUnmount(() => {
  fitObserver?.disconnect();
  stopDrag();
});
</script>

<template>
  <div
    class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
  >
    <div
      v-show="open"
      class="group h-2 cursor-ns-resize bg-border hover:bg-[hsl(var(--tac-amber)/0.4)] transition-colors flex items-center justify-center"
      @mousedown="startDrag"
    >
      <GripHorizontal
        class="w-4 h-4 text-muted-foreground/60 group-hover:text-[hsl(var(--tac-amber))] transition-colors pointer-events-none"
      />
    </div>

    <!-- Three regions: where the match is (ADMIN + steps), what to do now
         (Veto Override and the match actions), and the console expander.
         Clicking the first region also opens the console; the chevron is the
         labeled control, since the steps carry their own tooltips. All three
         shade off the shared `group` rather than their own :hover. -->
    <div
      :ref="setRow"
      class="group flex items-stretch"
      :class="dragging && 'select-none'"
    >
      <div
        ref="leftEl"
        class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pl-4 pr-2 py-2 group-hover:bg-muted/40 transition-colors duration-200 ease-out"
        @click="open = !open"
      >
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase border rounded transition-colors duration-200 ease-out"
          :class="
            controllable
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-muted/40 text-muted-foreground'
          "
        >
          <Shield class="w-3 h-3" />
          <span :class="fit === 'tight' && 'sr-only'">{{
            $t("match.admin")
          }}</span>
        </div>

        <MatchAdminSteps
          v-show="fit !== 'tight'"
          :match="match"
          :labels="fit === 'full' ? 'all' : 'current'"
        />
      </div>

      <div
        :ref="setActions"
        class="flex shrink-0 items-center gap-2 px-2 group-hover:bg-muted/40 transition-colors duration-200 ease-out empty:hidden"
      >
        <slot name="actions" :compact="compact" />
      </div>

      <FiveStackToolTip
        as-child
        side="top"
        :delay-duration="120"
        :tap-toggle="false"
      >
        <template #trigger>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 pl-2 pr-4 py-2 text-xs text-muted-foreground group-hover:bg-muted/40 transition-colors duration-200 ease-out"
            :aria-expanded="open"
            :aria-label="
              open
                ? $t('match.admin_bar.hide_console')
                : $t('match.admin_bar.show_console')
            "
            @click="open = !open"
          >
            <ChevronUp
              class="w-4 h-4 transition-transform duration-300 ease-out"
              :class="open ? 'rotate-180' : 'rotate-0'"
            />
          </button>
        </template>
        {{
          open
            ? $t("match.admin_bar.hide_console")
            : $t("match.admin_bar.show_console")
        }}
      </FiveStackToolTip>
    </div>

    <div
      class="overflow-hidden"
      :class="[
        !dragging && 'transition-[height] duration-300 ease-out',
        open && 'border-t',
      ]"
      :style="{ height: open ? `${panelHeight}px` : '0px' }"
    >
      <slot name="console" />
    </div>
  </div>
</template>
