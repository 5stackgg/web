<script setup lang="ts">
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { useInvites } from "@/composables/useInvites";

const { hasInvites } = useInvites();
</script>

<template>
  <template v-if="hasInvites">
    <div class="flex px-4">
      <MatchInvites />
      <LobbyInvites />
    </div>
    <SidebarSeparator class="my-4" />
  </template>
</template>
