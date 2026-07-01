<script lang="ts" setup>
import { useFriendStatus } from "~/composables/useFriendStatus";
import Cs2PresenceStatus from "~/components/Cs2PresenceStatus.vue";
import FriendMatchPreview from "~/components/matchmaking-lobby/FriendMatchPreview.vue";

const props = withDefaults(
  defineProps<{
    player: any;
    online?: boolean;
    showOffline?: boolean;
  }>(),
  { online: false, showOffline: false },
);

const { currentMatch } = useFriendStatus(
  () => props.player,
  () => props.online,
);
</script>

<template>
  <FriendMatchPreview v-if="currentMatch" :match="currentMatch" class="w-full" />
  <Cs2PresenceStatus
    v-else
    :state="player?.last_presence_state"
    :show-offline="showOffline"
    class="w-full"
  />
</template>
