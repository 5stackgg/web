<script setup lang="ts">
import { Users, ChevronsRight } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";

const { rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <div
    class="flex items-center px-2 justify-center text-sm text-muted-foreground"
  >
    <component :is="rightSidebarOpen ? ChevronsRight : Users" class="h-4 w-4" />
    <span class="w-0">&nbsp;</span>
  </div>
</template>
