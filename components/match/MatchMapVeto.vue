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
    <div
      v-if="
        (!match.options.region_veto || match.region) &&
        match.status === 'Veto' &&
        match.match_maps.length < bestOf
      "
      class="grid grid-rows-[1fr]"
    >
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
          :scouting="scoutingView"
          @confirm="onConfirm"
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
import { mapVetoOrder } from "~/utilities/vetoOrder";
import { lineupSlot, vetoLineups } from "~/utilities/vetoLineups";
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
      const steamId = useAuthStore().me?.steam_id;
      if (!steamId) {
        return null;
      }
      const on = (lineup: any) =>
        (lineup?.lineup_players ?? []).some(
          (member: any) => String(member.steam_id) === String(steamId),
        );
      if (on(this.match.lineup_1)) {
        return 1;
      }
      if (on(this.match.lineup_2)) {
        return 2;
      }
      return null;
    },
    scoutingView() {
      if (!this.scouting) {
        return null;
      }
      return { lineups: this.scouting, viewer: this.viewerLineup };
    },
    steps() {
      const picks = this.picks ?? [];
      return mapVetoOrder(this.bestOf, this.mapPool.length).map(
        (step, index) => {
          const pick = picks[index];
          return {
            ...step,
            record: pick
              ? {
                  itemId: pick.map.id,
                  lineup: lineupSlot(this.match, pick.match_lineup_id),
                  side: pick.side,
                  auto: pick.auto_picked,
                }
              : null,
          };
        },
      );
    },
  },
};
</script>

<style scoped>
/* The whole block folds shut when the veto completes -- height, then gone. */
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
