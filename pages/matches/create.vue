<template>
  <form class="w-1/2 space-y-6">
    <div>
      <h3 class="mb-4 text-lg font-medium">
        Match Details
      </h3>
      <pre>{{ form.values }}</pre>

      <div class="flex">
        <FormField v-slot="{ value, handleChange }" name="coaches">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer" @click="handleChange(!value)">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Allow Coaches
              </FormLabel>
              <FormDescription>
                Coaches will be spawned and killed at the start of each round
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :checked="value"
                  @update:checked="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="overtime">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer" @click="handleChange(!value)">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Overtime
              </FormLabel>
              <FormDescription>
                Each overtime is set of best of 4.
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :checked="value"
                  @update:checked="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>
      </div>

      <div class="flex">
        <FormField v-slot="{ value, handleChange }" name="map_veto">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer" @click="handleChange(!value)">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
               Map Veto
              </FormLabel>
              <FormDescription>
                Map Veto process is team 1 ban, team 2 ban, team 1 pick, team 2 pick side, team 2 pick, team 1 pick side, team 2 ban ...
                The process then repeats till a final map is remaining.
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :checked="value"
                  @update:checked="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="knife_round">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer" @click="handleChange(!value)">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Knife Rond
              </FormLabel>
              <FormDescription>
                Knife Rounds are only played when neither team did not pick the map in the map veto.
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :checked="value"
                  @update:checked="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>
      </div>

      <div class="flex">
        <FormField v-slot="{ componentField }" name="substitutes">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Substitutes
              </FormLabel>
              <FormDescription>
                Number of Substitutes
              </FormDescription>
            </div>
            <FormControl>
              <Input type="number" v-bind="componentField"></Input>
            </FormControl>
            <FormMessage/>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="type">
          <FormItem>
            <FormLabel>Match Type </FormLabel>

            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a verified email to display" />
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
                  <SelectValue placeholder="Select a verified email to display" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="bestOf.value" v-for="bestOf of bestOfOptions">
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
                  <SelectValue placeholder="Select a verified email to display" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="rounds" v-for="rounds of [`8`, '12', '15']">
                    {{ rounds }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>


      </div>

    </div>
    <Button type="submit">
      Submit
    </Button>
  </form>

<!--              <five-stack-map-picker-->
<!--                v-if="form.best_of == 1"-->
<!--                label="Map"-->
<!--                :required="true"-->
<!--                v-model="form.match_map"-->
<!--                :match-type="form.type"-->
<!--              ></five-stack-map-picker>-->
<!--              <five-stack-checkbox-->
<!--                v-else-->
<!--                label="Custom Map Pool"-->
<!--                v-model="custom_map_pool"-->
<!--              ></five-stack-checkbox>-->
<!--            </div>-->
<!--          </div>-->

<!--          <div class="mt-6 grid gap-4 lg:gap-6" v-if="form.best_of > 1">-->
<!--            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">-->
<!--              <template v-if="!custom_map_pool">-->
<!--                <pre>{{ defaultMapPool.id }}</pre>-->
<!--                <template v-for="map of defaultMapPool.maps">-->
<!--                  <p>{{ map.name }}</p>-->
<!--                </template>-->
<!--              </template>-->
<!--              <template v-else>-->
<!--                <pre>{{ form.map_pool }}</pre>-->
<!--                <five-stack-map-picker-->
<!--                  :disabled="!custom_map_pool"-->
<!--                  label="Custom Map Pool"-->
<!--                  v-model="form.map_pool"-->
<!--                  :match-type="form.type"-->
<!--                  :multiple="true"-->
<!--                ></five-stack-map-picker>-->
<!--              </template>-->
<!--            </div>-->
<!--          </div>-->
<!--        </form>-->
<!--      </div>-->

<!--      <tabs>-->
<!--        <tab-->
<!--          title="Pick 10"-->
<!--          @click="-->
<!--            form.team_1 = undefined;-->
<!--            form.team_2 = undefined;-->
<!--          "-->
<!--        >-->
<!--          <form @submit.prevent>-->
<!--            <five-stack-search-input-->
<!--              label="Team 1"-->
<!--              placeholder="Find Player"-->
<!--              v-model="form.players.lineup_1"-->
<!--              :search="searchPlayers"-->
<!--            ></five-stack-search-input>-->

<!--            <five-stack-search-input-->
<!--              label="Team 2"-->
<!--              placeholder="Find Player"-->
<!--              v-model="form.players.lineup_2"-->
<!--              :search="searchPlayers"-->
<!--            ></five-stack-search-input>-->
<!--          </form>-->
<!--        </tab>-->
<!--        <tab-->
<!--          title="Teams"-->
<!--          @click="-->
<!--            form.players.lineup_1 = [];-->
<!--            form.players.lineup_2 = [];-->
<!--          "-->
<!--        >-->
<!--          <form @submit.prevent>-->
<!--            <five-stack-select-input-->
<!--              :required="true"-->
<!--              label="Team 1"-->
<!--              :options="-->
<!--                me.player.teams.map((team) => {-->
<!--                  return {-->
<!--                    value: team.id,-->
<!--                    display: `${team.name}`,-->
<!--                  };-->
<!--                })-->
<!--              "-->
<!--              v-model="form.team_1"-->
<!--            ></five-stack-select-input>-->

<!--            <five-stack-search-input-->
<!--              label="Team 2"-->
<!--              placeholder="Search for a team to challenge"-->
<!--              v-model="form.team_2"-->
<!--              :required="true"-->
<!--              :search="searchTeams"-->
<!--            ></five-stack-search-input>-->
<!--          </form>-->
<!--        </tab>-->
<!--      </tabs>-->
<!--    </div>-->
<!--    <div class="mt-10 text-right">-->
<!--      <five-stack-button type="success" @click="setupMatch"-->
<!--        >Setup Match</five-stack-button-->
<!--      >-->
<!--    </div>-->
<!--  </div>-->
</template>

<script lang="ts">
import Tab from "~/components/tabs/Tab.vue";
import Tabs from "~/components/tabs/Tabs.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { $, e_match_types_enum } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import FiveStackCheckbox from "~/components/forms/FiveStackCheckbox.vue";
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import FiveStackNumberInput from "~/components/forms/FiveStackNumberInput.vue";
import { mapFields } from "~/graphql/mapGraphql";
import {useForm} from "vee-validate";
import {Input} from "~/components/ui/input";
import {toTypedSchema} from "@vee-validate/zod";
import * as z from "zod";

export default {
  components: {
    Input,
    FiveStackNumberInput,
    Tab,
    Tabs,
    FiveStackCheckbox,
    FiveStackTextInput,
    FiveStackMapPicker,
    FiveStackSearchInput,
    FiveStackSelectInput,
  },
  apollo: {
    e_match_types: {
      query: generateQuery({
        e_match_types: [
          {

          },
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
      custom_map_pool: false,
      form: useForm({
        validationSchema: toTypedSchema(
            z.object({
              mr: z.string().default("12"),
              map_veto: z.boolean().default(false),
              coaches: z.boolean().default(false),
              knife_round: z.boolean().default(true),
              overtime: z.boolean().default(true),
              best_of: z.string().default("1"),
              substitutes: z.number().min(0).max(5).default(0),
              type: z.string().default(e_match_types_enum.Competitive),
              match_map: z.string().optional(),
              team_1: z.string().optional(),
              team_2: z.string().optional(),
              map_pool: z.string().array(),
              players: z.object({
                lineup_1: z.string().array(),
                lineup_2: z.string().array(),
              })
            })
        )
      }),
    };
  },
  watch: {
    ["form.values.map_veto"]: {
      handler() {
        this.form.values.map = undefined;
      },
    },
  },
  methods: {
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
    async setupMatch() {
      const form = form.values;

      const useDefaultPool =
        form.best_of != 1 && form.map_pool.length == 0;

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
            form.best_of == 1
              ? {
                  data: [
                    {
                      order: 1,
                      map_id: form.match_map,
                    },
                  ],
                }
              : null,
          ...(useDefaultPool
            ? {
                match_pool_id: this.defaultMapPool.id,
              }
            : {}),
          map_pool:
            form.best_of != 1 && form.map_pool.length > 0
              ? {
                  data: {
                    enabled: false,
                    maps: {
                      data: form.map_pool.map((map_id) => {
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
                ...(useDefaultPool
                  ? { match_pool_id: $("match_pool_id", "uuid") }
                  : {}),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
                lineups: {
                  data: [
                    {
                      team_id: form.team_1,
                      lineup_players: {
                        data: form.players.lineup_1.map((player) => {
                          return {
                            steam_id: player.value.steam_id,
                          };
                        }),
                      },
                    },
                    {
                      // TODO - this is because of the search selector display issues
                      team_id: form.team_2?.value,
                      lineup_players: {
                        data: form.players.lineup_2.map((player) => {
                          return {
                            steam_id: player.value.steam_id,
                          };
                        }),
                      },
                    },
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
        return pool.label === this.form.type;
      });
    },
  },
};
</script>
