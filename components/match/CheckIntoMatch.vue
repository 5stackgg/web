<template>
  <div v-if="isInMatch && match.can_check_in" class="space-y-3">
    <div class="flex flex-col gap-1">
      <div class="flex justify-between items-center text-sm font-medium">
        <span>{{ $t("match.check_in.title") }}</span>
        <template v-if="isCheckedIn">
          <Badge variant="secondary">
            {{ $t("match.check_in.checked_in") }}
          </Badge>
        </template>
      </div>
      <p class="text-xs text-muted-foreground">
        <template v-if="isCheckedIn">
          {{
            $t("match.check_in.checked_in_description", {
              required: playersRequiredToStart,
              checked: totalCheckedIn,
            })
          }}
        </template>
        <template v-else>
          {{ $t("match.check_in.description") }}
        </template>
      </p>
    </div>

    <div v-if="!isCheckedIn">
      <Button
        size="sm"
        class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-pulse"
        @click="checkIn"
      >
        {{ $t("match.check_in.check_in") }}
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_check_in_settings_enum } from "~/generated/zeus";

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
      switch (this.match.options.check_in_setting) {
        case e_check_in_settings_enum.Players:
          return this.match.min_players_per_lineup * 2;
        case e_check_in_settings_enum.Captains:
          return 2;
        case e_check_in_settings_enum.Admin:
          return 1;
      }
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
