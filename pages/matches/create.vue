<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
</script>

<template>
  <form class="w-1/2 space-y-6" @submit.prevent="setupMatch">
    <div>
      <h3 class="mb-4 text-lg font-medium">Match Details</h3>

      <div class="flex">
        <FormField v-slot="{ value, handleChange }" name="coaches">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Allow Coaches </FormLabel>
              <FormDescription>
                Coaches will be spawned and killed at the start of each round
              </FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="overtime">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Overtime </FormLabel>
              <FormDescription>
                Each overtime is set of best of 4.
              </FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>
      </div>

      <div class="flex">
        <FormField v-slot="{ value, handleChange }" name="map_veto">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Map Veto </FormLabel>
              <FormDescription>
                Map Veto process is team 1 ban, team 2 ban, team 1 pick, team 2
                pick side, team 2 pick, team 1 pick side, team 2 ban ... The
                process then repeats till a final map is remaining.
              </FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="knife_round">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Knife Rond </FormLabel>
              <FormDescription>
                Knife Rounds are only played when neither team did not pick the
                map in the map veto.
              </FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>
      </div>

      <div>
        <FormField v-slot="{ componentField }" name="number_of_substitutes">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Substitutes </FormLabel>
              <FormDescription> Number of Substitutes </FormDescription>
            </div>
            <FormControl>
              <Input type="number" v-bind="componentField"></Input>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="type">
          <FormItem>
            <FormLabel>Match Type </FormLabel>

            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select the match type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="type.value" v-for="type of e_match_types">
                    {{ type.value }}
                    <div class="text-xs">
                      {{ type.description }}
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="best_of">
          <FormItem>
            <FormLabel>Best Of</FormLabel>

            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a best of value" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :value="bestOf.value"
                    v-for="bestOf of bestOfOptions"
                  >
                    {{ bestOf.display }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="mr">
          <FormItem>
            <FormLabel>Max Rounds</FormLabel>

            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select the max number of rounds" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :value="rounds"
                    v-for="rounds of [`8`, '12', '15']"
                  >
                    {{ rounds }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="custom_map_pool">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-base"> Custom Map Pool </FormLabel>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="map_pool">
          <FormItem v-show="form.values.custom_map_pool">
            <FormLabel>Custom Map Pool</FormLabel>
            <five-stack-map-picker
              v-model="componentField.modelValue"
              :match-type="form.values.type"
            ></five-stack-map-picker>
            <FormMessage />
          </FormItem>
        </FormField>
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
    </div>
    <Button type="submit"> Submit </Button>
  </form>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { $, e_match_types_enum } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  apollo: {
    e_match_types: {
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
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
              owner_steam_id: {
                _is_null: true,
              },
            },
          },
          {
            id: true,
            label: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            mr: z.string().default("12"),
            map_veto: z.boolean().default(false),
            coaches: z.boolean().default(false),
            knife_round: z.boolean().default(true),
            overtime: z.boolean().default(true),
            best_of: z.string().default("1"),
            custom_map_pool: z.boolean().default(false),
            number_of_substitutes: z.number().min(0).max(5).default(0),
            type: z.string().default(e_match_types_enum.Competitive),
            match_maps: z.string().array().default([]),
            team_1: z.string().optional(),
            team_2: z.string().optional(),
            map_pool: z.string().array().default([]),
          })
        ),
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
    async setupMatch() {
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
                match_pool_id: this.defaultMapPool.id,
              }
            : {}),
          map_pool:
            mapPoolLength > 0
              ? {
                  data: {
                    enabled: false,
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
                mr: $("mr", "Int!"),
                type: $("type", "e_match_types_enum!"),
                best_of: $("best_of", "Int!"),
                match_maps: $("maps", "match_maps_arr_rel_insert_input"),
                map_pool: $("map_pool", "map_pools_obj_rel_insert_input"),
                knife_round: $("knife_round", "Boolean!"),
                overtime: $("overtime", "Boolean!"),
                map_veto: $("map_veto", "Boolean!"),
                coaches: $("coaches", "Boolean!"),
                lineups: {
                  data: [
                    { lineup_players: { data: [] } },
                    { lineup_players: { data: [] } },
                  ],
                },
                ...(mapPoolLength === 0
                  ? { match_pool_id: $("match_pool_id", "uuid") }
                  : {}),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
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
    bestOfOptions() {
      return [1, 3, 5].map((rounds) => {
        return {
          value: rounds.toString(),
          display: `Best of ${rounds}`,
        };
      });
    },
    defaultMapPool() {
      return this.map_pools.find((pool) => {
        return pool.label === this.form.values.type;
      });
    },
  },
};
</script>
