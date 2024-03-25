<template>
  <div
    class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto"
    v-if="canUpdateLineup1 || canUpdateLineup2"
  >
    <h1>Assign Coach</h1>

    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
        v-if="canUpdateLineup1"
      >
        <pre>{{ matchLineups.lineup1.coach }}</pre>

        <form @submit.prevent.stop>
          <five-stack-search-input
            :label="matchLineups.lineup1.name"
            placeholder="Find Player"
            v-model="form.lineup_1"
            :search="searchPlayers"
          ></five-stack-search-input>
        </form>
      </div>

      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
        v-if="canUpdateLineup2"
      >
        <pre>{{ matchLineups.lineup2.coach }}</pre>

        <form @submit.prevent.stop>
          <five-stack-search-input
            :label="matchLineups.lineup2.name"
            placeholder="Find Player"
            v-model="form.lineup_2"
            :search="searchPlayers"
          ></five-stack-search-input>
        </form>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import getMatchLineups from "~/utilities/getMatchLineups";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import { useAuthStore } from "~/stores/AuthStore";

export default {
  components: {
    FiveStackSearchInput,
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
          this.updateCoach(member.value.steam_id, this.matchLineups.lineup1.id);
        }
      },
    },
    ["form.lineup_2"]: {
      handler(member) {
        if (member) {
          this.updateCoach(member.value.steam_id, this.matchLineups.lineup2.id);
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
    async updateCoach(steam_id: bigint, match_lineup_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineups_by_pk: [
            {
              pk_columns: {
                id: match_lineup_id,
              },
              _set: {
                coach_steam_id: steam_id,
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
    me() {
      return useAuthStore().me;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
    canUpdateLineup1() {
      return (
        this.match.organizer_steam_id === this.me.steam_id ||
        this.matchLineups.lineup1.captain.player.steam_id === this.me.steam_id
      );
    },
    canUpdateLineup2() {
      return (
        this.match.organizer_steam_id === this.me.steam_id ||
        this.matchLineups.lineup2.captain.player.steam_id === this.me.steam_id
      );
    },
  },
};
</script>
