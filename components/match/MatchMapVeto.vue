<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import MapDisplay from "~/components/MapDisplay.vue";
import MapSelector from "~/components/match/MapSelector.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <Separator v-if="picks?.length > 0 || match.options.region_veto && match.e_region"></Separator>

  <div class="flex gap-4 h-[200px] overflow-hidden" v-if="match.options.region_veto && match.e_region">
    <div class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]">
      <NuxtImg
        src="/img/maps/screenshots/default.webp"
        class="w-full h-full object-cover min-w-[150px]"
        sizes="sm:200px md:400px lg:1200"
      />
      <div class="absolute inset-0 bg-black bg-opacity-45"></div>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        {{ match.e_region.description }}
      </div>
    </div>

    <template v-for="pick of picks" v-if="picks?.length > 0">
      <template v-if="pick.type === 'Side'">
        <div
          class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
        >
          <NuxtImg
            src="/img/maps/screenshots/random.webp"
            class="w-full h-full object-cover min-w-[150px]"
            sizes="sm:200px md:400px lg:1200"
          />
          <div class="absolute inset-0 bg-black bg-opacity-45"></div>
          <div
            class="absolute inset-0 flex flex-col items-center justify-center"
          >
            <img
              :src="
                pick.side === 'CT'
                  ? '/img/teams/ct_logo.svg'
                  : '/img/teams/t_logo.svg'
              "
              class="max-w-[96px] w-full"
            />
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <MapDisplay :map="pick.map">
          <template v-slot:header>
            <div class="absolute top-3">
              <badge
                :variant="pick.type === 'Pick' ? 'default' : 'destructive'"
              >
                <template v-if="pick.type === 'Decider'"> Decider </template>
                <template v-else>
                  {{ pick.type }}
                </template>
              </badge>
            </div>
          </template>

          <template v-slot:default>
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
            </div>
          </template>
        </MapDisplay>
      </template>
    </template>
  </div>

  <div
    v-if="
      (!match.options.region_veto || match.region) &&
      match.status === 'Veto' &&
      match.match_maps.length < bestOf
    "
    class="py-3"
  >
    <Separator v-if="picks?.length > 0"></Separator>

    <div class="flex justify-between my-3">
      <h1>
        <template v-if="match.lineup_1.is_picking_map_veto">
          {{ match.lineup_1.name }}
        </template>
        <template v-else-if="match.lineup_2.is_picking_map_veto">
          {{ match.lineup_2.name }}
        </template>
        is Picking a
        <span class="underline">{{ pickType }}</span>
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

    <form @submit.prevent="vetoPick" v-if="isPicking">
      <template v-if="pickType === e_veto_pick_types_enum.Side">
        <div class="relative max-w-[800px] mx-auto">
          <MapDisplay class="w-full" :map="previousMap" />
          <div
            class="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-50"
          >
            <p class="text-lg font-bold text-center shadow-lg">
              Select the Side your team wants to start on
            </p>
            <div class="grid grid-cols-2 gap-8 w-full">
              <template
                v-for="sideOption in sideOptions"
                :key="sideOption.value"
              >
                <div
                  class="cursor-pointer flex flex-col items-center"
                  @click="form.setFieldValue('side', sideOption.value)"
                >
                  <NuxtImg
                    :src="sideOption.img"
                    class="w-full max-w-[120px] drop-shadow-xl"
                    :class="{
                      grayscale:
                        !form.values.side ||
                        sideOption.value !== form.values.side,
                      ['ring rounded-full']:
                        form.values.side &&
                        sideOption.value === form.values.side,
                    }"
                  />
                  <div class="mt-2 text-center">
                    {{ sideOption.display }}
                  </div>
                </div>
              </template>
            </div>
            <Button
              class="w-full max-w-[200px]"
              type="submit"
              :disabled="Object.keys(form.errors).length > 0"
            >
              Pick {{ pickType }}
            </Button>
          </div>
          <Separator />
        </div>
      </template>

      <MapSelector
        :model-value="form.values.map_id"
        :map-pool="mapPool"
        :picks="picks"
        @update:modelValue="
          (mapId) => {
            if (pickType !== e_veto_pick_types_enum.Side) {
              form.setFieldValue('map_id', mapId);
            }
          }
        "
      ></MapSelector>

      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        v-if="pickType !== e_veto_pick_types_enum.Side"
      >
        Select {{ pickType }}
      </Button>
    </form>
    <template v-else>
      <MapSelector :map-pool="mapPool" :picks="picks"></MapSelector>
    </template>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import {
  $,
  e_sides_enum,
  e_veto_pick_types_enum,
  order_by,
} from "~/generated/zeus/index";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    mapPool: {
      type: Array,
      required: true,
      default: [],
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_map_veto_picks: [
            {
              where: {
                match_id: {
                  _eq: $("matchId", "uuid!"),
                },
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by"),
                },
              ],
            },
            {
              id: true,
              map: {
                id: true,
                name: true,
                patch: true,
                poster: true,
              },
              side: true,
              type: true,
              match_lineup_id: true,
              match_lineup: [
                {},
                {
                  name: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          this.picks = data.match_map_veto_picks;
        },
      },
    },
  },
  data() {
    return {
      override: false,
      picks: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            map_id: z
              .string()
              .optional()
              .refine(
                (value, data) => {
                  if (this.pickType === e_veto_pick_types_enum.Side) {
                    return true;
                  }
                  return value !== undefined;
                },
                { message: "side is required" },
              ),
            side: z
              .string()
              .optional()
              .refine(
                (value, data) => {
                  if (this.pickType === e_veto_pick_types_enum.Side) {
                    return typeof value === "string" && value.trim() !== "";
                  }
                  return true;
                },
                { message: "side is required" },
              ),
          }),
        ),
      }),
    };
  },
  watch: {
    isPicking: {
      immediate: true,
      handler() {
        this.form.setValues({
          map_id: undefined,
        });
      },
    },
  },
  methods: {
    async vetoPick() {
      let { map_id, side } = this.form.values;

      if (this.pickType === e_veto_pick_types_enum.Side) {
        map_id = this.previousMap.id;
      }

      await this.$apollo.mutate({
        variables: {
          map_id,
          type: this.pickType,
          ...(side
            ? {
                side,
              }
            : {}),
          match_id: this.$route.params.id,
          match_lineup_id: this.match.map_veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_map_veto_picks_one: [
            {
              object: {
                map_id: $("map_id", "uuid!"),
                side: $("side", "String"),
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
  computed: {
    me() {
      return useAuthStore().me;
    },
    bestOf() {
      return this.match.options.best_of;
    },
    isPicking() {
      if (this.override && this.match.is_organizer) {
        return true;
      }

      return (
        this.match.lineup_1.can_pick_map_veto ||
        this.match.lineup_2.can_pick_map_veto
      );
    },
    pickType() {
      if (!this.match) {
        return;
      }

      return this.match.map_veto_type;
    },
    previousMap() {
      return this.picks?.at(-1).map;
    },
    sideOptions() {
      return [
        {
          value: e_sides_enum.CT,
          display: "Counter-Terrorist",
          img: "/img/teams/ct_logo.svg",
        },
        {
          value: e_sides_enum.TERRORIST,
          display: "Terrorist",
          img: "/img/teams/t_logo.svg",
        },
      ];
    },
  },
};
</script>
