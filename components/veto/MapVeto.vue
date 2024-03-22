<template>
  <pre>
    isCaptain :{{ isCaptain }}
    Best Of: {{ bestOf }}
    isPicking: {{ isPicking }}
  </pre>

  <div class="grid grid-cols-4" v-for="pick of picks">
    <map-preview :map="{ name: pick.map }" class="cursor-pointer bg-red-500"></map-preview>
  </div>

  <hr>

  <form @submit.prevent="pickMap" v-if="isPicking">
    <h1>Your Team Is Picking</h1>

    <template v-if="pickType === 'Side'">
      <pre>{{ picks.at(-1) }}</pre>
      <pre>{{ form }}</pre>
      <five-stack-select-input label="Side" :options="sideOptions" v-model="form.side"></five-stack-select-input>
    </template>
    <template v-else>
      <div class="grid grid-cols-4" v-for="availableMap of availableMaps">
        <map-preview :map="availableMap" class="cursor-pointer" :class="{
       'bg-red-500': form.map === availableMap.name,
     }" @click="form.map = availableMap.name"></map-preview>
      </div>
    </template>

    <five-stack-button>{{ pickType }}</five-stack-button>
  </form>
</template>

<script>

import {$, e_match_types_enum, order_by} from "~/generated/zeus/index";
import {useAuthStore} from "~/stores/AuthStore";
import {typedGql} from "~/generated/zeus/typedDocumentNode";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import {generateMutation, generateQuery} from "~/graphql/graphqlGen";
import {mapFields} from "~/graphql/mapGraphql";
import MapPreview from "~/components/veto/MapPreview.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";

export default {
  components: {FiveStackSelectInput, MapPreview, FiveStackMapPicker},
  props:{
    match: {
      type: Object,
      required: true,
    }
  },
  apollo: {
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
    $subscribe: {
      match_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_veto_picks: [
            {
              where: {
                match_id: {
                  _eq: $("matchId", "uuid!")
                }
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by")
                }
              ]
            },
            {
              id: true,
              map: true,
              side: true,
              type: true,
              match_lineup_id: true,
            }
          ]
        }),
        result: function ({ data }) {
          this.picks = data.match_veto_picks;
        },
      },
    },
  },
  data() {
    return {
      picks: undefined,
      form: {
        map: undefined,
        side: undefined,
      }
    }
  },
  methods: {
    async pickMap() {
      if(this.pickType === "Side") {
        await this.$apollo.mutate({
          variables: {
            side: this.form.side,
            id: this.picks.at(-1).id,
          },
          mutation: generateMutation({
            update_match_veto_picks_by_pk: [
              {
                pk_columns: {
                  id: $("id", "uuid!")
                },
                _set: {
                  side: $("side", "String!")
                }
              },
              {
                id: true,
              },
            ],
          }),
        });
        this.form.side = undefined;
        return;
      }

      await this.$apollo.mutate({
        variables: {
          map: this.form.map,
          type: this.pickType,
          match_id: this.$route.params.id,
          match_lineup_id: this.myLineup.id,
        },
        mutation: generateMutation({
          insert_match_veto_picks_one: [
            {
              object: {
                map: $("map", "String!"),
                type: $("type", "String!"),
                match_id: $("match_id", "uuid!"),
                match_lineup_id: $("match_lineup_id", "uuid!")
              }
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.map = undefined;
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    bestOf() {
      return this.match.best_of;
    },
    isCaptain() {
      return !!this.myLineup?.lineup_players.find((player) => {
        return player.steam_id === this.me.steam_id && player.captain === true;
      })
    },
    myLineup() {
      return this.match?.lineups.find((lineup) => {
        return lineup?.lineup_players.find((player) => {
          return player.steam_id === this.me.steam_id;
        })
      })
    },
    isPicking() {
      if(!this.match || !this.picks) {
        return false;
      }

      if(this.match.best_of === 1) {
        // TODO - test it
        return this.picks.length % 2;
      }


      const lastPick = this.picks.at(-1);
      if(lastPick?.type === "Pick" && lastPick.side == null && lastPick.match_lineup_id !== this.myLineup.id) {
        return true;
      }

      return this.picks.length % 2 === 0
    },
    pickType() {
      if(!this.match || !this.picks) {
        return;
      }

      if(this.match.best_of === 1) {
        return "Ban";
      }

      const lastPick = this.picks.at(-1);

      if(lastPick?.type === "Pick" && lastPick.side == null) {
        return "Side";
      }

      const pattern = ['Ban', 'Ban', 'Pick', 'Pick'];
      return pattern[this.picks.length % pattern.length]
    },
    availableMaps() {
      if (!this.maps) {
        return [];
      }
      return this.maps
          .filter((map) => {
            switch (this.match.type) {
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
          }).filter((map) =>{
            return this.picks.find((pick) => {
              return pick.map === map.name
            }) === undefined
          });
    },
    sideOptions() {
      return [{ value: "CT", display: "Counter-Terrorist"}, {value: "Terrorist", display: "Terrorist"}]
    },
  }
}
</script>