<script setup lang="ts">
import LobbyInvite from "./LobbyInvite.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-for="(invite, index) in lobbyInvites" :key="(invite as any).id">
      <LobbyInvite type="lobby" :invite="invite" />
      <Separator v-if="index < lobbyInvites.length - 1" class="my-2" />
    </template>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    lobbyInvites() {
      return useMatchmakingStore().lobbyInvites;
    },
  },
};
</script>
