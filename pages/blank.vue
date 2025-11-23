<script lang="ts">
export const description = "An inset sidebar with secondary navigation.";

export const iframeHeight = "800px";
</script>

<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import MainContent from "@/layouts/components/MainContent.vue";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ViewVerticalIcon } from "@radix-icons/vue";
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <SidebarProvider>
    <AppSidebar />

    <SidebarInset>
      <header
        class="flex h-16 shrink-0 items-center gap-2 bg-background sticky top-0 z-50"
      >
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />

          <Separator
            orientation="vertical"
            class="mr-2 data-[orientation=vertical]:h-4"
          />

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

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 -mr-1 ml-auto"
            @click="setRightSidebarOpen(!rightSidebarOpen)"
          >
            <Users class="h-4 w-4" />
            <span class="sr-only">Toggle Right Sidebar</span>
          </Button>
        </div>
      </header>

      <div class="flex flex-1 flex-col">
        <MainContent />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
