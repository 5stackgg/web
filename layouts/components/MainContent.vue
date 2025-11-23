<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useRightSidebar } from "@/composables/useRightSidebar";
import SidebarMobileSync from "./SidebarMobileSync.vue";

const { rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();
</script>

<template>
  <div :style="{ '--header-height': '4rem' }" class="main-content-wrapper">
    <SidebarProvider
      :open="rightSidebarOpen"
      @update:open="setRightSidebarOpen"
      class="!min-h-[calc(100svh-var(--header-height))]"
    >
      <SidebarMobileSync />
      <SidebarInset
        class="!min-h-[calc(100svh-var(--header-height))] h-[calc(100svh-var(--header-height))]"
      >
        <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem class="hidden md:block">
                <BreadcrumbLink href="#">
                  Building Your Application
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator class="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Data Fetching</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div class="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <div class="grid auto-rows-min gap-4 md:grid-cols-3">
            <div class="bg-muted/50 aspect-video rounded-xl" />
            <div class="bg-muted/50 aspect-video rounded-xl" />
            <div class="bg-muted/50 aspect-video rounded-xl" />
          </div>

          <div
            class="bg-muted/50 min-h-[calc(100vh-var(--header-height))] flex-1 rounded-xl md:min-h-min"
          />
        </div>
      </SidebarInset>

      <AppSidebar side="right" class="main-content-sidebar" />
    </SidebarProvider>
  </div>
</template>

<style scoped>
/* Override SidebarProvider's --sidebar-height variable */
.main-content-wrapper :deep(.group\/sidebar-wrapper) {
  --sidebar-height: calc(100svh - var(--header-height)) !important;
}

/* Define sidebar height variable for right sidebar group */
.main-content-wrapper :deep(.main-content-sidebar.group[data-side="right"]) {
  --sidebar-height: calc(100svh - var(--header-height));
}

/* Override the fixed sidebar div positioning */
.main-content-wrapper
  :deep(
    .main-content-sidebar.group[data-side="right"]
      > div[class*="fixed"][class*="inset-y-0"]
  ) {
  top: var(--header-height) !important;
  bottom: auto !important;
}
</style>
