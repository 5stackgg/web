<script lang="ts" setup>
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  --
  <pre>{{ tournament }}</pre>
  --
  <form @submit.prevent="updateTournamentMapPool">
    <FormField name="map_pool">
      <FormItem>
        <FormLabel>Map Pool</FormLabel>
        <div class="flex">
          <template v-for="map in availableMaps">
            <div class="relative cursor-pointer" @click="updateMapPool(map.id)">
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
    <Button type="submit"> Submit </Button>
  </form>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { e_match_types_enum } from "~/generated/zeus";

export default {
  props: {
    tournament: {
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
        validationSchema: toTypedSchema(
          z.object({
            map_pool: z.string().array().default([]),
          })
        ),
      }),
    };
  },
  methods: {
    updateTournamentMapPool() {
      console.info("update map pool!", this.form.values);
    },
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
  computed: {
    availableMaps() {
      if (!this.maps) {
        return [];
      }
      return this.maps.filter((map) => {
        switch (this.tournament.type) {
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
