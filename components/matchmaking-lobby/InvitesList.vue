<script setup lang="ts">
import MatchInviteNotification from "~/components/MatchInviteNotification.vue";
import LobbyInvite from "./LobbyInvite.vue";
import { Separator } from "~/components/ui/separator";

const props = defineProps<{
  type: "match" | "lobby";
}>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="invite in invites"
      :key="(invite as any).id"
      class="text-sm text-muted-foreground"
    >
      <template v-if="getInviterName(invite) === 'Unknown'">
        {{
          type === "match"
            ? $t("matchmaking.invite_messages.unknown_inviter")
            : $t("matchmaking.invite_messages.unknown_inviter_lobby")
        }}
      </template>
      <template v-else>
        {{
          type === "match"
            ? $t("matchmaking.invite_messages.known_inviter", {
                name: getInviterName(invite),
              })
            : $t("matchmaking.invite_messages.known_inviter_lobby", {
                name: getInviterName(invite),
              })
        }}
      </template>
    </div>
    <div class="flex flex-col gap-4">
      <template v-for="(invite, index) in invites" :key="(invite as any).id">
        <MatchInviteNotification
          v-if="type === 'match'"
          type="match"
          :invite="invite"
        />
        <LobbyInvite v-else type="lobby" :invite="invite" />
        <Separator v-if="index < invites.length - 1" class="my-2" />
      </template>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    type: {
      type: String as () => "match" | "lobby",
      required: true,
    },
  },
  computed: {
    invites() {
      const store = useMatchmakingStore();
      if (this.type === "match") {
        return store.matchInvites as any[];
      } else {
        return store.lobbyInvites as any[];
      }
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
      let steamId: string | undefined;

      if (this.type === "match") {
        // Match invites have invited_by.steam_id
        steamId = invite?.invited_by?.steam_id;
      } else {
        // Lobby invites have a players array, find the captain
        if (!invite?.players) return "Unknown";

        const captain = invite.players.find((p: any) => p.captain === true);
        if (!captain?.player) return "Unknown";

        steamId = captain.player.steam_id;

        // Fallback to the name from the invite data if available
        if (!steamId && captain.player.name) {
          return captain.player.name;
        }
      }

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
