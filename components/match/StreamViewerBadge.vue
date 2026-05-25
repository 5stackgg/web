<script setup lang="ts">
import { computed } from "vue";
import { Eye } from "lucide-vue-next";
import { useStreamViewers } from "~/composables/useStreamViewers";

const props = withDefaults(
  defineProps<{
    matchId: string;
    size?: "sm" | "md";
  }>(),
  { size: "sm" },
);

const { getCount } = useStreamViewers();
const count = getCount(props.matchId);

const formatted = computed(() => {
  const n = count.value;
  if (n === null || n < 0) return "0";
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
});

const sizeClasses = computed(() =>
  props.size === "md"
    ? "text-xs px-3 py-1.5 gap-1.5 leading-none"
    : "text-[10px] px-1.5 py-0 gap-1",
);

const iconClasses = computed(() =>
  props.size === "md" ? "h-3.5 w-3.5" : "h-3 w-3",
);
</script>

<template>
  <span
    class="inline-flex items-center rounded border border-white/20 bg-black/60 font-medium text-white backdrop-blur-sm"
    :class="sizeClasses"
    :title="`${count ?? 0} watching`"
  >
    <Eye :class="iconClasses" />
    {{ formatted }}
  </span>
</template>
