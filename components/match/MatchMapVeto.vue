<script lang="ts" setup>
import VetoBoard from "~/components/match/VetoBoard.vue";
</script>

<template>
  <!-- The veto finishing used to drop this whole block out of the page in one
       frame. It folds instead. -->
  <Transition
    leave-active-class="veto-collapse"
    leave-to-class="veto-collapse-to"
  >
    <div v-if="boardUp" class="grid grid-rows-[1fr]">
      <div class="min-h-0">
        <VetoBoard
          kind="map"
          :items="items"
          :steps="steps"
          :lineups="lineups"
          :picking-lineup="pickingLineup"
          :is-picking="isPicking"
          :submitting="submitting"
          :deadline="vetoPickDeadline"
          :total="match.options.veto_pick_timeout"
          :best-of="bestOf"
          :viewer="viewerLineup"
          :scouting="scoutingView"
          :start="start"
          :hand-off="stage"
          :boot-status="bootStatus"
          :knife-round="!!match.options.knife_round"
          @confirm="onConfirm"
          @handoff="onHandoff"
        />
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
  e_veto_pick_types_enum,
  order_by,
  e_player_roles_enum,
} from "~/generated/zeus/index";
import { useSound } from "~/composables/useSound";
import { isVetoOverrideEnabled } from "~/composables/useVetoOverride";
import { toast } from "@/components/ui/toast";
import mapLabel from "~/utilities/mapLabel";
import { mapVetoSteps, vetoLineups, viewerSlot } from "~/utilities/vetoLineups";
import {
  vetoMapsSet,
  vetoStarting,
  vetoStartMaps,
  type VetoStart,
} from "~/utilities/vetoStage";
import { unfoldHome } from "~/utilities/vetoHandoff";
import { useVetoHandoff, vetoHandoffPhase } from "~/composables/useVetoHandoff";
import { loadVetoScouting } from "~/utilities/loadVetoScouting";
import type { ScoutLineup } from "~/utilities/vetoScouting";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

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
    // After the veto the board raises the maps while the server boots, then
    // folds them into the page's map cards. The draft room leaves for the
    // match page instead, so it keeps the finished veto up until it goes.
    stage: {
      type: Boolean,
      default: true,
    },
    // The server's state over the maps while it boots; off when the page
    // shows it where the Join Server button goes.
    bootStatus: {
      type: Boolean,
      default: true,
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
      scouting: null as [ScoutLineup | null, ScoutLineup | null] | null,
      playTickSound: useSound().playTickSound,
      playMatchFoundSound: useSound().playMatchFoundSound,
    };
  },
  watch: {
    isPicking: {
      immediate: true,
      handler(isPicking) {
        if (!isPicking) {
          return;
        }

        this.playMatchFoundSound();
      },
    },
    // History does not change during a veto, so it loads once per veto.
    scoutingKey: {
      immediate: true,
      async handler(key) {
        this.scouting = null;
        if (!key) {
          return;
        }
        const scouting = await loadVetoScouting(
          this.match,
          this.mapPool.map((map: any) => map.id),
        );
        if (key === this.scoutingKey) {
          this.scouting = scouting;
        }
      },
    },
    // The start stage holds the page (the map cards and the header's veto
    // row stay folded) until its maps have flown home.
    starting: {
      immediate: true,
      handler(starting) {
        if (starting && this.stage && !this.handoffPhase) {
          useVetoHandoff().value = { matchId: this.match.id, phase: "stage" };
        }
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
    if (this.handoffPhase === "stage") {
      useVetoHandoff().value = null;
    }
  },
  methods: {
    finishSubmitting() {
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = undefined;
      }
      this.submitting = false;
    },
    onHandoff() {
      const handoff = useVetoHandoff();
      const matchId = this.match.id;
      handoff.value = { matchId, phase: "arriving" };
      void unfoldHome().finally(() => {
        if (handoff.value?.matchId === matchId) {
          handoff.value = null;
        }
      });
    },
    onConfirm({ itemId, side }: { itemId?: string; side?: string }) {
      if (this.pickType === e_veto_pick_types_enum.Side) {
        if (!side || !this.previousMap) {
          return;
        }
        this.vetoPick(this.previousMap.id, side);
        return;
      }
      if (itemId) {
        this.vetoPick(itemId);
      }
    },
    async vetoPick(map_id: string, side?: string) {
      if (this.submitting) {
        return;
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
    pickingLineup() {
      if (this.match.lineup_1?.is_picking_map_veto) {
        return 1;
      }
      if (this.match.lineup_2?.is_picking_map_veto) {
        return 2;
      }
      return null;
    },
    vetoPickDeadline() {
      if (!this.match.options.veto_pick_timeout) {
        return null;
      }

      return this.match.veto_pick_expires_at ?? null;
    },
    previousMap() {
      return this.picks?.at(-1)?.map;
    },
    mapPool() {
      return this.match.options?.map_pool?.maps ?? [];
    },
    items() {
      return this.mapPool.map((map: any) => ({
        id: map.id,
        label: mapLabel(map),
        poster: map.poster,
        patch: map.patch,
      }));
    },
    lineups() {
      return vetoLineups(this.match, this.$t);
    },
    scoutingEnabled() {
      return useApplicationSettingsStore().vetoScoutingEnabled(
        this.match.options?.type,
      );
    },
    scoutingKey() {
      if (!this.scoutingEnabled || !this.mapPool.length) {
        return null;
      }
      return [
        this.match.id,
        this.match.lineup_1_id,
        this.match.lineup_2_id,
        ...this.mapPool.map((map: any) => map.id),
      ].join("|");
    },
    // The lineup you play on, so your side reads "You" and you see the other
    // side's habits.
    viewerLineup(): 1 | 2 | null {
      return viewerSlot(this.match, useAuthStore().me?.steam_id);
    },
    // On from the first frame, so the board keeps its height while the
    // history loads; dropped only when there turns out to be none.
    scoutingView() {
      if (!this.scoutingKey) {
        return null;
      }
      if (this.scouting && !this.scouting.some(Boolean)) {
        return null;
      }
      return {
        lineups: this.scouting ?? ([null, null] as [null, null]),
        viewer: this.viewerLineup,
      };
    },
    steps() {
      return mapVetoSteps(this.match, this.picks ?? []);
    },
    handoffPhase() {
      return vetoHandoffPhase(this.match.id);
    },
    starting() {
      return vetoStarting(this.match);
    },
    // After the last pick: the server booting (or waiting for one), then
    // ready for a beat before the board hands over to the page.
    startPhase(): VetoStart["phase"] | null {
      if (!this.stage || !this.regionSet || !vetoMapsSet(this.match)) {
        return null;
      }
      if (this.starting) {
        return this.match.status === "WaitingForServer" ? "waiting" : "booting";
      }
      return this.handoffPhase === "stage" ? "ready" : null;
    },
    start(): VetoStart | null {
      if (!this.startPhase) {
        return null;
      }
      return {
        phase: this.startPhase,
        maps: vetoStartMaps(this.match, this.picks ?? []),
      };
    },
    regionSet() {
      return !this.match.options.region_veto || !!this.match.region;
    },
    boardUp() {
      if (this.startPhase) {
        return true;
      }
      // The finished veto stays up, once its moves have arrived.
      if (!this.stage && this.regionSet && vetoMapsSet(this.match)) {
        return this.picks !== undefined;
      }
      return (
        this.regionSet &&
        this.match.status === "Veto" &&
        this.match.match_maps.length < this.bestOf
      );
    },
  },
};
</script>

<style scoped>
/* The whole block folds shut when the veto completes -- height, then gone.
   The page's spacing under it folds too, or it snaps shut at the end. */
.veto-collapse {
  transition:
    grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-in;
}
.veto-collapse > * {
  overflow: hidden;
}
.veto-collapse-to {
  grid-template-rows: 0fr;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .veto-collapse {
    transition-duration: 1ms;
  }
}
</style>
