<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
import MatchMapDisplayLineup from "~/components/match/MatchMapLineup.vue";
import formatBytes from "~/utilities/formatBytes";
import cleanMapName from "~/utilities/cleanMapName";
import { Download } from "lucide-vue-next";
</script>

<template>
  <MapDisplay
    :map="matchMap.map"
    :darken="true"
    :class="mapCardClasses"
  >
    <template v-slot:header>
      <div class="absolute top-2 left-2 right-2 flex items-start justify-between z-10">
        <div class="flex items-center gap-1.5">
          <badge
            v-if="matchMap.is_current_map"
            class="bg-green-600 text-white border-green-500 text-[10px] px-1.5 py-0.5"
          >{{ $t("match.map_lineup.live", "Live") }}</badge>
          <badge
            v-else-if="matchMap.status !== e_match_status_enum.Scheduled"
            class="text-[10px] px-1.5 py-0.5"
          >{{ matchMap.status }}</badge>
          <badge
            variant="destructive"
            v-if="isDecider && match.options.best_of > 1"
            class="text-[10px] px-1.5 py-0.5"
          >{{ $t("match.decider") }}</badge>
        </div>

        <div class="flex gap-1">
          <template v-if="matchMap.demos_download_url">
            <a target="_blank" :href="matchMap.demos_download_url" @click.stop>
              <Button
                size="icon"
                variant="outline"
                class="h-7 w-7"
                v-if="matchMap.demos_total_size"
              >
                <Download class="w-3.5 h-3.5" />
              </Button>
            </a>
          </template>
          <template v-else>
            <template v-for="demo in matchMap.demos" :key="demo.id">
              <a :href="demo.download_url" @click.stop>
                <Button size="icon" variant="outline" class="h-7 w-7">
                  <Download class="w-3.5 h-3.5" />
                </Button>
              </a>
            </template>
          </template>
        </div>
      </div>
    </template>
    <template v-slot:default>
      <span class="text-white/60 text-[11px] font-medium uppercase tracking-wider mt-1">
        {{ cleanMapName(matchMap.map.name) }}
      </span>
      <div class="absolute bottom-2 left-2 right-2">
        <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-1">
          <div class="flex flex-col items-start gap-0.5 min-w-0">
            <match-map-display-lineup
              :match="match"
              :match-map="matchMap"
              :lineup="match.lineup_1"
              :showTeamPatch="showTeamPatch"
            ></match-map-display-lineup>
          </div>
          <span class="text-white/40 text-xs font-medium self-end pb-0.5">vs</span>
          <div class="flex flex-col items-end gap-0.5 min-w-0">
            <match-map-display-lineup
              :reverse="true"
              :match="match"
              :match-map="matchMap"
              :lineup="match.lineup_2"
              :showTeamPatch="showTeamPatch"
            ></match-map-display-lineup>
          </div>
        </div>
      </div>
    </template>
  </MapDisplay>
</template>

<script lang="ts">
import { e_match_status_enum, e_veto_pick_types_enum } from "~/generated/zeus";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchMap: {
      type: Object,
      required: true,
    },
  },
  computed: {
    mapCardClasses() {
      if (this.matchMap.is_current_map) {
        return "ring-2 ring-green-500/60 shadow-lg shadow-green-500/10";
      }
      if (this.isFinished) {
        return "opacity-80";
      }
      return "";
    },
    isFinished() {
      return [
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ].includes(this.matchMap.status);
    },
    showTeamPatch() {
      return (
        !this.isDecider || this.matchMap.status === e_match_status_enum.Live
      );
    },
    isDecider() {
      return this.matchMap.vetos.find(({ type }) => {
        return type === e_veto_pick_types_enum.Decider;
      });
    },
  },
};
</script>
