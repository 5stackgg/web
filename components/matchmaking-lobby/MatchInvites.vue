<script setup lang="ts">
import { Mail } from "lucide-vue-next";
import MatchInviteNotification from "~/components/MatchInviteNotification.vue";
import { Separator } from "~/components/ui/separator";
</script>
<template>
  <div class="flex flex-col gap-4">
    <template v-for="(invite, index) in matchInvites" :key="invite.id">
      <MatchInviteNotification type="match" :invite="invite" />
      <Separator v-if="index < matchInvites.length - 1" class="my-2" />
    </template>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    matchInvites() {
      return useMatchmakingStore().matchInvites;
    },
  },
};
</script>
