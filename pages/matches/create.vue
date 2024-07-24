<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MapDisplay from "~/components/MapDisplay.vue";
import MatchOptions from "~/components/MatchOptions.vue";
</script>

<template>
  <form class="w-1/2 space-y-6" @submit.prevent="setupMatch">
    <div>
      <h3 class="mb-4 text-lg font-medium">Match Details</h3>

      <match-options :form="form"></match-options>

      <FormField v-slot="{ value, handleChange }" name="custom_map_pool">
        <FormItem
          class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
          @click="handleChange(!value)"
        >
          <div class="space-y-0.5">
            <FormLabel class="text-base"> Custom Map Pool </FormLabel>
          </div>
          <FormControl>
            <Switch
              class="pointer-events-none"
              :checked="value"
              @update:checked="handleChange"
            />
          </FormControl>
        </FormItem>
      </FormField>

      <div v-show="form.values.custom_map_pool">
        <FormField name="map_pool">
          <FormItem>
            <FormLabel>Custom Map Pool</FormLabel>
            <div class="flex">
              <template v-for="map in availableMaps">
                <div
                  class="relative cursor-pointer"
                  @click="updateMapPool(map.id)"
                >
                  <MapDisplay :map="map"></MapDisplay>
                  <div
                    class="absolute inset-0 bg-black bg-opacity-55"
                    v-if="!form.values.map_pool.includes(map.id)"
                  ></div>
                </div>
              </template>
            </div>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </div>

    <FormField v-slot="{ handleChange, componentField }" name="team_1">
      <FormItem>
        <FormLabel>Team 1</FormLabel>
        <team-search
          label="Search for a Team ..."
          @selected="(team) => handleChange(team.id)"
          v-model="componentField.modelValue"
        ></team-search>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ handleChange, componentField }" name="team_2">
      <FormItem>
        <FormLabel>Team 2</FormLabel>
        <team-search
          label="Search for a Team ..."
          @selected="(team) => handleChange(team.id)"
          :exclude="[form.values.team_1]"
          v-model="componentField.modelValue"
        ></team-search>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit"> Submit </Button>
  </form>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { $, e_map_pool_types_enum, e_match_types_enum } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import matchOptionsValidator from "~/utilities/match-options-validator";

export default {
  apollo: {
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
    map_pools: {
      query: generateQuery({
        map_pools: [
          {
            where: {
              enabled: {
                _eq: true,
              },
              seed: {
                _eq: true,
              },
            },
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: matchOptionsValidator({
          custom_map_pool: z.boolean().default(false),
          match_maps: z.string().array().default([]),
          team_1: z.string().optional(),
          team_2: z.string().optional(),
          map_pool: z.string().array().default([]),
        }),
      }),
    };
  },
  watch: {
    ["form.values.custom_map_pool"]: {
      handler(customMapPool) {
        if (customMapPool === false) {
          this.form.setFieldValue("map_pool", []);
        }
      },
    },
  },
  methods: {
    updateMapPool(mapId: string) {
      const pool = Object.assign([], this.form.values.map_pool);
      if (pool.includes(mapId)) {
        pool.splice(pool.indexOf(mapId), 1);
      } else {
        pool.push(mapId);
      }

      this.form.setFieldValue("map_pool", pool);
    },
    async setupMatch() {
      const { valid } = await this.form.validate();

      console.info("VALID", valid);
      if (!valid) {
        return;
      }

      const form = this.form.values;

      let order = 0;
      const matchMaps = this.form.values.match_maps;
      const mapPoolLength = form?.map_pool?.length || 0;

      const { data } = await this.$apollo.mutate({
        variables: {
          mr: form.mr,
          type: form.type,
          best_of: form.best_of,
          knife_round: form.knife_round,
          overtime: form.overtime,
          map_veto: form.map_veto,
          coaches: form.coaches,
          number_of_substitutes: form.number_of_substitutes,
          maps:
            matchMaps.length > 0
              ? {
                  data: matchMaps.map((map) => {
                    return {
                      map_id: map,
                      order: ++order,
                    };
                  }),
                }
              : null,
          ...(mapPoolLength === 0
            ? {
                map_pool_id: this.defaultMapPool.id,
              }
            : {}),
          map_pool:
            mapPoolLength > 0
              ? {
                  data: {
                    type: e_map_pool_types_enum.Custom,
                    maps: {
                      data: form?.map_pool?.map((map_id) => {
                        return {
                          id: map_id,
                        };
                      }),
                    },
                  },
                }
              : null,
        },
        mutation: generateMutation({
          insert_matches_one: [
            {
              object: {
                options: {
                  data: {
                    mr: $("mr", "Int!"),
                    type: $("type", "e_match_types_enum!"),
                    best_of: $("best_of", "Int!"),
                    map_pool: $("map_pool", "map_pools_obj_rel_insert_input"),
                    knife_round: $("knife_round", "Boolean!"),
                    overtime: $("overtime", "Boolean!"),
                    map_veto: $("map_veto", "Boolean!"),
                    coaches: $("coaches", "Boolean!"),
                    ...(mapPoolLength === 0
                      ? { map_pool_id: $("map_pool_id", "uuid!") }
                      : {}),
                    number_of_substitutes: $("number_of_substitutes", "Int!"),
                  },
                },
                match_maps: $("maps", "match_maps_arr_rel_insert_input"),
                lineups: {
                  data: [
                    { lineup_players: { data: [] } },
                    { lineup_players: { data: [] } },
                  ],
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
    defaultMapPool() {
      return this.map_pools.find((pool) => {
        return pool.type === this.form.values.type;
      });
    },
    availableMaps() {
      if (!this.maps) {
        return [];
      }
      return this.maps.filter((map) => {
        switch (this.form.values.type) {
          case e_match_types_enum.Competitive:
            return (
              map.type === e_match_types_enum.Competitive &&
              map.active_pool === true
            );
          case e_match_types_enum.Scrimmage:
            return map.type === e_match_types_enum.Competitive;
          case e_match_types_enum.Wingman:
            return map.type === e_match_types_enum.Wingman;
        }
      });
    },
  },
};
</script>
