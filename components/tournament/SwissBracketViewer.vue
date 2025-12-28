<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { Maximize, Minimize, ZoomIn, ZoomOut } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";

interface TeamRecord {
  wins: number;
  losses: number;
  teamId: string | null;
  teamName: string;
}

interface RecordPool {
  record: string; // e.g., "0-0", "1-0", "0-1"
  wins: number;
  losses: number;
  brackets: any[];
  advancedTeams: string[];
  eliminatedTeams: string[];
}

const props = defineProps({
  stage: {
    type: Object,
    required: true,
  },
});

const bracketContainer = ref<HTMLElement | null>(null);
const bracketContentWrapper = ref<HTMLElement | null>(null);
const bracketContent = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const bracketWrapper = ref<HTMLElement | null>(null);
const zoomLevel = ref(0.75);
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

// Calculate team records from brackets (final records)
const teamRecords = computed(() => {
  const records = new Map<string, TeamRecord>();

  if (!props.stage?.brackets) {
    return records;
  }

  // Initialize all teams with 0-0 record
  props.stage.brackets.forEach((bracket: any) => {
    const team1Id = bracket.team_1?.id || bracket.team_1?.team_id || null;
    const team2Id = bracket.team_2?.id || bracket.team_2?.team_id || null;

    if (team1Id && !records.has(team1Id)) {
      records.set(team1Id, {
        wins: 0,
        losses: 0,
        teamId: team1Id,
        teamName:
          bracket.team_1?.team?.name ||
          bracket.team_1?.name ||
          `Team ${team1Id}`,
      });
    }

    if (team2Id && !records.has(team2Id)) {
      records.set(team2Id, {
        wins: 0,
        losses: 0,
        teamId: team2Id,
        teamName:
          bracket.team_2?.team?.name ||
          bracket.team_2?.name ||
          `Team ${team2Id}`,
      });
    }
  });

  // Calculate wins/losses from finished matches, processing by round
  const sortedBrackets = [...props.stage.brackets].sort((a, b) => (a.round || 0) - (b.round || 0));
  
  sortedBrackets.forEach((bracket: any) => {
    if (bracket.match && bracket.match.status === "Finished") {
      const match = bracket.match;
      const winningLineupId = match.winning_lineup_id;

      const team1Id = bracket.team_1?.id || bracket.team_1?.team_id || null;
      const team2Id = bracket.team_2?.id || bracket.team_2?.team_id || null;

      if (team1Id && records.has(team1Id)) {
        const record = records.get(team1Id)!;
        if (winningLineupId === match.lineup_1_id) {
          record.wins++;
        } else if (winningLineupId === match.lineup_2_id) {
          record.losses++;
        }
      }

      if (team2Id && records.has(team2Id)) {
        const record = records.get(team2Id)!;
        if (winningLineupId === match.lineup_2_id) {
          record.wins++;
        } else if (winningLineupId === match.lineup_1_id) {
          record.losses++;
        }
      }
    }
  });

  return records;
});

// Parse group value to extract wins and losses
// Groups are stored as numeric values with encoding:
// 0 = 0-0, 1 = 1-0, 100 = 0-1, 2 = 2-0, 101 = 1-1, 200 = 0-2, 102 = 2-1, 201 = 1-2, 202 = 2-2
// Pattern: wins * 100 + losses (when losses > 0), or just wins (when losses = 0)
const parseGroupToRecord = (group: any): { wins: number; losses: number; recordKey: string } => {
  if (group === null || group === undefined) {
    return { wins: 0, losses: 0, recordKey: "0-0" };
  }

  // Convert to number if it's a string
  const groupNum = typeof group === "string" ? parseFloat(group) : group;

  if (typeof groupNum === "number") {
    if (groupNum === 0) {
      return { wins: 0, losses: 0, recordKey: "0-0" };
    } else if (groupNum < 100) {
      // Numbers < 100 represent wins-0 (e.g., 1 = 1-0, 2 = 2-0)
      return { wins: groupNum, losses: 0, recordKey: `${groupNum}-0` };
    } else {
      // Numbers >= 100: wins * 100 + losses
      // e.g., 100 = 0-1, 101 = 1-1, 200 = 0-2, 102 = 2-1, 201 = 1-2, 202 = 2-2
      const wins = Math.floor(groupNum / 100);
      const losses = groupNum % 100;
      return { wins, losses, recordKey: `${wins}-${losses}` };
    }
  }

  // If it's a string in "wins-losses" format, parse it
  if (typeof group === "string") {
    const parts = group.split("-");
    if (parts.length === 2) {
      const wins = parseInt(parts[0], 10) || 0;
      const losses = parseInt(parts[1], 10) || 0;
      return { wins, losses, recordKey: group };
    }
  }

  // Default fallback
  return { wins: 0, losses: 0, recordKey: "0-0" };
};

