<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Check } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import MapDisplay from "~/components/MapDisplay.vue";
import MapSelector from "~/components/match/MapSelector.vue";
import { Separator } from "~/components/ui/separator";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import VetoTurnBanner from "~/components/match/VetoTurnBanner.vue";
import {
  vetoTileClasses,
  vetoTileHoverClasses,
  vetoTileActiveClasses,
  vetoTileDisabledClasses,
  vetoTileConfirmOverlayClasses,
  vetoTileConfirmPillClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <!-- The veto finishing used to drop this whole block -- banner, grid,
       separator, picks -- out of the page in one frame. It folds instead. -->
  <Transition
    leave-active-class="veto-collapse"
    leave-to-class="veto-collapse-to"
  >
    <div
      v-if="
        (!match.options.region_veto || match.region) &&
        match.status === 'Veto' &&
        match.match_maps.length < bestOf
      "
      class="grid grid-rows-[1fr]"
    >
      <div class="min-h-0">
        <div class="mb-4">
          <VetoTurnBanner
            :lineup-name="pickingLineupName"
            :action="$t('match.map_veto.is_picking')"
            :pick-label="pickType"
            :active="isPicking"
            :headline="turnHeadline"
            :subline="turnSubline"
            :you-label="$t('match.map_veto.your_turn')"
            :deadline="vetoPickDeadline"
            :total="match.options.veto_pick_timeout"
          />
        </div>

        <form @submit.prevent="vetoPick">
          <!-- The side chooser and the map grid are very different heights, and a
           BO3 alternates between them every other turn -- so they trade
           through a measured height swap instead of restacking the page. -->
          <HeightSwap>
            <div
              v-if="isPicking && pickType === e_veto_pick_types_enum.Side"
              key="side"
              class="flex flex-wrap items-center justify-center gap-6"
            >
              <!-- Same tile frame, hover ring and confirm pill as the map
                   step -- the side turn used to be two bare logos and read as
                   decoration rather than as the choice it is. -->
              <div
                v-for="(sideOption, idx) in sideOptions"
                :key="sideOption.value"
                class="relative w-[150px]"
                :class="idx === 0 ? 'order-first' : 'order-last'"
              >
                <div
                  :class="[
                    vetoTileClasses,
                    'flex flex-col items-center gap-1.5 px-2 pb-3 pt-4',
                    form.values.side === sideOption.value
                      ? vetoTileActiveClasses
                      : !submitting && vetoTileHoverClasses,
                    submitting &&
                      form.values.side !== sideOption.value &&
                      vetoTileDisabledClasses,
                  ]"
                  @click="
                    !submitting && form.setFieldValue('side', sideOption.value)
                  "
                >
                  <NuxtImg
                    :src="sideOption.img"
                    class="h-12 w-12 rounded-full drop-shadow-xl"
                  />
                  <span
                    class="text-center font-sans text-xs font-bold uppercase tracking-[0.06em]"
                    >{{ sideOption.display }}</span
                  >
                  <span
                    class="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
                    >{{ sideOption.role }}</span
                  >

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
                      :class="vetoTileConfirmOverlayClasses"
                      @click.stop="!submitting && vetoPick()"
                    >
                      <div :class="vetoTileConfirmPillClasses">
                        <Spinner v-if="submitting" />
                        <Check v-else class="w-4 h-4" />
                        <span>{{ $t("common.confirm") }}</span>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Guarded: the picks subscription can land a frame after the
                   veto flips to a side turn. -->
              <MapDisplay
                v-if="previousMap"
                class="h-[180px] rounded-lg order-1"
                :map="previousMap"
              >
                <span
                  class="mt-2 text-center font-mono text-[0.58rem] uppercase tracking-[0.16em] text-white/70"
                >
                  {{ $t("match.map_veto.side_for_map") }}
                </span>
              </MapDisplay>
            </div>

            <div v-else key="maps">
              <MapSelector
                :model-value="form.values.map_id"
                :map-pool="mapPool"
                :picks="picks"
                :loading="submitting"
                :readonly="!isPicking"
                :entrance="!picks?.length"
                :confirm-label="
                  $t('match.map_veto.confirm', { type: pickType })
                "
                @update:modelValue="
                  (mapId) => {
                    if (
                      pickType !== e_veto_pick_types_enum.Side &&
                      !submitting
                    ) {
                      form.setFieldValue('map_id', mapId);
                      vetoPick();
                    }
                  }
                "
              />
            </div>
          </HeightSwap>
        </form>

        <Separator class="my-6" />

        <!-- Always render so the reserved pick slots show before the first pick. -->
        <MatchPicksDisplay :match="match" :picks="picks" />
      </div>
    </div>
  </Transition>
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
import { isVetoOverrideEnabled } from "~/composables/useVetoOverride";
import { toast } from "@/components/ui/toast";
import mapLabel from "~/utilities/mapLabel";

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
            matchId: this.matchId || this.$route.params.id,
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
              auto_picked: true,
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
            match_id: this.matchId || this.$route.params.id,
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
    override() {
      return isVetoOverrideEnabled(this.match?.id);
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
    vetoPickDeadline() {
      if (!this.match.options.veto_pick_timeout) {
        return null;
      }

      return this.match.veto_pick_expires_at ?? null;
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
      return this.picks?.at(-1)?.map;
    },
    turnHeadline() {
      switch (this.pickType) {
        case e_veto_pick_types_enum.Side:
          return this.$t("match.map_veto.headline_side");
        case e_veto_pick_types_enum.Ban:
          return this.$t("match.map_veto.headline_ban");
        case e_veto_pick_types_enum.Pick:
          return this.$t("match.map_veto.headline_pick");
      }
      return null;
    },
    turnSubline() {
      if (this.pickType !== e_veto_pick_types_enum.Side) {
        return this.pickingLineupName;
      }

      return this.$t("match.map_veto.side_on_map", {
        team: this.pickingLineupName,
        map: mapLabel(this.previousMap),
      });
    },
    sideOptions() {
      return [
        {
          value: e_sides_enum.CT,
          display: this.$t("match.picks.counter_terrorist"),
          role: this.$t("match.map_veto.side_role_ct"),
          img: "/img/teams/ct_logo.svg",
        },
        {
          value: e_sides_enum.TERRORIST,
          display: this.$t("match.picks.terrorist"),
          role: this.$t("match.map_veto.side_role_t"),
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

<style scoped>
/* The whole block folds shut when the veto completes -- height, then gone.
   Everything inside (the banner's mb-4, the separator's my-6) rides inside
   the clipped row, so nothing is left to snap when the element unmounts. */
.veto-collapse {
  transition:
    grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-in;
}
.veto-collapse > * {
  overflow: hidden;
}
.veto-collapse-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .veto-collapse {
    transition-duration: 1ms;
  }
}
</style>
