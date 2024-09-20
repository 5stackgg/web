<script setup lang="ts">
import { Button } from "~/components/ui/button";
import MapSelector from "~/components/match/MapSelector.vue";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import { Separator } from "~/components/ui/separator";
</script>
<template>
  <MatchMapVeto
    :match="match"
    :map-pool="mapPool"
    v-if="match.options.map_veto"
  ></MatchMapVeto>
  <template v-else-if="canAssignMap">
    <h1>Select Map</h1>

    <form @submit.prevent="addMap">
      <MapSelector
        :model-value="form.values.map_id"
        :map-pool="mapPool"
        @update:modelValue="
          (mapId) => {
            form.setFieldValue('map_id', mapId);
          }
        "
      >
        Confirm Map
      </MapSelector>
    </form>
    <Separator />
  </template>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { $, e_sides_enum, order_by } from "~/generated/zeus";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    match_maps: {
      variables: function () {
        return {
          match_id: this.match.id,
        };
      },
      query: generateQuery({
        __alias: {
          match_maps: {
            matches_by_pk: [
              {
                id: $("match_id", "uuid!"),
              },
              {
                options: {
                  map_pool: [
                    {},
                    {
                      maps: [
                        {
                          order_by: {
                            name: order_by.asc,
                          },
                        },
                        mapFields,
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            map_id: z.string(),
          }),
        ),
      }),
    };
  },
  methods: {
    async addMap() {
      let currentMapCount = this.match.match_maps.length;

      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_match_maps_one: [
              {
                object: {
                  map_id: this.form.values.map_id,
                  order: ++currentMapCount,
                  match_id: this.match.id,
                  lineup_1_side: e_sides_enum.CT,
                  lineup_2_side: e_sides_enum.TERRORIST,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });
      } catch (error) {
        console.warn("unable to insert map", error);
      }

      this.form.resetForm();
    },
  },
  computed: {
    mapPool() {
      return this.match_maps?.options?.map_pool?.maps;
    },
    assigningMaps() {
      return (
        this.match.options.best_of > Object.keys(this.match.match_maps).length
      );
    },
    canAssignMap() {
      return (
        this.match.is_organizer &&
        this.assigningMaps &&
        this.match.options.map_veto === false
      );
    },
  },
};
</script>
