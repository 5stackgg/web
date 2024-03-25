<template>
  <pre>
    isCaptain :{{ isCaptain }}
    Best Of: {{ bestOf }}
    isPicking: {{ isPicking }} ({{ match.veto_picking_lineup_id }})
    isMatchOrganizer: {{ isMatchOrganizer }}
    isVeto: {{ bestOf }} / {{ match.match_maps.length }} ({{
      bestOf < match.match_maps.length
    }}
  </pre>

  <div class="grid grid-cols-4" v-for="pick of picks">
    <map-preview :map="pick.map">
      <br />
      {{ pick.type }}ed by

      {{ pick.match_lineup.name }}

      <template v-if="pick.side"> ({{ pick.side }}) </template>
    </map-preview>
  </div>

  <hr />

  <template v-if="bestOf < match.match_maps.length">
    <forms-five-stack-checkbox
      v-model="override"
      v-if="isMatchOrganizer"
      label="Match Organizer override"
    ></forms-five-stack-checkbox>

    <form @submit.prevent="pickMap" v-if="isPicking">
      <h1>{{ teamName }} Is Picking ({{ pickType }})</h1>
      <template v-if="pickType === 'Side'">
        <pre>{{ picks.at(-1) }}</pre>
        <five-stack-select-input
          label="Side"
          :options="sideOptions"
          v-model="form.side"
        ></five-stack-select-input>
      </template>
      <template v-else>
        <div class="grid grid-cols-4" v-for="availableMap of availableMaps">
          <map-preview
            :map="availableMap"
            class="cursor-pointer"
            :class="{
              'bg-red-500': form.map_id === availableMap.id,
            }"
            @click="form.map_id = availableMap.id"
          ></map-preview>
        </div>
      </template>

      <five-stack-button>{{ pickType }}</five-stack-button>
    </form>
  </template>
</template>

<script>
import { useAuthStore } from "~/stores/AuthStore";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import MapPreview from "~/components/veto/MapPreview.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import {
  $,
  e_match_types_enum,
  e_sides_enum,
  order_by,
} from "~/generated/zeus/index";

export default {
  components: { FiveStackSelectInput, MapPreview, FiveStackMapPicker },
  props: {
    match: {
      type: Object,
      required: true,
    },
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
                  _eq: $("matchId", "uuid!"),
                },
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by"),
                },
              ],
            },
            {
              id: true,
              map: {
                id: true,
                name: true,
              },
              side: true,
              type: true,
              match_lineup_id: true,
              match_lineup: [
                {},
                {
                  name: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          this.picks = data.match_veto_picks;
        },
      },
    },
  },
  data() {
    return {
      override: false,
      picks: undefined,
      form: {
        map: undefined,
        side: undefined,
      },
    };
  },
  methods: {
    async pickMap() {
      if (this.pickType === "Side") {
        this.form.map_id = this.picks.at(-1).map.id;
      }

      await this.$apollo.mutate({
        variables: {
          map_id: this.form.map_id,
          type: this.pickType,
          ...(this.form.side
            ? {
                side: this.form.side,
              }
            : {}),
          match_id: this.$route.params.id,
          match_lineup_id: this.match.veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_veto_picks_one: [
            {
              object: {
                map_id: $("map_id", "uuid!"),
                side: $("side", "String"),
                type: $("type", "String!"),
                match_id: $("match_id", "uuid!"),
                match_lineup_id: $("match_lineup_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.side = undefined;
      this.form.map_id = undefined;
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
      return this.myLineup?.captain.player.steam_id === this.me.steam_id;
    },
    myLineup() {
      return this.match?.lineups.find((lineup) => {
        return lineup?.lineup_players.find((player) => {
          return player.steam_id === this.me.steam_id;
        });
      });
    },
    isPicking() {
      if (!this.match) {
        return false;
      }

      if (this.override) {
        return true;
      }

      return this.myLineup.id === this.match.veto_picking_lineup_id;
    },
    isMatchOrganizer() {
      return this.match.organizer_steam_id === this.me.steam_id;
    },
    pickType() {
      if (!this.match || !this.picks) {
        return;
      }

      if (this.match.best_of === 1) {
        return "Ban";
      }

      const pattern = ["Ban", "Ban", "Pick", "Side", "Pick", "Side"];
      return pattern[this.picks.length % pattern.length];
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
        })
        .filter((map) => {
          return (
            this.picks?.find((pick) => {
              return pick.map.id === map.id;
            }) === undefined
          );
        });
    },
    sideOptions() {
      return [
        { value: e_sides_enum.CT, display: "Counter-Terrorist" },
        { value: e_sides_enum.TERRORIST, display: "Terrorist" },
      ];
    },
    teamName() {
      return this.match?.lineups.find((lineup) => {
        return lineup.id === this.match.veto_picking_lineup_id;
      }).name;
    },
  },
};
</script>
