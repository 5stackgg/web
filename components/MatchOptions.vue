<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Input } from "~/components/ui/input";
import { FormControl } from "~/components/ui/form";
</script>

<template>
  <div class="flex">
    <FormField
      v-slot="{ value, handleChange }"
      name="map_veto"
      v-if="!forceVeto"
    >
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base"> Map Veto </FormLabel>
          <FormDescription>
            Map Veto process is team 1 ban, team 2 ban, team 1 pick, team 2 pick
            side, team 2 pick, team 1 pick side, team 2 ban ... The process then
            repeats till a final map is remaining.
          </FormDescription>
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

    <FormField v-slot="{ value, handleChange }" name="region_veto">
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base"> Region Veto </FormLabel>
          <FormDescription>
            Allows veto to pick the region for the server to be used.
          </FormDescription>
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
  </div>

  <div class="flex">
    <FormField v-slot="{ value, handleChange }" name="knife_round">
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base"> Knife Rond </FormLabel>
          <FormDescription>
            Knife Rounds are only played when neither team did not pick the map
            in the map veto.
          </FormDescription>
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
          <Switch
            class="pointer-events-none"
            :checked="value"
            @update:checked="handleChange"
          />
        </FormControl>
      </FormItem>
    </FormField>
  </div>

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
          <Switch
            class="pointer-events-none"
            :checked="value"
            @update:checked="handleChange"
          />
        </FormControl>
      </FormItem>
    </FormField>

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
  </div>

  <div>
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
              <SelectValue placeholder="Select the max number of rounds" />
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

    <FormField v-slot="{ componentField }" name="tv_delay">
      <FormItem>
        <FormLabel>Tv Delay</FormLabel>
        <FormControl>
          <Input type="number" v-bind="componentField" />
          <FormMessage />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
  </div>

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
            <div class="relative cursor-pointer" @click="updateMapPool(map.id)">
              <MapDisplay :map="map"></MapDisplay>
              <div
                class="absolute inset-0 bg-black bg-opacity-55"
                v-if="!form.values.map_pool?.includes(map.id)"
              ></div>
            </div>
          </template>
        </div>
        <FormMessage />
      </FormItem>
    </FormField>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";

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
        this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
      },
    },
    ["form.values.custom_map_pool"]: {
      handler(customMapPool) {
        if (customMapPool === false) {
          this.form.setFieldValue("map_pool", []);
          this.form.setFieldValue("map_pool_id", this.defaultMapPool.id);
          return;
        }
        this.form.setFieldValue("map_pool_id", null);
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
    defaultMapPool() {
      return this.map_pools?.find((pool) => {
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
          case e_match_types_enum.ScrimmageNight:
            return map.type === e_match_types_enum.ScrimmageNight;
          case e_match_types_enum.Wingman:
            return map.type === e_match_types_enum.Wingman;
        }
      });
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
  },
};
</script>
