<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Check } from "lucide-vue-next";
import MapDisplay from "~/components/MapDisplay.vue";
import MapSelector from "~/components/match/MapSelector.vue";
import { Separator } from "~/components/ui/separator";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
</script>

<template>
  <div
    v-if="
      (!match.options.region_veto || match.region) &&
      match.status === 'Veto' &&
      match.match_maps.length < bestOf
    "
  >
    <div
      class="relative rounded-lg border-l-4 border border-border/50 px-5 py-3 mb-4 mx-auto max-w-lg w-full flex flex-col items-center gap-2 transition-colors duration-300"
      :class="
        isPicking
          ? 'border-l-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
          : 'border-l-primary bg-muted/40'
      "
    >
      <Badge
        v-if="isPicking"
        variant="default"
        class="absolute top-2 right-3 text-xs bg-blue-500 animate-pulse"
      >
        {{ $t("match.map_veto.your_turn") }}
      </Badge>

      <div class="flex items-center gap-2 text-center">
        <span
          class="text-lg font-bold"
          :class="isPicking ? 'text-blue-400' : 'text-primary'"
        >
          <template v-if="match.lineup_1.is_picking_map_veto">
            {{ match.lineup_1.name }}
          </template>
          <template v-else-if="match.lineup_2.is_picking_map_veto">
            {{ match.lineup_2.name }}
          </template>
        </span>
        <span class="text-muted-foreground">{{
          $t("match.map_veto.is_picking")
        }}</span>
        <Badge variant="secondary" class="text-sm">{{ pickType }}</Badge>
      </div>

      <div
        class="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground"
        @click="override = !override"
        v-if="canOverride"
      >
        <Label class="text-xs text-muted-foreground cursor-pointer">{{
          $t("match.map_veto.organizer_override")
        }}</Label>
        <Switch :model-value="override" />
      </div>
    </div>

    <form @submit.prevent="vetoPick" v-if="isPicking">
      <template v-if="pickType === e_veto_pick_types_enum.Side">
        <div class="flex items-center justify-center gap-10">
          <div
            v-for="(sideOption, idx) in sideOptions"
            :key="sideOption.value"
            class="flex flex-col items-center gap-3"
            :class="{ 'order-first': idx === 0, 'order-last': idx === 1 }"
          >
            <div
              class="relative cursor-pointer transition-all duration-300"
              :class="{
                'scale-110': form.values.side === sideOption.value,
                'opacity-30 scale-90':
                  form.values.side && form.values.side !== sideOption.value,
                'hover:scale-110':
                  !form.values.side || form.values.side !== sideOption.value,
              }"
              @click="form.setFieldValue('side', sideOption.value)"
            >
              <NuxtImg
                :src="sideOption.img"
                class="w-16 h-16 drop-shadow-xl rounded-full"
              />
              <div
                v-if="form.values.side === sideOption.value"
                class="absolute -inset-1 rounded-full border-2 border-primary animate-ping opacity-40"
              />
              <div
                v-if="form.values.side === sideOption.value"
                class="absolute -inset-1 rounded-full border-2 border-primary"
              />
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                leave-active-class="transition-all duration-150 ease-in"
                enter-from-class="opacity-0 scale-50"
                enter-to-class="opacity-100 scale-100"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-50"
              >
                <div
                  v-if="form.values.side === sideOption.value"
                  class="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-[3px]"
                  @click.stop="vetoPick"
                >
                  <div
                    class="p-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/30 shadow-xl shadow-black/30 ring-1 ring-white/10"
                  >
                    <Check class="w-4 h-4 text-green-400" />
                  </div>
                </div>
              </Transition>
            </div>
            <span
              class="text-xs font-semibold"
              :class="{
                'text-primary': form.values.side === sideOption.value,
                'text-muted-foreground':
                  form.values.side && form.values.side !== sideOption.value,
              }"
              >{{ sideOption.display }}</span
            >
          </div>

          <MapDisplay class="h-[180px] rounded-lg order-1" :map="previousMap" />
        </div>
      </template>

      <MapSelector
        v-else
        :model-value="form.values.map_id"
        :map-pool="mapPool"
        :picks="picks"
        @update:modelValue="
          (mapId) => {
            if (pickType !== e_veto_pick_types_enum.Side) {
              form.setFieldValue('map_id', mapId);
              vetoPick();
            }
          }
        "
        >{{ $t("match.map_veto.confirm", { type: pickType }) }}</MapSelector
      >
    </form>
    <template v-else>
      <MapSelector
        :class="{
          'pointer-events-none': true,
        }"
        :map-pool="mapPool"
        :picks="picks"
      ></MapSelector>
    </template>

    <Separator class="my-6" />

    <template v-if="picks?.length > 0 || hasAssignedRegion">
      <MatchPicksDisplay :match="match" :picks="picks" />
      <Separator class="mt-6" />
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
  e_player_roles_enum,
} from "~/generated/zeus/index";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { useSound } from "~/composables/useSound";

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
      playTickSound: useSound().playTickSound,
      playMatchFoundSound: useSound().playMatchFoundSound,
    };
  },
  watch: {
    isPicking: {
      immediate: true,
      handler(isPicking) {
        this.form.setValues({
          map_id: undefined,
        });

        if (!isPicking) {
          return;
        }

        this.playMatchFoundSound();
      },
    },
    picks: {
      handler(currentPicks, oldPicks) {
        if (oldPicks && currentPicks.length > oldPicks.length) {
          this.playTickSound();
        }
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
    canOverride() {
      return (
        this.match.is_organizer ||
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    isPicking() {
      if (this.canOverride && this.override) {
        return true;
      }

      if (this.match.is_organizer && !this.match.is_captain) {
        return false;
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
    hasAssignedRegion() {
      return this.match.options.region_veto && this.match.e_region;
    },
    mapPool() {
      return this.match.options?.map_pool?.maps;
    },
  },
};
</script>