// Group brackets by record pools using the group field
const recordPools = computed(() => {
  const recordPoolsMap = new Map<string, RecordPool>();

  if (!props.stage?.brackets) {
    return Array.from(recordPoolsMap.values());
  }

  // Group brackets by their group field (which represents the record pool like "1-0", "0-1", etc.)
  props.stage.brackets.forEach((bracket: any) => {
    const group = bracket.group;
    const { wins, losses, recordKey } = parseGroupToRecord(group);

    if (!recordPoolsMap.has(recordKey)) {
      recordPoolsMap.set(recordKey, {
        record: recordKey,
        wins,
        losses,
        brackets: [],
        advancedTeams: [],
        eliminatedTeams: [],
      });
    }

    recordPoolsMap.get(recordKey)!.brackets.push(bracket);
  });

  // Calculate advanced and eliminated teams based on final records
  // Find teams that reached 3 wins or 3 losses and mark them in the appropriate pools
  teamRecords.value.forEach((record, teamId) => {
    if (record.wins >= 3) {
      // Team advanced - find the pool where they got their 3rd win (would be 2-X record)
      const poolKey = `2-${record.losses}`;
      const pool = recordPoolsMap.get(poolKey);
      if (pool) {
        // Check if this team played in this pool
        const playedInPool = pool.brackets.some((b: any) => {
          const tid1 = b.team_1?.id || b.team_1?.team_id || null;
          const tid2 = b.team_2?.id || b.team_2?.team_id || null;
          return tid1 === teamId || tid2 === teamId;
        });
        if (playedInPool && !pool.advancedTeams.includes(teamId)) {
          pool.advancedTeams.push(teamId);
        }
      }
    }
    if (record.losses >= 3) {
      // Team eliminated - find the pool where they got their 3rd loss (would be X-2 record)
      const poolKey = `${record.wins}-2`;
      const pool = recordPoolsMap.get(poolKey);
      if (pool) {
        // Check if this team played in this pool
        const playedInPool = pool.brackets.some((b: any) => {
          const tid1 = b.team_1?.id || b.team_1?.team_id || null;
          const tid2 = b.team_2?.id || b.team_2?.team_id || null;
          return tid1 === teamId || tid2 === teamId;
        });
        if (playedInPool && !pool.eliminatedTeams.includes(teamId)) {
          pool.eliminatedTeams.push(teamId);
        }
      }
    }
  });

  // Sort pools: 0-0, then 1-0/0-1, then 2-0/1-1/0-2, etc.
  return Array.from(recordPoolsMap.values()).sort((a, b) => {
    const totalA = a.wins + a.losses;
    const totalB = b.wins + b.losses;
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    // Same total games, sort by wins (descending)
    return b.wins - a.wins;
  });
});

// Get border color class based on record
const getBorderColor = (wins: number, losses: number) => {
  if (wins >= 3) return "border-green-500";
  if (losses >= 3) return "border-red-500";
  if (wins > losses) return "border-green-400";
  if (losses > wins) return "border-red-400";
  return "border-yellow-400";
};

// Get background color class based on record
const getBackgroundColor = (wins: number, losses: number) => {
  if (wins >= 3) return "bg-green-900/20";
  if (losses >= 3) return "bg-red-900/20";
  if (wins > losses) return "bg-green-800/10";
  if (losses > wins) return "bg-red-800/10";
  return "bg-yellow-800/10";
};

const zoomIn = () => {
  if (zoomLevel.value < MAX_ZOOM) {
    zoomLevel.value = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM);
  }
};

const zoomOut = () => {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM);
  }
};

