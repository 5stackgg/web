<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onAirClock } from "~/utilities/controlRoom";

// How long the broadcast has been on air. Its own component so the 1s tick
// re-renders this text and nothing else on the page.
const props = defineProps<{ since: number }>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const text = computed(() => onAirClock(props.since, now.value));
</script>

<template>
  <span class="tabular-nums">{{ text }}</span>
</template>
