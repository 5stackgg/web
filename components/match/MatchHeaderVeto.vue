<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import VetoRail from "~/components/match/VetoRail.vue";
import { useAuthStore } from "~/stores/AuthStore";
import {
  mapVetoItems,
  mapVetoSteps,
  vetoLineups,
  viewerSlot,
} from "~/utilities/vetoLineups";
import { vetoBoardUp } from "~/utilities/vetoStage";
import { vetoHandoffPhase } from "~/composables/useVetoHandoff";

const props = defineProps<{
  match: any;
  // The veto's picks when the caller already has them (the FAQ's demo
  // match); otherwise they are fetched.
  picks?: any[];
}>();

const { t } = useI18n();

// A map veto ran and is over, on a match played here.
const vetoed = computed(() => {
  const match = props.match;
  if (match.source && match.source !== "5stack") return false;
  if (!match.options?.map_veto || match.status === "Veto") return false;
  return (match.match_maps ?? []).length > 0;
});

const { result } = useQuery(
  gql`
    query MatchHeaderVetoPicks($matchId: uuid!) {
      match_map_veto_picks(
        where: { match_id: { _eq: $matchId } }
        order_by: { created_at: asc }
      ) {
        id
        map {
          id
        }
        side
        type
        auto_picked
        match_lineup_id
      }
    }
  `,
  () => ({ matchId: props.match.id }),
  () => ({ enabled: vetoed.value && !props.picks }),
);
const picks = computed(
  () => props.picks ?? result.value?.match_map_veto_picks ?? [],
);

const arriving = computed(
  () => vetoHandoffPhase(props.match.id) === "arriving",
);

// Not while the board itself shows the veto; as soon as its rail is on the
// way here; otherwise once there are picks to show.
const show = computed(() => {
  if (!vetoed.value || vetoBoardUp(props.match)) return false;
  if (vetoHandoffPhase(props.match.id) === "stage") return false;
  return arriving.value || picks.value.length > 0;
});

const items = computed(() => mapVetoItems(props.match));
const steps = computed(() => mapVetoSteps(props.match, picks.value));
const lineups = computed(() => vetoLineups(props.match, t));
const viewerLineup = computed(() =>
  viewerSlot(props.match, useAuthStore().me?.steam_id),
);
</script>

<template>
  <!-- The veto's order of play, under the scorebug for the rest of the match.
       It opens as the start stage hands over to the page. -->
  <Transition
    enter-active-class="hv-fold"
    enter-from-class="hv-fold-from"
    leave-active-class="hv-fold"
    leave-to-class="hv-fold-from"
  >
    <div
      v-if="show"
      class="grid grid-rows-[1fr]"
      :class="{ 'is-arriving': arriving }"
    >
      <div class="min-h-0 overflow-hidden">
        <div class="hv">
          <span class="hv-label">{{ t("match.header.veto") }}</span>
          <VetoRail
            data-veto-home="rail"
            kind="map"
            :items="items"
            :steps="steps"
            :lineups="lineups"
            :viewer="viewerLineup"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* The header's own gap above the row lives inside it, so folded it takes no
   room at all. */
.hv {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding-top: 18px;
}
.hv-label {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.is-arriving [data-veto-home]:not([data-landed]) {
  opacity: 0;
}
.hv-fold {
  transition:
    grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 240ms ease;
}
.hv-fold-from {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (min-width: 768px) {
  .hv {
    padding-top: 20px;
  }
}
@media (max-width: 767px) {
  .hv {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hv-fold {
    transition-duration: 1ms;
  }
}
</style>
