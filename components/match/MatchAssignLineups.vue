<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <h1>Assign lineups</h1>

    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent.stop v-if="canAddToLineup1">
          <five-stack-search-input
            label="Team 1"
            placeholder="Find Player"
            v-model="form.lineup_1"
            :search="searchPlayers"
          ></five-stack-search-input>
        </form>
        <template v-else> Team 1 Lineup setup. </template>
      </div>

      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent.stop v-if="canAddToLineup2">
          <five-stack-search-input
            label="Team 2"
            placeholder="Find Player"
            v-model="form.lineup_2"
            :search="searchPlayers"
          ></five-stack-search-input>
        </form>
        <template v-else> Team 1 Lineup setup. </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import getMatchLineups from "~/utilities/getMatchLineups";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";

export default {
  components: {
    FiveStackSearchInput,
    FiveStackMapPicker,
    FiveStackSelectInput,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      form: {
        lineup_1: undefined,
        lineup_2: undefined,
      },
    };
  },
  watch: {
    ["form.lineup_1"]: {
      handler(member) {
        if (member) {
          this.form.lineup_1 = undefined;
          this.addMember(member.value.steam_id, this.matchLineups.lineup1.id);
        }
      },
    },
    ["form.lineup_2"]: {
      handler(member) {
        if (member) {
          this.form.lineup_2 = undefined;
          this.addMember(member.value.steam_id, this.matchLineups.lineup2.id);
        }
      },
    },
  },
  methods: {
    async searchPlayers(query) {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          players: [
            {
              where: {
                ...(/^[0-9]+$/.test(query)
                  ? {
                      steam_id: {
                        _eq: $("playerSteamIdQuery", "bigint"),
                      },
                    }
                  : {
                      name: {
                        _ilike: $("playerQuery", "String"),
                      },
                    }),
              },
            },
            {
              name: true,
              steam_id: true,
              avatar_url: true,
            },
          ],
        }),
        variables: {
          playerQuery: `%${query}%`,
          playerSteamIdQuery: query,
        },
      });

      return (
        data.players
          // .filter((player) => {
          //   return (
          //    TODO
          //   );
          // })
          .map((player) => {
            return {
              value: player,
              display: `<img class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"src="${player.avatar_url}"> ${player.name} <small>[${player.steam_id}]</small>`,
            };
          })
      );
    },
    async addMember(steam_id: bigint, match_lineup_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_lineup_players_one: [
            {
              object: {
                steam_id,
                match_lineup_id,
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
    matchLineups() {
      return getMatchLineups(this.match);
    },
    maxPlayersPerLineup() {
      return this.match?.type === "Wingman" ? 2 : 5;
    },
    canAddToLineup1() {
      return (
        this.matchLineups.lineup1?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    canAddToLineup2() {
      return (
        this.matchLineups.lineup2?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
  },
};
</script>
