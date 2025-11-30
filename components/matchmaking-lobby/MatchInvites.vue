<script setup lang="ts">
import MatchInviteNotification from "~/components/MatchInviteNotification.vue";
import { Separator } from "~/components/ui/separator";
</script>
<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="invite in matchInvites"
      :key="(invite as any).id"
      class="text-sm text-muted-foreground"
    >
      <template v-if="getInviterName(invite) === 'Unknown'">
        {{ $t("matchmaking.invite_messages.unknown_inviter") }}
      </template>
      <template v-else>
        {{
          $t("matchmaking.invite_messages.known_inviter", {
            name: getInviterName(invite),
          })
        }}
      </template>
    </div>
    <div class="flex flex-col gap-4">
      <template
        v-for="(invite, index) in matchInvites"
        :key="(invite as any).id"
      >
        <MatchInviteNotification type="match" :invite="invite" />

        <Separator v-if="index < matchInvites.length - 1" class="my-2" />
      </template>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    matchInvites() {
      return useMatchmakingStore().matchInvites as any[];
    },
    playersOnline() {
      return useMatchmakingStore().playersOnline as any[];
    },
    friends() {
      return useMatchmakingStore().friends as any[];
    },
  },
  methods: {
    getInviterName(invite: any) {
      const steamId = invite?.invited_by?.steam_id;
      if (!steamId) return "Unknown";

      // Try to find in online players first
      const onlinePlayer = this.playersOnline.find(
        (p: any) => p.steam_id === steamId
      );
      if (onlinePlayer) return onlinePlayer.name;

      // Try to find in friends
      const friend = this.friends.find((f: any) => f.steam_id === steamId);
      if (friend) return friend.name;

      return "Unknown";
    },
  },
};
</script>
