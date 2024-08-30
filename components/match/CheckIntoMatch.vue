<template>
  <Card v-if="isInMatch && match.can_check_in">
    <CardHeader class="p-2 pt-0 md:p-4">
      <CardTitle class="flex justify-between">
        Check In Status
        <template v-if="isCheckedIn">
          <Badge variant="secondary">Checked In</Badge>
        </template>
      </CardTitle>
      <CardDescription>
        A minimum of {{ playersRequiredToStart }} players must check in before
        you can start the match. {{ totalCheckedIn }} /
        {{ playersRequiredToStart }} checked in.

        <badge class="my-3"
          >Auto Canceling &nbsp; <time-ago :date="match.cancels_at"></time-ago
        ></badge>
      </CardDescription>
    </CardHeader>
    <CardContent class="p-2 pt-0 md:p-4 md:pt-0" v-if="!isCheckedIn">
      <Button size="sm" class="w-full" @click="checkIn"> Check In </Button>
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
