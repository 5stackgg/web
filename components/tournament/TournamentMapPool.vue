<script lang="ts" setup>
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
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
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { $, e_map_pool_types_enum, e_match_types_enum } from "~/generated/zeus";

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
  watch: {
    tournament: {
      immediate: true,
      handler() {
        this.form.setFieldValue(
          "map_pool",
          this.tournament.map_pool.maps.map(({ id }) => id) || []
        );
      },
    },
  },
  methods: {
    async updateTournamentMapPool() {
      console.info("update map pool!");

      const { data } = await this.$apollo.mutate({
        variables: {
          map_pool: {
            type: e_map_pool_types_enum.Custom,
            maps: {
              data: this.form.values.map_pool.map((map_id) => {
                return {
                  id: map_id,
                };
              }),
            },
          },
        },
        mutation: generateMutation({
          insert_map_pools_one: [
            {
              object: $("map_pool", "map_pools_insert_input!"),
            },
            {
              id: true,
            },
          ],
        }),
      });

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournaments_by_pk: [
            {
              pk_columns: {
                id: this.tournament.id,
              },
              _set: {
                map_pool_id: data.insert_map_pools_one.id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
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
