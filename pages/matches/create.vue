<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent="createMatch">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Match Details
          </h2>

          <div class="mt-6 grid gap-4 lg:gap-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <five-stack-select-input
                :required="true"
                label="type"
                :options="matchTypes"
                v-model="form.type"
              ></five-stack-select-input>
              <five-stack-select-input
                :required="true"
                label="Max Rounds"
                :options="[`8`, '12', '15']"
                v-model="form.mr"
              ></five-stack-select-input>
            </div>
          </div>

          <div class="mt-6 grid gap-4 lg:gap-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <five-stack-checkbox
                class="mt-7"
                label="Veto"
                v-model="form.veto"
              ></five-stack-checkbox>

              <!--              // TODO - add maps instead of map for veto selection-->
              <five-stack-select-input
                :disabled="form.veto || !form.type || availabeMaps.length === 0"
                :required="!form.veto"
                label="Map"
                :options="availabeMaps"
                v-model="form.map"
              ></five-stack-select-input>
            </div>
          </div>

          <div class="mt-6 grid gap-4 lg:gap-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <five-stack-checkbox
                label="Overtime"
                v-model="form.overtime"
              ></five-stack-checkbox>
              <five-stack-checkbox
                label="Knife Round"
                v-model="form.knife_round"
              ></five-stack-checkbox>
            </div>
          </div>
        </form>
      </div>

      <tabs>
        <tab
          title="Pick 10"
          @click="
            form.team_1 = undefined;
            form.team_2 = undefined;
          "
        >
          <form @submit.prevent>
            <five-stack-search-input
              label="Team 1"
              placeholder="Find Player"
              v-model="form.players.lineup_1"
              :search="searchPlayers"
            ></five-stack-search-input>

            <five-stack-search-input
              label="Team 2"
              placeholder="Find Player"
              v-model="form.players.lineup_2"
              :search="searchPlayers"
            ></five-stack-search-input>
          </form>
        </tab>
        <tab
          title="Teams"
          @click="
            form.players.lineup_1 = [];
            form.players.lineup_2 = [];
          "
        >
          <form @submit.prevent>
            <five-stack-select-input
              :required="true"
              label="Team 1"
              :options="
                me.player.teams.map((team) => {
                  return {
                    value: team.id,
                    display: `${team.name}`,
                  };
                })
              "
              v-model="form.team_1"
            ></five-stack-select-input>

            <five-stack-search-input
              label="Team 2"
              placeholder="Search for a team to challenge"
              v-model="form.team_2"
              :required="true"
              :search="searchTeams"
            ></five-stack-search-input>
          </form>
        </tab>
      </tabs>
    </div>
    <div class="mt-10 text-right">
      <five-stack-button type="success" @click="createMatch"
        >Schedule Match</five-stack-button
      >
    </div>
  </div>

  <pre>{{ form }}</pre>
</template>

<script lang="ts">
import Tabs from "~/components/tabs/Tabs.vue";
import Tab from "~/components/tabs/Tab.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import FiveStackCheckbox from "~/components/forms/FiveStackCheckbox.vue";
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { $, e_match_types_enum, e_sides_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

export default {
  components: {
    FiveStackSearchInput,
    FiveStackTextInput,
    FiveStackCheckbox,
    FiveStackSelectInput,
    Tab,
    Tabs,
  },
  data() {
    return {
      form: {
        mr: "12",
        veto: true,
        type: e_match_types_enum.Competitive,
        map: undefined,
        knife_round: true,
        overtime: true,
        team_1: undefined,
        team_2: undefined,
        players: {
          lineup_1: [],
          lineup_2: [],
        },
      },
    };
  },
  apollo: {
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
  },
  watch: {
    ["form.veto"]: {
      handler() {
        this.form.map = undefined;
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

      return data.players
        .filter((player) => {
          return (
            this.form.players.lineup_1.indexOf(player) === -1 ||
            this.form.players.lineup_2.indexOf(player) === -1
          );
        })
        .map((player) => {
          return {
            value: player,
            display: `<img class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"src="${player.avatar_url}"> ${player.name} <small>[${player.steam_id}]</small>`,
          };
        });
    },
    async searchTeams(query) {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          teams: [
            {
              where: {
                _or: [
                  {
                    name: {
                      _ilike: `%${query}%`,
                    },
                  },
                ],
              },
            },
            {
              id: true,
              name: true,
              short_name: true,
            },
          ],
        }),
      });

      return data.teams.map((team) => {
        return {
          value: team.id,
          display: `${team.name} [${team.short_name}]`,
        };
      });
    },
    async createMatch() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_matches_one: [
            {
              object: {
                mr: this.form.mr,
                // veto: this.form.veto,
                type: this.form.type,
                map: this.form.map,
                knife_round: this.form.knife_round,
                overtime: this.form.overtime,
                lineup_1: {
                  data: {
                    team_id: this.form.team_1,
                    starting_side: e_sides_enum.CT,
                    lineup_players: {
                      data: this.form.players.lineup_1.map((player) => {
                        return {
                          steam_id: player.value.steam_id,
                        };
                      }),
                    },
                  },
                },
                lineup_2: {
                  data: {
                    // TODO - this is because of the search selector display issues
                    team_id: this.form.team_2?.value,
                    starting_side: e_sides_enum.TERRORIST,
                    lineup_players: {
                      data: this.form.players.lineup_2.map((player) => {
                        return {
                          steam_id: player.value.steam_id,
                        };
                      }),
                    },
                  },
                },
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/matches/${data.insert_matches_one.id}`);
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchTypes() {
      return Object.keys(e_match_types_enum);
    },
    availabeMaps() {
      const type = this.form.type;
      if (!this.maps) {
        return [];
      }
      return this.maps
        .filter((map) => {
          switch (type) {
            case e_match_types_enum.Competitive:
              return (
                map.type === e_match_types_enum.Competitive &&
                map.active_pool === true
              );
            case e_match_types_enum.Scrimmage:
              return (
                map.type === e_match_types_enum.Competitive &&
                map.active_pool === true
              );
            case e_match_types_enum.Wingman:
              return map.type === e_match_types_enum.Wingman;
          }
        })
        .map((map) => {
          return map.name;
        });
    },
  },
};
</script>
