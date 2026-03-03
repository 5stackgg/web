<script setup lang="ts">
import { ChevronsLeft, ChevronsRight } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useSidebar } from "@/components/ui/sidebar/utils";

const { rightSidebarOpen } = useRightSidebar();
const { isMobile } = useSidebar();
</script>

<template>
  <div
    :class="[
      'flex items-center justify-center text-sm transition-colors',
      isMobile
        ? 'px-3 py-1.5 rounded-full bg-zinc-900/90 text-zinc-100 border border-zinc-700 shadow-md mb-3'
        : 'px-2 text-muted-foreground',
    ]"
  >
    <component
      :is="rightSidebarOpen ? ChevronsRight : ChevronsLeft"
      :class="[
        'h-4 w-4 transition-transform duration-200',
        isMobile && rightSidebarOpen ? 'translate-x-0.5' : '',
      ]"
    />
  </div>
</template>
