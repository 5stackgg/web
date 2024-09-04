<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { FormControl } from "~/components/ui/form";
</script>

<template>
  <div v-if="isRegionVeto">
    <template v-if="match.options.region_veto && !match.region">
      <div class="flex justify-between my-3">
        <h1>
          <template v-if="match.lineup_1.is_picking_region_veto">
            {{ match.lineup_1.name }}
          </template>
          <template v-else-if="match.lineup_2.is_picking_region_veto">
            {{ match.lineup_2.name }}
          </template>
          is Banning a Region
        </h1>

        <div
          class="flex items-center space-x-2 cursor-pointer"
          @click="override = !override"
          v-if="match.is_organizer"
        >
          <Label>Match Organizer Override</Label>
          <Switch :checked="override" />
        </div>
      </div>

      <form @submit.prevent="vetoPick">
        <div class="flex gap-4">
          <div
            class="cursor-pointer relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
            :class="{
              grayscale: isPicking && region.value !== form.values.region,
              ring: isPicking && region.value === form.values.region,
              'opacity-10': match.region_veto_picks.find(
                (pick) => pick.region === region.value,
              ),
            }"
            v-for="region of regions"
            @click="form.setFieldValue('region', region.value)"
          >
            <NuxtImg
              src="/img/maps/screenshots/default.webp"
              class="w-full h-full object-cover max-w-[128px] rounded-[12px]"
              sizes="sm:128px"
            />
            <div class="absolute inset-0 bg-black bg-opacity-45"></div>
            <div
              class="absolute inset-0 flex flex-col items-center justify-center"
            >
              <div class="absolute bottom-3 text-sm">
                {{ region.description }}
              </div>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          :disabled="Object.keys(form.errors).length > 0"
          v-if="isPicking"
        >
          Ban
        </Button>
      </form>
    </template>
    <template
      v-else-if="
        match.is_organizer && !match.options.region_veto && regions.length > 1
      "
    >
      <Card class="sm:col-span-4">
        <CardHeader class="pb-3">
          <CardContent>
            <form @submit.prevent="setRegion">
              <FormField v-slot="{ componentField }" name="region">
                <FormItem>
                  <FormLabel>Server Region </FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select A Region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="region.value"
                          v-for="region of regions"
                        >
                          {{ region.description }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <Button
                type="submit"
                :disabled="Object.keys(form.errors).length > 0"
              >
                Set Server Region
              </Button>
            </form>
          </CardContent>
        </CardHeader>
      </Card>
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import {
  $,
  e_match_status_enum,
  e_veto_pick_types_enum,
} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    $subscribe: {
      e_game_server_node_regions: {
        query: typedGql("subscription")({
          e_game_server_node_regions: [
            {
              where: {
                game_server_nodes: {
                  enabled: {
                    _eq: true,
                  },
                },
                game_server_nodes_aggregate: {
                  count: {
                    predicate: {
                      _gt: 0,
                    },
                  },
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result({ data }) {
          this.regions = data.e_game_server_node_regions;
        },
      },
    },
  },
  watch: {
    isPicking: {
      immediate: true,
      handler() {
        this.form.setValues({
          region: undefined,
        });
      },
    },
  },
  data() {
    return {
      regions: [],
      override: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            region: z.string(),
          }),
        ),
      }),
    };
  },
  computed: {
    isPicking() {
      if (this.override && this.match.is_organizer) {
        return true;
      }

      return (
        this.match.lineup_1.can_pick_region_veto ||
        this.match.lineup_2.can_pick_region_veto
      );
    },
    isRegionVeto() {
      return this.match.status == e_match_status_enum.Veto;
    },
  },
  methods: {
    async setRegion() {
      let { region } = this.form.values;

      await this.$apollo.mutate({
        variables: {
          region,
        },
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.$route.params.id,
              },
              _set: {
                region: $("region", "e_game_server_node_regions_enum!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.resetForm();
    },
    async vetoPick() {
      let { region } = this.form.values;

      await this.$apollo.mutate({
        variables: {
          region,
          type: e_veto_pick_types_enum.Ban,
          match_id: this.$route.params.id,
          match_lineup_id: this.match.region_veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_region_veto_picks_one: [
            {
              object: {
                region: $("region", "e_game_server_node_regions_enum!"),
                type: $("type", "e_veto_pick_types_enum!"),
                match_id: $("match_id", "uuid!"),
                match_lineup_id: $("match_lineup_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.form.resetForm();
    },
  },
};
</script>
