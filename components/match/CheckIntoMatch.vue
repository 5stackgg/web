<template>
  <Card v-if="isInMatch && match.can_check_in">
    <CardHeader class="p-4">
      <CardTitle class="flex justify-between">
        {{ $t("match.check_in.title") }}
        <template v-if="isCheckedIn">
          <Badge variant="secondary">{{
            $t("match.check_in.checked_in")
          }}</Badge>
        </template>
      </CardTitle>
      <CardDescription>
        {{
          $t("match.check_in.description", {
            required: playersRequiredToStart,
            checked: totalCheckedIn,
          })
        }}
      </CardDescription>
    </CardHeader>
    <CardContent v-if="!isCheckedIn">
      <Button
        size="sm"
        class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-pulse"
        @click="checkIn"
      >
        {{ $t("match.check_in.check_in") }}
      </Button>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import TimeAgo from "~/components/TimeAgo.vue";

export default {
  components: { TimeAgo },
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
    isCheckedIn() {
      return this.isInMatch?.checked_in;
    },
    isInMatch() {
      return this.players.find((player) => {
        return player.steam_id === this.me?.steam_id;
      });
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
    totalCheckedIn() {
      return this.players?.filter(({ checked_in }) => {
        return checked_in;
      }).length;
    },
    playersRequiredToStart() {
      return this.match.min_players_per_lineup * 2;
    },
  },
  methods: {
    async checkIn() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          checkIntoMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
