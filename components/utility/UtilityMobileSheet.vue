<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** Off, this is a plain column in the page; on, a sheet over the map. */
  enabled: boolean;
}>();

const { t } = useI18n();

// Two heights, not a free drag: half leaves the map readable above the sheet so
// a tap on a spot and the list it filters are on screen together, and full is
// for reading the list. Anything in between is a sheet you have to tidy.
const expanded = ref(false);

// Leaving the phone layout (rotating a tablet) must not strand the next visit
// at full height over a map you never saw.
watch(
  () => props.enabled,
  (on) => {
    if (!on) {
      expanded.value = false;
    }
  },
);

const DRAG_THRESHOLD = 40;
let dragStart: number | null = null;
let dragged = false;

function onPointerDown(event: PointerEvent) {
  dragStart = event.clientY;
  dragged = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (dragStart === null) {
    return;
  }
  const delta = event.clientY - dragStart;
  if (Math.abs(delta) < DRAG_THRESHOLD) {
    return;
  }
  expanded.value = delta < 0;
  dragged = true;
  dragStart = null;
}

function onPointerUp() {
  dragStart = null;
}

// A drag already decided; only a plain tap toggles, or every drag would undo
// itself on release.
function onClick() {
  if (dragged) {
    dragged = false;
    return;
  }
  expanded.value = !expanded.value;
}

const handleLabel = computed(() =>
  expanded.value
    ? t("pages.utility.sheet.collapse")
    : t("pages.utility.sheet.expand"),
);

defineExpose({
  expand: () => (expanded.value = true),
  collapse: () => (expanded.value = false),
  isExpanded: () => expanded.value,
});
</script>

<template>
  <!-- Teleported only while it is a sheet: the page's content box is
       transformed while it enters, and a fixed element inside a transformed
       one is fixed to that box rather than to the screen. -->
  <Teleport to="body" :disabled="!enabled">
    <section
      v-if="enabled"
      class="fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-white/10 bg-background/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.85)] [backdrop-filter:blur(14px)] transition-[height] [transition-duration:280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      :style="{ height: expanded ? 'calc(100svh - 4.5rem)' : '40svh' }"
    >
      <button
        type="button"
        class="flex h-7 w-full shrink-0 touch-none items-center justify-center"
        :aria-label="handleLabel"
        :aria-expanded="expanded"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @click="onClick"
      >
        <span aria-hidden="true" class="h-1 w-10 rounded-full bg-white/25" />
      </button>
      <!-- The card inside scrolls itself, so this only gives it the room. -->
      <div v-bind="$attrs" class="min-h-0 flex-1">
        <slot />
      </div>
    </section>
    <div v-else v-bind="$attrs">
      <slot />
    </div>
  </Teleport>
</template>
