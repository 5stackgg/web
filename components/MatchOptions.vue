<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { FormControl } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
</script>
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Left Column -->
    <div class="space-y-6">
      <!-- Match Settings -->
      <div class="space-y-4">
        <slot name="left"></slot>

        <div class="grid grid-cols-1 gap-8 rounded-lg border p-4">
          <slot></slot>

          <FormField v-slot="{ componentField }" name="type">
            <FormItem>
              <FormLabel class="text-lg font-semibold">Match Type</FormLabel>
              <RadioGroup
                v-bind="componentField"
                class="grid grid-cols-2 gap-4 w-full"
              >
                <div
                  v-for="type in e_match_types"
                  :key="type.value"
                  class="flex items-center space-x-2 p-8 cursor-pointer"
                  @click="form.setFieldValue('type', type.value)"
                >
                  <RadioGroupItem :id="type.value" :value="type.value" />
                  <Label :for="type.value" class="flex flex-col cursor-pointer">
                    <span>{{ type.value }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{ type.description }}
                    </span>
                  </Label>
                </div>
              </RadioGroup>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="best_of">
            <FormItem>
              <FormLabel class="text-lg font-semibold">Best Of</FormLabel>
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
                      v-for="bestOf in bestOfOptions"
                      :key="bestOf.value"
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
              <FormLabel class="text-lg font-semibold">Max Rounds</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select max rounds" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      :value="rounds"
                      v-for="rounds in ['8', '12', '15']"
                      :key="rounds"
                    >
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

      <!-- Map Pool Selection -->
      <FormField name="map_pool">
        <FormItem>
          <Card>
            <CardHeader>
              <CardTitle class="flex justify-between items-center">
                <FormLabel class="text-lg font-semibold">
                  <template v-if="form.values.map_veto"> Map Pool </template>
                  <template v-else> Map Selection </template>
                </FormLabel>
                <div v-show="form.values.map_veto">
                  <FormField
                    v-slot="{ value, handleChange }"
                    name="custom_map_pool"
                  >
                    <FormControl>
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">Custom</span>
                        <Switch
                          :checked="value"
                          @update:checked="handleChange"
                          class="ml-2"
                        />
                      </div>
                    </FormControl>
                  </FormField>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-6">
                <template
                  v-for="(maps, type) in {
                    'Official Maps': availableMaps.official,
                    'Workshop Maps': availableMaps.workshop,
                  }"
                  :key="type"
                >
                  <div v-if="maps && maps.length > 0">
                    <Separator
                      v-if="type === 'Workshop Maps'"
                      class="text-2xl font-bold mb-4 text-center my-8"
                      :label="type"
                    ></Separator>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <template v-for="map in maps" :key="map.id">
                        <div
                          class="relative rounded-lg overflow-hidden transition-all duration-200 ease-in-out"
                          @click="updateMapPool(map.id)"
                          :class="{
                            'opacity-40':
                              form.values.custom_map_pool &&
                              !form.values.map_pool?.includes(map.id),
                            'cursor-pointer transform hover:scale-105':
                              form.values.custom_map_pool,
                          }"
                        >
                          <MapDisplay class="h-[150px]" :map="map">
                            <template v-slot:default v-if="map.active_pool">
                              <div class="absolute bottom-1">
                                <Badge variant="secondary" class="text-xs"
                                  >Active Duty</Badge
                                >
                              </div>
                            </template>
                          </MapDisplay>
                          <div
                            class="absolute inset-0 flex items-center justify-center bg-opacity-40 transition-opacity duration-200"
                          ></div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </CardContent>
          </Card>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <FormField
        v-slot="{ value, handleChange }"
        name="map_veto"
        v-if="!forceVeto"
      >
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Map Veto</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription>
            Map Veto process: team 1 ban, team 2 ban, team 1 pick, team 2 pick
            side, team 2 pick, team 1 pick side, team 2 ban. Process repeats
            until final map is selected.
          </FormDescription>
        </FormItem>
      </FormField>

      <FormField
        v-slot="{ value, handleChange }"
        name="lan"
        v-if="hasLanRegion && canSetLan"
      >
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Lan</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription> Use LAN Servers </FormDescription>
        </FormItem>
      </FormField>

      <FormField
        v-slot="{ value, handleChange }"
        name="region_veto"
        v-if="regions.length > 1"
      >
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="form.values.lan === false && handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Region Veto</FormLabel>
            <FormControl>
              <Switch
                :disabled="form.values.lan"
                class="pointer-events-none"
                :checked="value"
                @update:checked="form.values.lan === false && handleChange"
              />
            </FormControl>
          </div>
          <FormDescription>
            Allows teams to veto and select the server region.
          </FormDescription>
        </FormItem>
      </FormField>

      <FormField v-slot="{ value, handleChange }" name="knife_round">
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Knife Round</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription>
            Knife rounds are only played when neither team picked the map in the
            veto.
          </FormDescription>
        </FormItem>
      </FormField>

      <FormField v-slot="{ value, handleChange }" name="overtime">
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Overtime</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription> Each overtime is a best of 6. </FormDescription>
        </FormItem>
      </FormField>

      <FormField v-slot="{ value, handleChange }" name="coaches">
        <FormItem
          class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
          @click="handleChange(!value)"
        >
          <div class="flex justify-between items-center">
            <FormLabel class="text-lg font-semibold">Allow Coaches</FormLabel>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :checked="value"
                @update:checked="handleChange"
              />
            </FormControl>
          </div>
          <FormDescription>
            Coaches will be spawned and killed at the start of each round.
          </FormDescription>
        </FormItem>
      </FormField>

      <div class="flex flex-col space-y-3 rounded-lg border p-4">
        <FormField v-slot="{ value }" name="number_of_substitutes">
          <FormItem>
            <FormLabel class="text-lg font-semibold"
              >Number of Substitutes</FormLabel
            >
            <NumberField
              class="gap-2"
              :min="0"
              :max="10"
              :model-value="value"
              @update:model-value="
                (number_of_substitutes) => {
                  form.setFieldValue(
                    'number_of_substitutes',
                    number_of_substitutes,
                  );
                }
              "
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <FormControl>
                  <NumberFieldInput />
                </FormControl>
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <FormDescription> Enter value between 0 and 10. </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ value }" name="tv_delay">
          <FormItem>
            <FormLabel class="text-lg font-semibold">TV Delay</FormLabel>
            <NumberField
              class="gap-2"
              :min="0"
              :max="120"
              :model-value="value"
              @update:model-value="
                (delay) => {
                  form.setFieldValue('tv_delay', delay);
                }
              "
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <FormControl>
                  <NumberFieldInput />
                </FormControl>
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <FormDescription> Enter value between 0 and 120. </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>

      <div class="flex flex-col space-y-3 rounded-lg border p-4">
        <FormField v-slot="{ componentField }" name="timeout_setting">
          <FormItem>
            <FormLabel class="text-lg font-semibold"
              >Timeout Settings</FormLabel
            >
            <FormControl>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      :value="timeoutSetting.value"
                      v-for="timeoutSetting in timeoutSettings"
                      :key="timeoutSetting.value"
                    >
                      {{ timeoutSetting.display }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="tech_timeout_setting">
          <FormItem>
            <FormLabel class="text-lg font-semibold"
              >Tech Timeout Settings</FormLabel
            >
            <FormControl>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      :value="timeoutSetting.value"
                      v-for="timeoutSetting in timeoutSettings"
                      :key="timeoutSetting.value"
                    >
                      {{ timeoutSetting.display }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum, e_timeout_settings_enum } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { useMatchMakingStore } from "~/stores/MatchMakingStore";

export default {
  props: {
    form: {
      required: true,
      type: Object,
    },
    forceVeto: {
      required: false,
      type: Boolean,
      default: false,
    },
  },
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
  watch: {
    defaultMapPool: {
      immediate: true,
      handler(defaultMapPool) {
        if (!defaultMapPool) {
          return;
        }

        if (this.form.values.custom_map_pool) {
          return;
        }

        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    ["form.values.lan"]: {
      handler(lan) {
        this.form.setFieldValue("region_veto", !lan && this.regions.length > 0);
      },
    },
    ["form.values.type"]: {
      handler(type) {
        if (type === e_match_types_enum.Wingman) {
          this.form.setFieldValue("mr", "8");
        } else {
          this.form.setFieldValue("mr", "12");
        }

        this.form.setFieldValue("custom_map_pool", false);
        this.form.setFieldValue("map_pool", []);
        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    ["form.values.custom_map_pool"]: {
      handler(custom_map_pool) {
        // only update if its a custom map pool and it matches the default
        // this helps the UI know wether to reset the map pool list or not
        if (
          custom_map_pool &&
          this.form.values.map_pool_id !== this.defaultMapPool.id
        ) {
          return;
        }

        this.form.setFieldValue("map_pool", []);

        if (!this.form.values.map_veto || custom_map_pool) {
          this.form.setFieldValue("map_pool_id", null);
          return;
        }

        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    ["form.values.map_veto"]: {
      handler(mapVeto) {
        if (mapVeto) {
          this.form.setFieldValue("custom_map_pool", false);
          return;
        }

        this.form.setFieldValue("custom_map_pool", true);
      },
    },
    ["form.values.map_pool"]: {
      handler() {
        if (this.form.values.map_veto) {
          return;
        }

        if (this.form.values.map_pool.length === 1) {
          return;
        }

        this.form.setFieldValue("map_pool", [this.form.values.map_pool.at(-1)]);
      },
    },
  },
  computed: {
    bestOfOptions() {
      return [1, 3, 5].map((rounds) => {
        return {
          value: rounds.toString(),
          display: `Best of ${rounds}`,
        };
      });
    },
    timeoutSettings() {
      return [
        {
          display: "Admins",
          value: e_timeout_settings_enum.Admin,
        },
        {
          display: "Coches",
          value: e_timeout_settings_enum.Coach,
        },
        {
          display: "Everyone",
          value: e_timeout_settings_enum.CoachAndPlayers,
        },
      ];
    },
    defaultMapPool() {
      return this.map_pools?.find((pool) => {
        return pool.type === this.form.values.type;
      });
    },
    availableMaps() {
      if (!this.maps) {
        return [];
      }

      const maps = this.maps
        .filter((map) => {
          if (
            this.form.values.custom_map_pool === false &&
            map.active_pool === false
          ) {
            return false;
          }

          switch (this.form.values.type) {
            case e_match_types_enum.Competitive:
              return map.type === e_match_types_enum.Competitive;
            case e_match_types_enum.Wingman:
              return map.type === e_match_types_enum.Wingman;
          }
        })
        .sort((a, b) => {
          // First, sort active pool maps to the top
          if (a.active_pool && !b.active_pool) return -1;
          if (!a.active_pool && b.active_pool) return 1;

          // Finally, sort by name
          return a.name.localeCompare(b.name);
        });

      return {
        official: maps.filter((map) => !map.workshop_map_id),
        workshop: maps.filter((map) => map.workshop_map_id),
      };
    },
    hasLanRegion() {
      return useMatchMakingStore().regions.find((region) => {
        return region.value === "Lan";
      });
    },
    regions() {
      return useMatchMakingStore().regions.filter((region) => {
        return region.value !== "Lan";
      });
    },
    canSetLan() {
      const { isAdmin, isMatchOrganizer, isTournamentOrganizer } =
        useAuthStore();
      return isAdmin || isMatchOrganizer || isTournamentOrganizer;
    },
  },
  methods: {
    updateMapPool(mapId: string) {
      if (!this.form.values.custom_map_pool) {
        return;
      }
      this.touched++;
      const pool = Object.assign([], this.form.values.map_pool);
      if (pool.includes(mapId)) {
        pool.splice(pool.indexOf(mapId), 1);
      } else {
        pool.push(mapId);
      }

      this.form.setFieldValue("map_pool", pool);
    },
  },
};
</script>
