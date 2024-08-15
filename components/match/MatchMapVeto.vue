<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import MapDisplay from "~/components/MapDisplay.vue";
import MapSelector from "~/components/match/MapSelector.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <template v-if="picks?.length > 0">
    <Separator></Separator>
    <div class="flex gap-4 h-[200px] overflow-hidden" v-if="picks?.length > 0">
      <template v-for="pick of picks">
        <template v-if="pick.type === 'Side'">
          <div class="relative">
            <NuxtImg
              :src="
                pick.side === 'CT'
                  ? '/img/teams/ct_logo.svg'
                  : '/img/teams/t_logo.svg'
              "
            ></NuxtImg>
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
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
  </template>

  <div v-if="match.status === 'Veto' && match.match_maps.length < bestOf">
    <Separator v-if="picks?.length > 0"></Separator>

    <div class="flex justify-between">
      <h1>
        <template v-if="match.lineup_1.is_picking_veto">
          {{ match.lineup_1.name }}
        </template>
        <template v-else-if="match.lineup_2.is_picking_veto">
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
      <template v-if="pickType === 'Side'">
        <div class="flex">
          <MapDisplay :map="previousMap"></MapDisplay>

          <div>
            <p>Select the Side your team wants to start on</p>

            <template v-for="sideOption in sideOptions" :key="sideOption.value">
              <div
                class="relative"
                :class="{
                  'bg-red-500': sideOption.value === form.values.side,
                }"
                @click="form.setFieldValue('side', sideOption.value)"
              >
                <NuxtImg :src="sideOption.img" />
                <div>
                  {{ sideOption.display }}
                </div>
              </div>
            </template>
          </div>
        </div>
        <Separator></Separator>
      </template>

      <MapSelector
        :model-value="form.values.map_id"
        :map-pool="mapPool"
        :picks="picks"
        @update:modelValue="
          (mapId) => {
            form.setFieldValue('map_id', mapId);
          }
        "
      ></MapSelector>

      <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
        {{ pickType }}
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
      match_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          match_veto_picks: [
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
          this.picks = data.match_veto_picks;
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
          match_lineup_id: this.match.veto_picking_lineup_id,
        },
        mutation: generateMutation({
          insert_match_veto_picks_one: [
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
        this.match.lineup_1.can_pick_veto || this.match.lineup_2.can_pick_veto
      );
    },
    pickType() {
      if (!this.match) {
        return;
      }

      return this.match.veto_type;
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
