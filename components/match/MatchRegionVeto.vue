<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { FormControl } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div v-if="isRegionVeto && (isBanning || canSelectRegion)">
    <template v-if="match.options.region_veto">
      <div class="flex justify-between my-3">
        <h1>
          <template v-if="match.lineup_1.is_picking_region_veto">
            {{ match.lineup_1.name }}
          </template>
          <template v-else-if="match.lineup_2.is_picking_region_veto">
            {{ match.lineup_2.name }}
          </template>
          {{ $t("match.region_veto.banning") }}
        </h1>

        <div
          class="flex items-center space-x-2 cursor-pointer"
          @click="override = !override"
          v-if="match.is_organizer && isUser"
        >
          <Label>{{ $t("match.region_veto.organizer_override") }}</Label>
          <Switch :checked="override" />
        </div>
      </div>

      <div class="container mx-auto px-4">
        <div
          class="grid grid-cols-2 lg:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-6"
        >
          <div
            v-for="region in regions"
            :key="region.value"
            class="relative group"
          >
            <div
              @click="isPicking && form.setFieldValue('region', region.value)"
              class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px] h-[180px] transform"
              :class="{
                'cursor-pointer transition-all duration-300 ease-in-out hover:scale-105':
                  isPicking,
                'ring-4 ring-primary ring-opacity-50':
                  form.values.region === region.value,
                'opacity-30 pointer-events-none filter grayscale':
                  !availableRegions.includes(region.value),
              }"
            >
              <NuxtImg
                src="/img/maps/screenshots/default.webp"
                class="w-full h-full object-cover min-w-[150px]"
                sizes="sm:200px md:400px lg:600"
              />
              <div class="absolute inset-0 bg-black bg-opacity-45"></div>

              <div
                class="absolute inset-0 flex flex-col items-center justify-center"
              >
                <span
                  class="text-white text-xl font-bold uppercase text-center font-sans"
                >
                  {{ region.description }}
                </span>
              </div>
            </div>

            <div
              v-if="form.values.region === region.value"
              class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 cursor-pointer rounded-lg"
            >
              <Button variant="destructive" @click="vetoPick">
                {{ $t("match.region_veto.confirm_ban") }}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Separator></Separator>
    </template>
    <template v-else-if="canSelectRegion && !match.region">
      <Card class="sm:col-span-4">
        <CardHeader class="pb-3">
          <CardContent>
            <form @submit.prevent="setRegion">
              <FormField v-slot="{ componentField }" name="region">
                <FormItem>
                  <FormLabel>{{
                    $t("match.region_veto.server_region")
                  }}</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          :placeholder="$t('match.region_veto.select_region')"
                        />
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
      <Separator></Separator>
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
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_region_veto_picks: [
            {
              where: {
                match_id: {
                  _eq: $("matchId", "uuid!"),
                },
              },
            },
            {
              region: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.picks = data.match_region_veto_picks;
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
      picks: [],
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
    isUser() {
      return useAuthStore().isUser;
    },
    isPicking() {
      if (this.override && this.match.is_organizer && !this.isUser) {
        return true;
      }

      return (
        this.match.lineup_1.can_pick_region_veto ||
        this.match.lineup_2.can_pick_region_veto
      );
    },
    regions() {
      return useApplicationSettingsStore().availableRegions.filter((region) => {
        return region.is_lan === false;
      });
    },
    availableRegions() {
      return this.regions
        .filter(({ value }) => {
          if (
            this.picks.find(({ region }) => {
              return region === value;
            })
          ) {
            return false;
          }
          return true;
        })
        .map(({ value }) => {
          return value;
        });
    },
    isBanning() {
      return this.match.options.region_veto && !this.match.region;
    },
    isRegionVeto() {
      return this.match.status == e_match_status_enum.Veto;
    },
    canSelectRegion() {
      return (
        this.match.is_organizer &&
        !this.match.options.region_veto &&
        this.regions.length > 1
      );
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
                region: $("region", "String!"),
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
                region: $("region", "String!"),
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
