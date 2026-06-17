<script lang="ts" setup>
import { Info } from "lucide-vue-next";
import { TooltipPortal } from "reka-ui";
import { ref, onMounted, onBeforeUnmount } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    size?: number;
    side?: string;
    align?: string;
    asChild?: boolean;
    delayDuration?: number;
    tapToggle?: boolean;
  }>(),
  {
    size: 12,
    asChild: false,
    delayDuration: 0,
    tapToggle: true,
  },
);

// reka-ui tooltips are hover/focus only — on touch devices the trigger's
// pointerdown sets an internal flag that blocks focus-to-open, and the
// follow-up click calls onClose, so a tap never opens the tooltip. On touch
// we take over: control `open` ourselves, toggle it on tap, and dismiss on an
// outside tap. On pointer devices we pass `undefined` so reka stays
// uncontrolled and native hover behavior is untouched.
const isTouch = ref(false);
const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function onTriggerClick(event: Event) {
  // When the trigger has its own action (e.g. a metric tab that switches the
  // chart), tapping should perform that action only — not pop the tooltip.
  if (!isTouch.value || !props.tapToggle) return;
  // Otherwise the trigger often sits inside an actionable parent (e.g. a
  // sortable table header). On touch the tap should reveal the tooltip only —
  // swallow it so the parent doesn't also sort/navigate.
  event.stopPropagation();
  open.value = !open.value;
}

function onUpdateOpen(value: boolean) {
  if (isTouch.value) open.value = value;
}

function onDocPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  // The opening tap lands on the trigger (inside rootEl) — let our click
  // toggle handle it. Any other tap dismisses. Tooltip content is portalled
  // out of rootEl, so tapping it also dismisses, which is fine for read-only
  // info bubbles.
  if (target && rootEl.value?.contains(target)) return;
  open.value = false;
}

onMounted(() => {
  isTouch.value = window.matchMedia?.("(hover: none)").matches ?? false;
  document.addEventListener("pointerdown", onDocPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
});
</script>

<template>
  <span ref="rootEl" style="display: contents">
    <TooltipProvider
      :ignoreNonKeyboardFocus="true"
      :delay-duration="delayDuration"
    >
      <Tooltip
        :open="isTouch ? open : undefined"
        :disable-closing-trigger="isTouch"
        @update:open="onUpdateOpen"
      >
        <TooltipTrigger v-if="asChild" as-child @click="onTriggerClick">
          <slot name="trigger">
            <Info :size="size" v-bind="$attrs"> </Info>
          </slot>
        </TooltipTrigger>
        <TooltipTrigger v-else type="button" @click="onTriggerClick">
          <slot name="trigger">
            <Info :size="size" v-bind="$attrs"> </Info>
          </slot>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            :side="(side as any)"
            :align="(align as any)"
            :collision-padding="8"
          >
            <slot></slot>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  </span>
</template>
