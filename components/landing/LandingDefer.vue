<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// Mounts a section's visual (and so fetches its chunk) only once it is close
// to the screen, so the welcome page's first paint carries just the hero.
defineProps<{
  // Held open until the visual mounts, so the page doesn't jump.
  placeholder: number;
}>();

const root = ref<HTMLElement | null>(null);
const shown = ref(false);
let observer: IntersectionObserver | undefined;

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      shown.value = true;
      observer?.disconnect();
    },
    { rootMargin: "1200px 0px" },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div
    ref="root"
    :style="shown ? undefined : { minHeight: `${placeholder}px` }"
  >
    <slot v-if="shown" />
  </div>
</template>
