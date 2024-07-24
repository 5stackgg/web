<script setup lang="ts"></script>

<template>
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
    <FormField v-slot="{ value, handleChange }" name="map_veto">
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
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  props: {
    form: {
      required: true,
      type: Object,
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
  },
};
</script>
