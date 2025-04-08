<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Button } from "~/components/ui/button";
</script>

<template>
  <Form :form="form" @submit="saveMapPool">
    <FormField name="map_pool">
      <FormItem>
        <div class="space-y-6">
          <template
            v-for="(maps, type) in {
              [$t('maps.official')]: sortedMaps.official,
              [$t('maps.workshop')]: sortedMaps.workshop,
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
                      'opacity-40': !form.values.map_pool?.includes(map.id),
                      'cursor-pointer transform hover:scale-105': true,
                    }"
                  >
                    <MapDisplay class="h-[150px]" :map="map">
                      <template v-slot:default v-if="map.active_pool">
                        <div class="absolute bottom-1">
                          <Badge variant="secondary" class="text-xs">{{
                            $t("maps.active_duty")
                          }}</Badge>
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

        <FormMessage />
      </FormItem>
    </FormField>
    <div class="mt-6 flex justify-end">
      <Button type="submit" :disabled="!form.values.map_pool?.length">
        Save Map Pool
      </Button>
    </div>
  </Form>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

interface Map {
  id: string;
  workshop_map_id?: string;
  active_pool?: boolean;
}

export default {
  props: {
    pool: {
      type: Object,
      required: true,
    },
    availableMaps: {
      type: Array as () => Map[],
      required: true,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            map_pool: z.array(z.string()),
          }),
        ),
      }),
    };
  },
  watch: {
    pool: {
      immediate: true,
      handler() {
        this.form.setFieldValue(
          "map_pool",
          this.pool.maps.map((map) => map.id),
        );
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
    async saveMapPool() {
      await this.$apollo.mutate({
        variables: {
          map_pool: this.form.values.map_pool,
        },
        mutation: generateMutation({
          delete__map_pool: [
            {
              where: {
                map_pool_id: {
                  _eq: this.pool.id,
                },
                map_id: {
                  _nin: this.form.values.map_pool,
                },
              },
            },
            {
              affected_rows: true,
            },
          ],
        }),
      });

      await this.$apollo.mutate({
        variables: {
          map_pool: this.form.values.map_pool,
        },
        mutation: generateMutation({
          insert__map_pool: [
            {
              objects: this.form.values.map_pool.map((mapId) => ({
                map_pool_id: this.pool.id,
                map_id: mapId,
              })),
              on_conflict: {
                constraint: "map_pool_pkey",
                update_columns: [],
              },
            },
            {
              affected_rows: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.map_pool.save_success"),
      });
    },
  },
  computed: {
    sortedMaps() {
      return {
        workshop: this.availableMaps.filter((map) => map.workshop_map_id),
        official: this.availableMaps.filter((map) => !map.workshop_map_id),
      };
    },
  },
};
</script>
