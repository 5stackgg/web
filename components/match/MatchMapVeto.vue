<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Check } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
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
      class="mx-auto mb-4 flex w-full max-w-lg flex-col items-center gap-2 rounded-md border px-5 py-3 backdrop-blur-[6px] transition-colors duration-300"
      :class="
        isPicking
          ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] ring-1 ring-[hsl(var(--tac-amber)/0.25)]'
          : 'border-border bg-card/40'
      "
    >
      <!-- Never wraps: the two lineups alternate turns, so a long team name
           wrapping this row made the banner grow and shrink on every pick. The
           name truncates instead and keeps the full text in its tooltip. -->
      <div
        class="flex w-full min-w-0 flex-nowrap items-center justify-center gap-2 text-center"
      >
        <span
          class="min-w-0 truncate font-sans text-lg font-bold uppercase tracking-wide"
          :class="
            isPicking ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'
          "
          :title="pickingLineupName"
        >
          {{ pickingLineupName }}
        </span>
        <span
          class="shrink-0 font-sans text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >{{ $t("match.map_veto.is_picking") }}</span
        >
        <Badge
          variant="secondary"
          class="shrink-0 font-sans uppercase tracking-[0.14em]"
          >{{ pickType }}</Badge
        >
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

    <form @submit.prevent="vetoPick">
      <template v-if="isPicking && pickType === e_veto_pick_types_enum.Side">
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
                  !submitting &&
                  (!form.values.side ||
                    form.values.side !== sideOption.value),
                'pointer-events-none':
                  submitting && form.values.side !== sideOption.value,
              }"
              @click="!submitting && form.setFieldValue('side', sideOption.value)"
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
                  @click.stop="!submitting && vetoPick()"
                >
                  <div class="flex flex-col items-center gap-0.5">
                    <Spinner v-if="submitting" class="text-green-400" />
                    <Check v-else class="w-5 h-5 text-green-400" />
                    <span class="text-[10px] font-semibold text-white">{{
                      $t("common.confirm")
                    }}</span>
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
        :loading="submitting"
        :readonly="!isPicking"
        :confirm-label="$t('match.map_veto.confirm', { type: pickType })"
        @update:modelValue="
          (mapId) => {
            if (pickType !== e_veto_pick_types_enum.Side && !submitting) {
              form.setFieldValue('map_id', mapId);
              vetoPick();
            }
          }
        "
      />
    </form>

    <Separator class="my-6" />

    <!-- Always render so the reserved pick slots show before the first pick. -->
    <MatchPicksDisplay :match="match" :picks="picks" />
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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import { useSound } from "~/composables/useSound";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchId: {
      type: String,
      required: false,
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: (this.matchId || this.$route.params.id),
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
                label: true,
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
                  team: {
                    avatar_url: true,
                  },
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
      submitting: false,
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
          this.finishSubmitting();
        }
      },
    },
  },
  beforeUnmount() {
    if (this.submitTimeout) {
      clearTimeout(this.submitTimeout);
    }
  },
  methods: {
    finishSubmitting() {
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = undefined;
      }
      this.submitting = false;
      this.form.resetForm();
    },
    async vetoPick() {
      if (this.submitting) {
        return;
      }

      let { map_id, side } = this.form.values;

      if (this.pickType === e_veto_pick_types_enum.Side) {
        map_id = this.previousMap.id;
      }

      this.submitting = true;

      try {
        await this.$apollo.mutate({
          variables: {
            map_id,
            type: this.pickType,
            ...(side
              ? {
                  side,
                }
              : {}),
            match_id: (this.matchId || this.$route.params.id),
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

        this.submitTimeout = setTimeout(() => {
          this.finishSubmitting();
        }, 8000);
      } catch (error: any) {
        this.submitting = false;
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
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
    pickingLineupName() {
      if (this.match.lineup_1.is_picking_map_veto) {
        return this.match.lineup_1.name;
      }
      if (this.match.lineup_2.is_picking_map_veto) {
        return this.match.lineup_2.name;
      }
      return "";
    },
    previousMap() {
      return this.picks?.at(-1).map;
    },
    sideOptions() {
      return [
        {
          value: e_sides_enum.CT,
          display: this.$t("match.picks.counter_terrorist"),
          img: "/img/teams/ct_logo.svg",
        },
        {
          value: e_sides_enum.TERRORIST,
          display: this.$t("match.picks.terrorist"),
          img: "/img/teams/t_logo.svg",
        },
      ];
    },
    mapPool() {
      return this.match.options?.map_pool?.maps;
    },
  },
};
</script>
