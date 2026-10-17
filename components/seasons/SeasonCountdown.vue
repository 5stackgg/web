<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { formatCountdown } from "~/components/seasons/seasonPhase";

// Owns its own one-second clock so only this text re-renders each tick, not
// the page around it.
const props = defineProps<{ endsAt: string }>();
const emit = defineEmits<{ (e: "elapsed"): void }>();

const remaining = () => new Date(props.endsAt).getTime() - Date.now();
const text = ref(formatCountdown(remaining()));
let timer: ReturnType<typeof setInterval> | null = null;

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function tick() {
  const left = remaining();
  text.value = formatCountdown(left);
  if (left <= 0) {
    stop();
    emit("elapsed");
  }
}

function start() {
  stop();
  tick();
  if (remaining() > 0) {
    timer = setInterval(tick, 1000);
  }
}

onMounted(start);
onBeforeUnmount(stop);
watch(() => props.endsAt, start);
</script>

<template>
  <span class="font-mono tabular-nums">{{ text }}</span>
</template>
