<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    detail?: string | null;
    hint?: string | null;
    trailing?: string | null;
    tone?: "default" | "error";
    // A sweeping bar while waiting on something open-ended, or one
    // segment per boot step (StreamStatusProgress).
    progress?:
      | "indeterminate"
      | { steps: number; current: number; fraction?: number | null }
      | null;
    // Own card chrome when shown on its own; inside StreamMatchCard it is
    // the card's bottom tier and borrows the card's corners.
    standalone?: boolean;
  }>(),
  {
    tone: "default",
    standalone: false,
  },
);
</script>

<template>
  <div
    class="relative overflow-hidden bg-muted/95 px-3.5 pb-3 pt-2 text-[0.8rem] leading-snug text-foreground"
    :class="
      standalone ? 'rounded-[3px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)]' : ''
    "
    role="status"
  >
    <div class="flex items-center justify-between gap-2.5">
      <p class="min-w-0 truncate">
        <span
          class="font-semibold"
          :class="tone === 'error' ? 'text-destructive' : ''"
          >{{ title }}</span
        ><span v-if="detail" class="text-muted-foreground">
          · {{ detail }}</span
        >
      </p>
      <span
        v-if="trailing"
        class="shrink-0 text-xs tabular-nums text-muted-foreground"
        >{{ trailing }}</span
      >
    </div>
    <p
      v-if="hint"
      class="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground"
    >
      {{ hint }}
    </p>
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap gap-2">
      <slot name="actions" />
    </div>

    <div
      v-if="progress === 'indeterminate'"
      class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-foreground/10"
    >
      <span
        class="stream-status-sweep absolute inset-y-0 left-0 w-1/3 bg-[hsl(var(--tac-amber))]"
      />
    </div>
    <div
      v-else-if="progress"
      class="absolute inset-x-0 bottom-0 grid h-[3px] auto-cols-fr grid-flow-col gap-0.5"
    >
      <span
        v-for="i in progress.steps"
        :key="i"
        class="relative overflow-hidden"
        :class="
          i - 1 < progress.current
            ? 'bg-foreground/55'
            : i - 1 === progress.current
              ? tone === 'error'
                ? 'bg-destructive'
                : 'bg-[hsl(var(--tac-amber)/0.35)]'
              : 'bg-foreground/10'
        "
      >
        <span
          v-if="
            i - 1 === progress.current &&
            tone !== 'error' &&
            typeof progress.fraction === 'number'
          "
          class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber))] transition-[width] duration-500 ease-out"
          :style="{ width: `${Math.max(0, Math.min(1, progress.fraction)) * 100}%` }"
        />
      </span>
    </div>
  </div>
</template>

<style scoped>
.stream-status-sweep {
  animation: stream-status-sweep 1.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
}
@keyframes stream-status-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(320%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .stream-status-sweep {
    animation: none;
    width: 100%;
    opacity: 0.4;
  }
}
</style>
