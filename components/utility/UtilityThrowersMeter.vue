<script setup lang="ts">
import { computed } from "vue";
import { Users } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    count: number;
    // The busiest spot on the map; without one the bar has nothing to mean and stays off.
    max?: number | null;
    color?: string;
    // Amber is reserved for a spot people throw that nobody has written up.
    amber?: boolean;
  }>(),
  {
    max: null,
    color: "#ffffff",
    amber: false,
  },
);

const share = computed(() => {
  const max = Number(props.max ?? 0);
  if (max <= 0) {
    return null;
  }
  return Math.min(100, Math.round((props.count / max) * 100));
});
</script>

<template>
  <span
    class="flex w-20 shrink-0 flex-col items-end gap-1"
    :title="$t('pages.utility.meta.throwers_hint')"
  >
    <span
      class="flex items-center gap-1 font-mono text-[0.7rem] font-semibold leading-none tabular-nums"
    >
      <Users class="h-3 w-3 text-muted-foreground" />
      {{ count }}
    </span>
    <span
      v-if="share !== null"
      class="h-[3px] w-full overflow-hidden rounded-sm bg-border"
    >
      <span
        class="block h-full rounded-sm transition-[width] duration-300"
        :class="amber ? 'bg-[hsl(var(--tac-amber))]' : ''"
        :style="{
          width: `${share}%`,
          backgroundColor: amber ? undefined : color,
        }"
      />
    </span>
  </span>
</template>
