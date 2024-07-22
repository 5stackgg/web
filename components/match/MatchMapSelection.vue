<script setup lang="ts">
import { Button } from "~/components/ui/button";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MapSelector from "~/components/match/MapSelector.vue";
</script>

<template>
  <MatchMapVeto
    :match="match"
    :map-pool="mapPool"
    v-if="match.map_veto"
  ></MatchMapVeto>
  <template
    v-else-if="canAssignMap && assigningMaps && match.map_veto === false"
  >
    <Card class="sm:col-span-4">
      <CardHeader class="pb-3">
        <CardContent>
          <form @submit.prevent="addMap">
            <MapSelector
              :model-value="form.values.map_id"
              :map-pool="mapPool"
              @update:modelValue="
                (mapId) => {
                  form.setFieldValue('map_id', mapId);
                }
              "
            ></MapSelector>

            <Button
              type="submit"
              :disabled="Object.keys(form.errors).length > 0"
            >
              Pick Map
            </Button>
          </form>
        </CardContent>
      </CardHeader>
    </Card>
  </template>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { $, e_sides_enum, order_by } from "~/generated/zeus";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";

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
                map_pool: [
                  {},
                  {
                    maps: [
                      {
                        order_by: {
                          name: order_by.asc,
                        },
                      },
                      {
                        id: true,
                        name: true,
                        poster: true,
                        patch: true,
                      },
                    ],
                  },
                ],
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
    me() {
      return useAuthStore().me;
    },
    mapPool() {
      return this.match_maps?.map_pool?.maps;
    },
    canAssignMap() {
      return this.match.organizer_steam_id === this.me.steam_id;
    },
    assigningMaps() {
      return this.match.best_of > Object.keys(this.match.match_maps).length;
    },
  },
};
</script>
