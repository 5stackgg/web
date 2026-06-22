<script setup lang="ts">
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useSidebar } from "@/components/ui/sidebar/utils";
import { watch } from "vue";
import { useRoute } from "vue-router";

const { rightSidebarOpen, setRightSidebarOpen, isPinned } = useRightSidebar();
const { isMobile, setOpenMobile, openMobile } = useSidebar();
const route = useRoute();

// On mobile, close the right hub whenever the page changes so clicking a
// notification link doesn't leave it open over the new page.
watch(
  () => route.fullPath,
  () => {
    if (isMobile.value && rightSidebarOpen.value) {
      setRightSidebarOpen(false);
    }
  },
);

// Sync rightSidebarOpen with the provider's openMobile on mobile.
// If pinned, force both to stay open.
watch(
  rightSidebarOpen,
  (newValue) => {
    if (isMobile.value) {
      const next = isPinned.value ? true : newValue;
      setOpenMobile(next);
    }
  },
  { immediate: true },
);

// Also sync in reverse: when mobile sidebar closes, update rightSidebarOpen.
// If pinned, prevent it from closing.
watch(openMobile, (newValue) => {
  if (!isMobile.value) return;

  const next = isPinned.value ? true : newValue;
  if (rightSidebarOpen.value !== next) {
    setRightSidebarOpen(next);
  }
});
</script>

<template>
  <!-- This component only syncs state, no rendering needed -->
</template>
