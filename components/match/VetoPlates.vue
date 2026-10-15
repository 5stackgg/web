<script setup lang="ts">
import { useI18n } from "vue-i18n";
import VetoCrest from "~/components/match/VetoCrest.vue";
import type { VetoBoardLineup } from "~/utilities/vetoOrder";
import type { VetoStartSide } from "~/utilities/vetoStage";

// The two teams on a map to be played: each on a small plate with its crest,
// name and the side it starts on, or a knife round when that is still to be
// won. Yours sits a step brighter, as your moves do on the rail.
defineProps<{
  sides: { 1: VetoStartSide; 2: VetoStartSide } | null;
  lineups: [VetoBoardLineup, VetoBoardLineup];
  viewer?: 1 | 2 | null;
}>();

const { t } = useI18n();

const sideIcon = (side: VetoStartSide) =>
  side === "CT" ? "/img/teams/ct_logo.svg" : "/img/teams/t_logo.svg";
</script>

<template>
  <div class="plates">
    <template v-if="sides">
      <div
        v-for="lineup in [1, 2] as const"
        :key="lineup"
        class="plate"
        :class="{ 'is-you': viewer === lineup }"
        :title="`${lineups[lineup - 1].name} · ${t('match.veto.start.starts', { side: sides[lineup] })}`"
      >
        <VetoCrest :lineup="lineups[lineup - 1]" :size="26" />
        <b>{{ lineups[lineup - 1].name }}</b>
        <img class="side" :src="sideIcon(sides[lineup])" :alt="sides[lineup]" />
      </div>
    </template>
    <div v-else class="plate is-knife">
      <span class="vs"
        ><VetoCrest
          :lineup="lineups[0]"
          :size="22"
          :class="{ 'is-mine': viewer === 1 }" />{{ t("common.vs")
        }}<VetoCrest
          :lineup="lineups[1]"
          :size="22"
          :class="{ 'is-mine': viewer === 2 }"
      /></span>
      <span class="tx"
        ><b>{{ t("match.veto.start.knife") }}</b
        ><small>{{ t("match.veto.start.knife_line") }}</small></span
      >
    </div>
  </div>
</template>

<style scoped>
.plates {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}
.plate {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 8px;
  background: rgb(10 10 14 / 0.6);
  backdrop-filter: blur(6px);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
}
.plate.is-you {
  background: rgb(60 60 70 / 0.78);
}
.plate.is-you .veto-crest,
.plate .veto-crest.is-mine {
  box-shadow: 0 0 0 2px hsl(var(--tac-amber));
}
.plate > b,
.plate .tx b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.plate .side {
  width: 24px;
  height: 24px;
  flex: none;
  margin-left: auto;
  filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.5));
}
.plate .tx {
  display: grid;
  min-width: 0;
  line-height: 1.2;
}
.plate .tx small {
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  color: hsl(0 0% 100% / 0.75);
}
.plate.is-knife {
  grid-column: 1 / -1;
}
.plate.is-knife .vs {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}
/* The map they sit on is a container named panel. A best of three's maps:
   the plate drops the name, crest and side stay. */
@container panel (max-width: 300px) {
  .plate > b {
    display: none;
  }
}
/* Narrow maps: the plates stay side by side, just tighter, and the knife
   round says only that. */
@container panel (max-width: 240px) {
  .plates {
    gap: 4px;
  }
  .plate {
    justify-content: space-between;
    gap: 4px;
    padding: 5px 6px;
  }
  .plate.is-knife {
    justify-content: center;
  }
  .plate.is-knife .vs,
  .plate.is-knife .tx small {
    display: none;
  }
}
/* Only a sliver of a map stacks them. */
@container panel (max-width: 150px) {
  .plates {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
