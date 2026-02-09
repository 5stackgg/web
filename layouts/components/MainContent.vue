<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useRightSidebar } from "@/composables/useRightSidebar";
import SidebarMobileSync from "./SidebarMobileSync.vue";
import { inject, computed } from "vue";

const { rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();

// Inject values from default.vue
const showLeftNav = inject<ReturnType<typeof computed<boolean>>>("showLeftNav");
const containContent =
  inject<ReturnType<typeof computed<boolean>>>("containContent");

// Get computed values
const showLeftNavValue = computed(() => showLeftNav?.value ?? true);
const containContentValue = computed(() => containContent?.value ?? true);
</script>

<template>
  <div :style="{ '--header-height': '4rem' }" class="main-content-wrapper">
    <SidebarProvider
      :open="rightSidebarOpen"
      @update:open="setRightSidebarOpen"
      side="right"
      class="min-h-0 h-full"
    >
      <SidebarMobileSync />
      <SidebarInset class="overflow-scroll min-h-0 h-full">
        <!-- todo fix bg color bg-muted/10 -->
        <div
          class="p-4 w-full self-center"
          :class="{
            'mx-auto': !showLeftNavValue,
            'lg:max-w-7xl': containContentValue,
          }"
        >
          <slot></slot>
        </div>
      </SidebarInset>

      <AppSidebar side="right" class="main-content-sidebar" />
    </SidebarProvider>
  </div>
</template>

<style scoped>
/* Override SidebarProvider's --sidebar-height and --sidebar-width variables */
.main-content-wrapper :deep(.group\/sidebar-wrapper) {
  --sidebar-height: 100% !important;
  --sidebar-width: 22rem !important;
  min-height: 0 !important;
}

/* Define sidebar height variable for right sidebar group */
.main-content-wrapper :deep(.main-content-sidebar.group[data-side="right"]) {
  --sidebar-height: 100%;
}

/* Override the fixed sidebar div positioning */
.main-content-wrapper
  :deep(
    .main-content-sidebar.group[data-side="right"]
      > div[class*="fixed"][class*="inset-y-0"]
  ) {
  top: 0 !important;
  bottom: auto !important;
}
</style>
