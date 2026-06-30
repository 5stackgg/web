<script setup lang="ts">
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useRightSidebar } from "@/composables/useRightSidebar";
import SidebarMobileSync from "./SidebarMobileSync.vue";
import SystemAlertBanner from "@/components/SystemAlertBanner.vue";
import {
  inject,
  computed,
  defineAsyncComponent,
  ref,
  onMounted,
  onBeforeUnmount,
} from "vue";

const AppSidebar = defineAsyncComponent(
  () => import("@/components/AppSidebar.vue"),
);

const { rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();

// Publish the height of the bottom dock (e.g. MatchAdminBottomBar teleports
// into #main-bottom-dock) as a CSS variable so fixed bottom chrome — like the
// floating SettingsSaveBar — can lift itself above it. Defaults to 0 when the
// dock is empty / on pages without one.
const bottomDock = ref<HTMLElement | null>(null);
let dockRO: ResizeObserver | null = null;

function publishDockHeight() {
  const h = bottomDock.value?.offsetHeight ?? 0;
  document.documentElement.style.setProperty(
    "--main-bottom-dock-height",
    `${h}px`,
  );
}

onMounted(() => {
  publishDockHeight();
  if (typeof ResizeObserver !== "undefined" && bottomDock.value) {
    dockRO = new ResizeObserver(() => publishDockHeight());
    dockRO.observe(bottomDock.value);
  }
});

onBeforeUnmount(() => {
  dockRO?.disconnect();
  document.documentElement.style.removeProperty("--main-bottom-dock-height");
});

// Inject values from default.vue
const containContent =
  inject<ReturnType<typeof computed<boolean>>>("containContent");

// Get computed values
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
      <SidebarInset
        class="flex flex-col min-h-0 h-[var(--sidebar-height)] !bg-transparent overflow-hidden"
      >
        <div class="flex-1 overflow-auto [scrollbar-gutter:stable]">
          <SystemAlertBanner />
          <div
            class="mx-auto p-1 sm:p-4 w-full self-center"
            :class="{
              'lg:max-w-7xl': containContentValue,
            }"
          >
            <slot></slot>
          </div>
        </div>
        <div id="main-bottom-dock" ref="bottomDock" class="shrink-0"></div>
      </SidebarInset>

      <AppSidebar side="right" />
    </SidebarProvider>
  </div>
</template>
