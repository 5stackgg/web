<script setup lang="ts">
import { computed } from "vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { e_match_status_enum } from "~/generated/zeus";

// The match page's map cards: one slot per map of the series, a placeholder
// until the veto fills it.
const props = defineProps<{
  match: any;
  // The veto board shows the maps, so the cards fold away under it.
  folded?: boolean;
  // The maps are flying home from the veto board.
  arriving?: boolean;
  activeMapId?: string | null;
}>();

const emit = defineEmits<{ "open-stats": [matchMap: any] }>();

const ENDED: string[] = [
  e_match_status_enum.Finished,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
  e_match_status_enum.Tie,
  e_match_status_enum.Canceled,
];

const mapSlots = computed<any[]>(() => {
  const maps = props.match.match_maps || [];
  const bestOf = props.match.options?.best_of;
  if (!bestOf || ENDED.includes(props.match.status)) {
    return maps;
  }
  const slots: any[] = [];
  for (let i = 0; i < bestOf; i++) {
    slots.push(maps[i] || null);
  }
  return slots;
});
</script>

<template>
  <!-- While the veto board is up (the veto, then the start stage
         while the server boots) it shows the maps, so the cards fold
         away; once the server is ready the board folds and the cards
         unfold one after another. -->
  <div
    v-if="match.options.best_of && match.options.best_of > 0"
    class="grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
    :class="[
      folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
      arriving && 'veto-arriving',
    ]"
  >
    <div
      class="flex min-h-0 flex-col gap-3"
      :class="(folded || arriving) && 'overflow-hidden'"
    >
      <!-- Each veto pick turns a dashed placeholder into a real map
           card in place; the two are different heights, so each slot
           trades through its own measured swap instead of jerking the
           column on every pick. The group collapses the trailing
           placeholders away when the match ends. -->
      <TransitionGroup
        tag="div"
        class="flex flex-col gap-3"
        leave-active-class="map-slot-collapse"
        leave-to-class="map-slot-collapse-to"
      >
        <!-- minmax(0,1fr) on the column, not just grid-rows: an auto
             column track floors at the item's min-content, and a map
             card's min-content is its round history at full width. The
             card rendered ~730px wide inside a 400px column and drew
             over the scoreboard. -->
        <div
          v-for="(slot, index) in mapSlots"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)] grid-rows-[1fr]"
          :data-veto-home="`map-${Number(index) + 1}`"
        >
          <div class="min-h-0 min-w-0">
            <HeightSwap>
              <div v-if="slot" key="map">
                <MatchMaps
                  :match="match"
                  :match-map="slot"
                  :is-active="!!activeMapId && activeMapId === slot.id"
                  @open-stats="emit('open-stats', $event)"
                ></MatchMaps>
              </div>
              <div
                v-else
                key="tbd"
                class="rounded-xl overflow-hidden border-2 border-dashed border-border/60"
              >
                <div
                  class="aspect-[16/5] bg-muted/40 flex items-center justify-center text-muted-foreground"
                >
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-sm uppercase tracking-wide font-semibold">
                      {{ $t("match.map_number", { count: index + 1 }) }}
                    </span>
                    <span class="text-xs">
                      {{ $t("match.map_tbd") }}
                    </span>
                  </div>
                </div>
                <div class="bg-muted/40 border-t border-border/30 px-3 py-2.5">
                  <div class="flex items-center justify-center">
                    <span class="text-xs text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
            </HeightSwap>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/* A map slot leaving (trailing placeholders when the match ends) folds its
   height instead of vanishing in one frame. */
.map-slot-collapse {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.11s ease-in;
}
.map-slot-collapse > * {
  overflow: hidden;
}
.map-slot-collapse-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .map-slot-collapse {
    transition-duration: 1ms;
  }
}
/* A card stays hidden until its turn to unfold, and the cards' own unfold
   sets the column's height: a second open on top of it lags, then catches
   up, and the page drifts. */
.veto-arriving {
  transition-property: opacity;
}
.veto-arriving [data-veto-home]:not([data-landed]) {
  opacity: 0;
}
</style>
