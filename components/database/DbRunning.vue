<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import DbSev from "./DbSev.vue";
import { formatDuration, runSeverity } from "./dbHealth";

// A running query's age, ticking between polls without re-rendering its row.
// Counted from the server's own duration at the time it was fetched, so a
// skewed client clock cannot make it jump.
const props = defineProps<{
  seconds: number | null | undefined;
  fetchedAt: number;
  state?: string | null;
  threshold: number;
}>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const live = computed(
  () => props.state === "active" && (props.seconds ?? 0) >= 1,
);

function sync() {
  clearInterval(timer);
  timer = undefined;
  now.value = Date.now();
  if (live.value) {
    timer = setInterval(() => (now.value = Date.now()), 1000);
  }
}

watch(() => [props.seconds, props.fetchedAt, live.value], sync, {
  immediate: true,
});
onBeforeUnmount(() => clearInterval(timer));

const elapsed = computed(() => {
  const base = props.seconds ?? 0;
  return live.value
    ? base + Math.max(0, now.value - props.fetchedAt) / 1000
    : base;
});

const sev = computed(() => {
  if (props.state === "active")
    return runSeverity(elapsed.value, props.threshold);
  // Idle in a transaction holds vacuum back; judge it on wall time alone.
  return elapsed.value > 60 ? "bad" : elapsed.value > 10 ? "warn" : "";
});
</script>

<template>
  <DbSev :sev="sev">{{ formatDuration(elapsed) }}</DbSev>
</template>