const resetZoom = () => {
  zoomLevel.value = 0.75;
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    bracketWrapper.value?.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

// Handle fullscreen changes
onMounted(() => {
  document.addEventListener("fullscreenchange", () => {
    isFullscreen.value = !!document.fullscreenElement;
  });
});
</script>

<template>
  <div class="relative" ref="bracketWrapper">
    <div
      class="tournament-bracket overflow-auto relative cursor-grab"
      style="max-height: 80vh; min-height: 400px"
      ref="bracketContainer"
      :class="{ 'fullscreen-bracket': isFullscreen }"
    >
      <div
        class="bracket-content-wrapper"
        ref="bracketContentWrapper"
        :style="{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }"
      >
        <div
          class="flex gap-8 min-w-max p-6"
          ref="bracketContent"
        >
          <!-- Swiss Format Header -->
          <div class="absolute top-2 left-6 z-10">
            <Badge class="bg-yellow-500 text-black font-bold px-4 py-2 text-sm">
              SWISS FORMAT
            </Badge>
          </div>

          <!-- Record Pool Columns -->
          <div
            v-for="pool in recordPools"
            :key="pool.record"
            class="flex flex-col swiss-column"
            :class="getBackgroundColor(pool.wins, pool.losses)"
          >
            <!-- Record Label -->
            <div class="text-center mb-4 sticky top-0 z-10">
              <div
                class="rounded-lg px-4 py-2 shadow-md font-semibold text-sm"
                :class="[
                  getBorderColor(pool.wins, pool.losses),
                  'border-2',
                  pool.wins >= 3
                    ? 'bg-green-700 text-white'
                    : pool.losses >= 3
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-700 text-white',
                ]"
              >
                {{ pool.record }}
              </div>
            </div>

            <!-- Matches in this pool -->
            <div class="flex flex-col gap-4 min-w-[200px]">
              <TournamentMatch
                v-for="bracket in pool.brackets"
                :key="bracket.id"
                :round="bracket.round || 1"
                :brackets="[bracket]"
              />
            </div>

            <!-- Advancement Indicator -->
            <div
              v-if="pool.advancedTeams.length > 0"
              class="mt-4 p-2 bg-green-600 text-white rounded text-xs font-semibold text-center"
            >
              <div class="mb-1">ADVANCED</div>
              <div class="flex flex-wrap gap-1 justify-center">
                <span
                  v-for="(teamId, index) in pool.advancedTeams"
                  :key="teamId"
                  class="bg-green-700 px-2 py-1 rounded"
                >
                  {{ index + 1 }}
                </span>
              </div>
            </div>

            <!-- Elimination Indicator -->
            <div
              v-if="pool.eliminatedTeams.length > 0"
              class="mt-4 p-2 bg-red-600 text-white rounded text-xs font-semibold text-center"
            >
              <div class="mb-1">ELIMINATED</div>
              <div class="flex flex-wrap gap-1 justify-center">
                <span
                  v-for="teamId in pool.eliminatedTeams"
                  :key="teamId"
                  class="bg-red-700 w-4 h-4 rounded inline-block"
                ></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Zoom and Fullscreen Controls -->
    <div
      class="zoom-controls-container absolute top-4 right-4 z-50 flex flex-col gap-3 opacity-40 hover:opacity-100 transition-opacity duration-300 ease-in-out"
    >
      <!-- Zoom Controls -->
      <div
        class="flex flex-col gap-1.5 bg-gray-800/90 backdrop-blur-md rounded-lg p-2.5 shadow-xl border border-gray-700/50"
      >
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomIn"
          :disabled="zoomLevel >= MAX_ZOOM"
          title="Zoom In"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomOut"
          :disabled="zoomLevel <= MIN_ZOOM"
          title="Zoom Out"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md px-3 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out text-xs font-medium min-w-[3rem] flex items-center justify-center"
          @click="resetZoom"
          :disabled="zoomLevel === 0.75"
          title="Reset Zoom"
        >
          {{ Math.round(zoomLevel * 100) }}%
        </button>
      </div>
      <!-- Fullscreen Control -->
      <button
        class="zoom-control-btn bg-gray-800/90 backdrop-blur-md hover:bg-gray-700/90 active:bg-gray-600/90 text-white rounded-lg p-2.5 shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-gray-700/50 transition-all duration-200 ease-in-out flex items-center justify-center"
        @click="toggleFullscreen"
        :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
      >
        <Maximize v-if="!isFullscreen" class="w-4 h-4" />
        <Minimize v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.swiss-column {
  min-width: 250px;
}

.fullscreen-bracket {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: var(--background);
}
</style>

