<script setup lang="ts">
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useSidebar } from "@/components/ui/sidebar/utils";
import { watch } from "vue";

const { rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();
const { isMobile, setOpenMobile, openMobile } = useSidebar();

// Sync rightSidebarOpen with the provider's openMobile on mobile
watch(
  rightSidebarOpen,
  (newValue) => {
    if (isMobile.value) {
      setOpenMobile(newValue);
    }
  },
  { immediate: true }
);

// Also sync in reverse: when mobile sidebar closes, update rightSidebarOpen
watch(
  openMobile,
  (newValue) => {
    if (isMobile.value && rightSidebarOpen.value !== newValue) {
      setRightSidebarOpen(newValue);
    }
  }
);
</script>

<template>
  <!-- This component only syncs state, no rendering needed -->
</template>

