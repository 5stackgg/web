<script setup lang="ts">
import { MailPlus } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useInvites } from "@/composables/useInvites";
import { Button } from "~/components/ui/button";

const props = defineProps<{
  sidebarOpen?: boolean;
}>();

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
const { hasInvites, totalCount } = useInvites();

const handleInviteClick = () => {
  setRightSidebarOpen(!rightSidebarOpen.value);
};
</script>

<template>
  <div v-if="hasInvites" class="flex items-center gap-2 justify-end pl-4">
    <h3
      v-if="sidebarOpen"
      class="text-lg font-semibold flex items-center gap-2 grow"
    >
      {{ $t("matchmaking.invites") }}
      <span class="text-sm text-muted-foreground">({{ totalCount }})</span>
    </h3>
    <Button
      @click="handleInviteClick"
      variant="ghost"
      size="icon"
      class="shrink-0 relative w-[3rem] text-muted-foreground"
      :title="$t('matchmaking.invites')"
    >
      <MailPlus class="h-4 w-4" />
      <div class="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
    </Button>
  </div>
</template>
