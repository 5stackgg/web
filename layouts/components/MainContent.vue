<script setup lang="ts">
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useRightSidebar } from "@/composables/useRightSidebar";
import SidebarMobileSync from "./SidebarMobileSync.vue";
import { inject, computed, defineAsyncComponent } from "vue";

const AppSidebar = defineAsyncComponent(
  () => import("@/components/AppSidebar.vue"),
);

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
      class="min-h-0 h-full !bg-transparent"
    >
      <SidebarMobileSync />
      <SidebarInset class="overflow-scroll min-h-0 h-full !bg-transparent">
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
/* Tweak nested right-sidebar layout inside main content area */
.main-content-wrapper :deep(.group\/sidebar-wrapper) {
  /* Match the content area (viewport minus header) */
  --sidebar-height: calc(100svh - var(--header-height)) !important;
  --sidebar-width: 30rem !important;
  /* Inset variant adds (spacing.4 + 2px) to icon width for collapsed state.
     Set so collapsed container = w-14 (3.5rem): 3.5rem - 1rem - 2px */
  --sidebar-width-icon: calc(2.5rem - 2px) !important;
  min-height: 0 !important;
}

.main-content-wrapper :deep(.main-content-sidebar.group[data-side="right"]) {
  /* Ensure the fixed sidebar uses the same reduced height */
  --sidebar-height: calc(100svh - var(--header-height));
}
</style>
