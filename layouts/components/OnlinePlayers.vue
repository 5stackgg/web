<script setup lang="ts">
import { Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { computed } from "vue";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
const matchmakingStore = useMatchmakingStore();
const playersOnlineCount = computed(
  () => matchmakingStore.playersOnline.length,
);
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="h-7 w-7 md:hidden"
    @click="setRightSidebarOpen(!rightSidebarOpen)"
  >
    <Users class="h-4 w-4" />
    <span>{{ playersOnlineCount }}</span>
  </Button>
</template>
