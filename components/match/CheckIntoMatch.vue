<template>
  <div v-if="isInMatch && match.can_check_in">
    <button
      v-if="!isCheckedIn"
      type="button"
      :class="[tacticalCtaButtonClasses, 'w-full']"
      @click="checkIn"
    >
      <CheckCircle2 class="w-4 h-4" />
      <span>{{ $t("match.check_in.check_in") }}</span>
    </button>
    <div v-else class="flex items-center gap-3">
      <Badge variant="secondary" class="shrink-0 whitespace-nowrap">
        {{ $t("match.check_in.checked_in") }}
      </Badge>
      <span class="text-xs text-muted-foreground">
        {{
          $t("match.check_in.checked_in_description", {
            required: playersRequiredToStart,
            checked: totalCheckedIn,
          })
        }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { CheckCircle2 } from "lucide-vue-next";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_check_in_settings_enum } from "~/generated/zeus";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

export default {
  components: { CheckCircle2 },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  setup() {
    return { tacticalCtaButtonClasses };
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
