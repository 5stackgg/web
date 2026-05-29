<script setup lang="ts">
import { Film, ChevronRight } from "lucide-vue-next";

// Shared collapsible batch row used by BOTH the active in-flight queue
// and the recently-finished list, so the two read as one list. The
// parent supplies the bits that differ (avatar tone, meta line, action
// buttons, optional progress bar, and the expandable body) via slots.
defineProps<{
  expanded: boolean;
  title: string;
  // Avatar chip border/bg/text classes (status-toned by the parent).
  avatarClass: string;
  // Right-aligned relative time, e.g. "1h".
  time: string;
  // Container border tint (amber for active, neutral for finished).
  containerClass?: string;
}>();

defineEmits<{ (e: "toggle"): void }>();

// Animate the body open/closed by transitioning explicit pixel heights
// (the content stays `v-if`-gated so collapsed batches don't render
// their clip ladders). CSS height transition lives in .collapse-body.
function onEnter(el: Element) {
  const node = el as HTMLElement;
  node.style.height = "0";
  void node.offsetHeight; // force reflow so the height change animates
  node.style.height = `${node.scrollHeight}px`;
}
function onAfterEnter(el: Element) {
  (el as HTMLElement).style.height = "";
}
function onLeave(el: Element) {
  const node = el as HTMLElement;
  node.style.height = `${node.scrollHeight}px`;
  void node.offsetHeight;
  node.style.height = "0";
}
</script>

<template>
  <div
    class="overflow-hidden rounded-md border bg-card/30 [backdrop-filter:blur(6px)]"
    :class="containerClass ?? 'border-border/40'"
  >
    <div class="flex w-full items-center">
      <button
        type="button"
        class="flex flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs min-w-0"
        @click="$emit('toggle')"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          :class="avatarClass"
        >
          <slot name="avatar-icon">
            <Film class="h-3.5 w-3.5" />
          </slot>
        </span>
        <ChevronRight
          class="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200"
          :class="{ 'rotate-90': expanded }"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold">{{ title }}</div>
          <div
            class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70"
          >
            <slot name="meta" />
          </div>
        </div>
        <span
          class="shrink-0 font-mono text-[0.58rem] tabular-nums text-muted-foreground/70"
        >
          {{ time }}
        </span>
      </button>
      <slot name="actions" />
    </div>

    <slot name="progress" />

    <Transition
      name="collapse"
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @leave="onLeave"
    >
      <div v-if="expanded" class="collapse-body overflow-hidden">
        <slot name="body" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Body open/close — JS hooks set the explicit heights, this animates
   the change (and fades the content so the clip rows don't pop in). */
.collapse-body {
  transition:
    height 0.22s ease,
    opacity 0.22s ease;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
}

/* List enter/leave/reorder for the parent <TransitionGroup name="batch">.
   These classes land on THIS component's root element (it carries this
   scope id), so they belong here rather than in the panel. The leaving
   row goes absolute so its surviving siblings FLIP-slide into place —
   that's what de-jars a re-queue (finished → active) hand-off. */
.batch-enter-active,
.batch-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.batch-enter-from,
.batch-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.batch-leave-active {
  position: absolute;
  width: 100%;
}
.batch-move {
  transition: transform 0.28s ease;
}
</style>
