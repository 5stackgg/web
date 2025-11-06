<script setup lang="ts">
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <PlayerSearch
    :label="$t('match.player.assign_slot')"
    :exclude="exclude.map((player) => player.steam_id)"
    :team-id="lineup.team_id"
    :self="true"
    @selected="(player) => addMember(player.steam_id)"
  ></PlayerSearch>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
    matchId: {
      type: String,
      required: true,
    },
    exclude: {
      type: Array,
      required: true,
      default: [],
    },
  },
  methods: {
    async addMember(steam_id: bigint) {
      if (!this.canAddWithoutInvite) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_match_invites_one: [
              {
                object: {
                  steam_id: steam_id,
                  match_id: this.matchId,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_lineup_players_one: [
            {
              object: {
                steam_id,
                match_lineup_id: this.lineup.id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    canAddWithoutInvite() {
      return useApplicationSettingsStore().canAddWithoutInvite;
    },
  },
};
</script>
