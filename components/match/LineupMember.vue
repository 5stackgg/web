<template>
  <td class="w-2" @click="viewPlayer">
    <template v-if="member.player">
      {{ member.player.name }}
      <small> [{{ member.player.steam_id }}] </small>
    </template>
    <template v-else>
      {{ member.name }}
    </template>
    <span
      @click.stop.prevent="makeCaptain"
      class="ml-2 inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-800 shadow-sm dark:bg-slate-900 dark:border-gray-700 dark:text-white"
    >
      <template v-if="member.captain"> Captain </template>
      <template v-else-if="removeable">Promote</template>
    </span>
    <button v-if="removeable" @click.stop.prevent="removeFromLineup">
      Remove
    </button>
  </td>
</template>
<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    member: {
      type: Object,
      required: true,
    },
    lineup_id: {
      type: String,
      required: true,
    },
    removeable: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  methods: {
    viewPlayer() {
      this.$router.push(`/players/${this.member.steam_id}`);
    },
    async removeFromLineup() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup_id,
        },
      });
    },
    async makeCaptain() {
      if (this.member.captain) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
              _set: {
                captain: true,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup_id,
        },
      });
    },
  },
};
</script>
