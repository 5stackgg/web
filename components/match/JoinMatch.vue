<template>
  <Card v-if="isInMatch && match.connection_string" class="overflow-hidden">
    <CardHeader class="p-2 pt-0 md:p-4">
      <CardTitle class="flex justify-between"> Match is Live!</CardTitle>
    </CardHeader>
    <CardContent class="p-2 pt-0 md:p-4 md:pt-0">
      <QuickServerConnect :match="match"></QuickServerConnect>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";

export default {
  components: { QuickServerConnect, TimeAgo },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    players() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      return players;
    },
    isInMatch() {
      return this.players.find((player) => {
        return player.steam_id === this.me?.steam_id;
      });
    },
  },
};
</script>
