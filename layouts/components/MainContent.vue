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
  <div :style="{ '--header-height': '4rem' }">
    <SidebarProvider
      :open="rightSidebarOpen"
      @update:open="setRightSidebarOpen"
      side="right"
      class="!min-h-0 h-full !bg-transparent ![--sidebar-height:calc(100svh_-_var(--header-height))] ![--sidebar-width:30rem] ![--sidebar-width-icon:calc(2.5rem_-_2px)]"
    >
      <SidebarMobileSync />
      <SidebarInset class="overflow-scroll min-h-0 h-full !bg-transparent">
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

      <AppSidebar side="right" />
    </SidebarProvider>
  </div>
</template>
