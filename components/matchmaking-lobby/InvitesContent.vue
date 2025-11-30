<script setup lang="ts">
import { MailPlus } from "lucide-vue-next";
import InvitesList from "~/components/matchmaking-lobby/InvitesList.vue";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { useInvites } from "@/composables/useInvites";

const { hasInvites } = useInvites();
</script>

<template>
  <template v-if="hasInvites">
    <div class="flex flex-col gap-4 px-4">
      <InvitesList type="match" />
      <InvitesList type="lobby" />
    </div>
    <SidebarSeparator class="my-4" />
  </template>
</template>
