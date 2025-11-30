<script setup lang="ts">
import { MailPlus } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useInvites } from "@/composables/useInvites";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
const { hasInvites, totalCount } = useInvites();

const handleInviteClick = () => {
  setRightSidebarOpen(!rightSidebarOpen.value);
};
</script>

<template>
  <button
    @click="handleInviteClick"
    class="flex items-center justify-center gap-1.5 text-sm text-muted-foreground relative hover:text-foreground transition-colors cursor-pointer rounded-md p-1.5 hover:bg-accent min-w-[2rem] h-8"
    :title="$t('matchmaking.invites')"
    :class="{ 'opacity-50': !hasInvites }"
  >
    <MailPlus class="h-4 w-4" />
    <div
      v-if="hasInvites"
      class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"
    ></div>
    <span v-if="hasInvites" class="text-xs font-medium">{{ totalCount }}</span>
  </button>
</template>
