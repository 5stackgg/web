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

interface RoundData {
  round: number;
  pools: RecordPool[];
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
  const sortedBrackets = [...props.stage.brackets].sort(
    (a, b) => (a.round || 0) - (b.round || 0),
  );

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
// 0 = 0-0, 1 = 0-1, 100 = 1-0, 2 = 0-2, 101 = 1-1, 200 = 2-0, 102 = 1-2, 201 = 2-1, 202 = 2-2
// Pattern:
// - If < 100: losses = group, wins = 0 (e.g., 1 = 0-1, 2 = 0-2)
// - If >= 100: wins = floor(group/100), losses = group % 100 (e.g., 100 = 1-0, 101 = 1-1, 200 = 2-0, 102 = 1-2, 201 = 2-1, 202 = 2-2)
const parseGroupToRecord = (
  group: any,
): { wins: number; losses: number; recordKey: string } => {
  if (group === null || group === undefined) {
    return { wins: 0, losses: 0, recordKey: "0-0" };
  }

  // Convert to number if it's a string
  const groupNum = typeof group === "string" ? parseFloat(group) : group;

  if (typeof groupNum === "number") {
    if (groupNum === 0) {
      return { wins: 0, losses: 0, recordKey: "0-0" };
    } else if (groupNum < 100) {
      // Numbers < 100 represent 0-losses (e.g., 1 = 0-1, 2 = 0-2)
      return { wins: 0, losses: groupNum, recordKey: `0-${groupNum}` };
    } else {
      // Numbers >= 100: wins * 100 + losses
      // e.g., 100 = 1-0, 101 = 1-1, 200 = 2-0, 102 = 1-2, 201 = 2-1, 202 = 2-2
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

// Group brackets by rounds, then by record pools within each round
const roundsData = computed(() => {
  const roundsMap = new Map<number, Map<string, RecordPool>>();

  if (!props.stage?.brackets) {
    return [];
  }

  // First, group brackets by round, then by record pool
  props.stage.brackets.forEach((bracket: any) => {
    const round = bracket.round || 1;
    const group = bracket.group;
    const { wins, losses, recordKey } = parseGroupToRecord(group);

    if (!roundsMap.has(round)) {
      roundsMap.set(round, new Map<string, RecordPool>());
    }

    const roundPools = roundsMap.get(round)!;

    if (!roundPools.has(recordKey)) {
      roundPools.set(recordKey, {
        record: recordKey,
        wins,
        losses,
        brackets: [],
        advancedTeams: [],
        eliminatedTeams: [],
      });
    }

    roundPools.get(recordKey)!.brackets.push(bracket);
  });

  // Calculate advanced and eliminated teams based on final records
  // Find teams that reached 3 wins or 3 losses and mark them in the appropriate pools
  teamRecords.value.forEach((record, teamId) => {
    if (record.wins >= 3) {
      // Team advanced - find the pool where they got their 3rd win (would be 2-X record)
      const poolKey = `2-${record.losses}`;
      // Check all rounds for this pool
      roundsMap.forEach((roundPools) => {
        const pool = roundPools.get(poolKey);
        if (pool) {
          const playedInPool = pool.brackets.some((b: any) => {
            const tid1 = b.team_1?.id || b.team_1?.team_id || null;
            const tid2 = b.team_2?.id || b.team_2?.team_id || null;
            return tid1 === teamId || tid2 === teamId;
          });
          if (playedInPool && !pool.advancedTeams.includes(teamId)) {
            pool.advancedTeams.push(teamId);
          }
        }
      });
    }
    if (record.losses >= 3) {
      // Team eliminated - find the pool where they got their 3rd loss (would be X-2 record)
      const poolKey = `${record.wins}-2`;
      // Check all rounds for this pool
      roundsMap.forEach((roundPools) => {
        const pool = roundPools.get(poolKey);
        if (pool) {
          const playedInPool = pool.brackets.some((b: any) => {
            const tid1 = b.team_1?.id || b.team_1?.team_id || null;
            const tid2 = b.team_2?.id || b.team_2?.team_id || null;
            return tid1 === teamId || tid2 === teamId;
          });
          if (playedInPool && !pool.eliminatedTeams.includes(teamId)) {
            pool.eliminatedTeams.push(teamId);
          }
        }
      });
    }
  });

  // Convert to array of RoundData, sorting pools within each round
  const rounds: RoundData[] = [];
  roundsMap.forEach((roundPools, round) => {
    // Sort pools within round: highest wins on top, then lowest losses
    // So 2-0 > 1-1 > 0-2 (descending by wins, then ascending by losses)
    const sortedPools = Array.from(roundPools.values()).sort((a, b) => {
      // First sort by wins (descending) - higher wins on top
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      // If same wins, sort by losses (ascending) - lower losses on top
      return a.losses - b.losses;
    });

    rounds.push({
      round,
      pools: sortedPools,
    });
  });

  // Sort rounds by round number
  return rounds.sort((a, b) => a.round - b.round);
});

const getAdvancedSlots = (round: number): number => {
  const roundData = roundsData.value.find((r) => r.round === round - 1);
  if (!roundData || roundData.pools.length === 0) return 0;

  const firstPool = roundData.pools[0];

  return firstPool.brackets.length;
};

const getEliminatedSlots = (round: number): number => {
  const roundData = roundsData.value.find((r) => r.round === round - 1);
  if (!roundData || roundData.pools.length === 0) return 0;

  const lastPool = roundData.pools[roundData.pools.length - 1];

  return lastPool.brackets.length;
};

// Get advanced teams for a specific round (teams that advanced after the previous round)
const getAdvancedTeams = (
  round: number,
): Array<{
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  matchNumber: number;
}> => {
  const roundData = roundsData.value.find((r) => r.round === round - 1);
  if (!roundData) return [];

  const advancedTeams: Array<{
    teamId: string;
    teamName: string;
    wins: number;
    losses: number;
    matchNumber: number;
  }> = [];
  const seenTeamIds = new Set<string>();

  // Collect all advanced teams from all pools in the previous round
  roundData.pools.forEach((pool) => {
    pool.advancedTeams.forEach((teamId) => {
      if (!seenTeamIds.has(teamId)) {
        const record = teamRecords.value.get(teamId);
        if (record) {
          // Find the bracket where this team advanced (the match they won to get 3 wins)
          // Check all brackets in the round, not just the pool
          let matchNumber = 999; // Default to high number if not found
          for (const pool of roundData.pools) {
            for (const bracket of pool.brackets) {
              const tid1 =
                bracket.team_1?.id || bracket.team_1?.team_id || null;
              const tid2 =
                bracket.team_2?.id || bracket.team_2?.team_id || null;
              if (
                (tid1 === teamId || tid2 === teamId) &&
                bracket.match?.status === "Finished"
              ) {
                // Check if this team won this match
                const winningLineupId = bracket.match.winning_lineup_id;
                const lineup1Id = bracket.match.lineup_1_id;
                const lineup2Id = bracket.match.lineup_2_id;

                const teamWon =
                  (tid1 === teamId && winningLineupId === lineup1Id) ||
                  (tid2 === teamId && winningLineupId === lineup2Id);

                if (teamWon) {
                  const bracketMatchNumber =
                    bracket.match_number || bracket.match?.match_number;
                  if (bracketMatchNumber && bracketMatchNumber < matchNumber) {
                    matchNumber = bracketMatchNumber;
                  }
                }
              }
            }
          }

          advancedTeams.push({
            teamId,
            teamName: record.teamName,
            wins: record.wins,
            losses: record.losses,
            matchNumber,
          });
          seenTeamIds.add(teamId);
        }
      }
    });
  });

  // Sort by match number
  return advancedTeams.sort((a, b) => a.matchNumber - b.matchNumber);
};

// Get eliminated teams for a specific round (teams that were eliminated after the previous round)
const getEliminatedTeams = (
  round: number,
): Array<{
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  matchNumber: number;
}> => {
  const roundData = roundsData.value.find((r) => r.round === round - 1);
  if (!roundData) return [];

  const eliminatedTeams: Array<{
    teamId: string;
    teamName: string;
    wins: number;
    losses: number;
    matchNumber: number;
  }> = [];
  const seenTeamIds = new Set<string>();

  // Collect all eliminated teams from all pools in the previous round
  roundData.pools.forEach((pool) => {
    pool.eliminatedTeams.forEach((teamId) => {
      if (!seenTeamIds.has(teamId)) {
        const record = teamRecords.value.get(teamId);
        if (record) {
          // Find the bracket where this team was eliminated (the match they lost to get 3 losses)
          let matchNumber = 999; // Default to high number if not found
          for (const bracket of pool.brackets) {
            const tid1 = bracket.team_1?.id || bracket.team_1?.team_id || null;
            const tid2 = bracket.team_2?.id || bracket.team_2?.team_id || null;
            if (
              (tid1 === teamId || tid2 === teamId) &&
              bracket.match?.status === "Finished"
            ) {
              // Check if this team lost this match
              const winningLineupId = bracket.match.winning_lineup_id;
              const lineup1Id = bracket.match.lineup_1_id;
              const lineup2Id = bracket.match.lineup_2_id;

              const teamLost =
                (tid1 === teamId && winningLineupId === lineup2Id) ||
                (tid2 === teamId && winningLineupId === lineup1Id);

              if (teamLost) {
                matchNumber =
                  bracket.match_number || bracket.match?.match_number || 999;
                break;
              }
            }
          }

          eliminatedTeams.push({
            teamId,
            teamName: record.teamName,
            wins: record.wins,
            losses: record.losses,
            matchNumber,
          });
          seenTeamIds.add(teamId);
        }
      }
    });
  });

  // Sort by match number
  return eliminatedTeams.sort((a, b) => a.matchNumber - b.matchNumber);
};

// Get final advanced teams from the last round only
const getFinalAdvancedTeams = computed(() => {
  if (maxRound.value === 0) return [];
  return getAdvancedTeams(maxRound.value + 1);
});

// Get final eliminated teams from the last round only
const getFinalEliminatedTeams = computed(() => {
  if (maxRound.value === 0) return [];
  return getEliminatedTeams(maxRound.value + 1);
});

const maxRound = computed(() => {
  if (roundsData.value.length === 0) return 0;
  return Math.max(...roundsData.value.map((r) => r.round));
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
      :class="{
        'fixed top-0 left-0 w-screen h-screen z-[9999]': isFullscreen,
      }"
      :style="isFullscreen ? { background: 'var(--background)' } : {}"
      ref="bracketContainer"
    >
      <div
        class="bracket-content-wrapper"
        ref="bracketContentWrapper"
        :style="{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }"
      >
        <div class="flex gap-8 min-w-max p-6" ref="bracketContent">
          <!-- Round Columns -->
          <div
            v-for="roundData in roundsData"
            :key="roundData.round"
            class="flex flex-col flex-none min-w-[260px] max-w-[300px] gap-10"
          >
            <!-- Round Label -->
            <div class="text-center sticky top-0 z-10">
              <div
                class="bg-gray-800 text-white rounded-lg px-5 py-2.5 shadow-lg font-bold text-sm border border-gray-600"
              >
                Round {{ roundData.round }}
              </div>
            </div>

            <!-- Pools Container -->
            <div class="flex flex-col flex-1 justify-center gap-20">
              <!-- Advanced Teams Pool (above pools for round 4+) -->
              <div
                v-if="roundData.round >= 4"
                class="flex flex-col gap-4 min-w-[260px] max-w-[300px] bg-green-900/30 border-2 border-green-500 rounded-lg p-4 -mb-12"
              >
                <div class="text-center">
                  <div
                    class="bg-green-700 text-white rounded-lg px-4 py-2 shadow-md font-bold text-sm border-2 border-green-500"
                  >
                    ADVANCED
                  </div>
                </div>
                <div class="flex flex-col gap-2 min-w-[200px]">
                  <div
                    v-for="(team, index) in getAdvancedTeams(roundData.round)"
                    :key="`advanced-${roundData.round}-${team.teamId}`"
                    class="flex flex-col gap-1 bg-green-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-green-600/50"
                  >
                    <div class="font-semibold text-green-300">
                      {{ team.teamName }}
                    </div>
                  </div>
                  <div
                    v-for="index in Math.max(
                      0,
                      getAdvancedSlots(roundData.round) -
                        getAdvancedTeams(roundData.round).length,
                    )"
                    :key="`advanced-slot-empty-${roundData.round}-${index}`"
                    class="flex flex-col gap-1 bg-green-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-green-600/50 border-dashed"
                  >
                    <div class="font-semibold text-green-300/50">—</div>
                    <div class="text-xs text-green-200/30">—</div>
                  </div>
                </div>
              </div>
              <!-- Record Pools within this round (stacked vertically, highest wins on top) -->
              <div
                v-for="pool in roundData.pools"
                :key="`${roundData.round}-${pool.record}`"
                class="flex flex-col rounded-lg border-2 border-gray-500 bg-gray-800/20 p-4 shadow-lg gap-3"
              >
                <!-- Record Label -->
                <div
                  v-if="!(roundData.round === 1 && pool.record === '0-0')"
                  class="text-center"
                >
                  <div
                    class="rounded-lg px-4 py-2 shadow-md font-semibold text-sm border-2 border-gray-600 bg-gray-700 text-white"
                  >
                    {{ pool.record }}
                  </div>
                </div>

                <!-- Matches in this pool -->
                <div class="flex flex-col gap-2">
                  <TournamentMatch
                    v-for="bracket in pool.brackets"
                    :key="bracket.id"
                    :round="bracket.round || 1"
                    :brackets="[bracket]"
                  />
                </div>
              </div>

              <!-- Eliminated Teams Pool (below pools for round 4+) -->
              <div
                v-if="roundData.round >= 4"
                class="flex flex-col gap-4 min-w-[260px] max-w-[300px] bg-red-900/30 border-2 border-red-500 rounded-lg p-4 -mt-12"
              >
                <div class="text-center">
                  <div
                    class="bg-red-700 text-white rounded-lg px-4 py-2 shadow-md font-bold text-sm border-2 border-red-500"
                  >
                    ELIMINATED
                  </div>
                </div>
                <div class="flex flex-col gap-2 min-w-[200px]">
                  <div
                    v-for="(team, index) in getEliminatedTeams(roundData.round)"
                    :key="`eliminated-${roundData.round}-${team.teamId}`"
                    class="flex flex-col gap-1 bg-red-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-red-600/50"
                  >
                    <div class="font-semibold text-red-300">
                      {{ team.teamName }}
                    </div>
                  </div>
                  <div
                    v-for="index in Math.max(
                      0,
                      getEliminatedSlots(roundData.round) -
                        getEliminatedTeams(roundData.round).length,
                    )"
                    :key="`eliminated-slot-empty-${roundData.round}-${index}`"
                    class="flex flex-col gap-1 bg-red-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-red-600/50 border-dashed"
                  >
                    <div class="font-semibold text-red-300/50">—</div>
                    <div class="text-xs text-red-200/30">—</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Final Results Column (shows advanced/eliminated from last round) -->
          <div
            v-if="roundsData.length > 0"
            class="flex flex-col flex-none min-w-[260px] max-w-[300px] gap-10"
          >
            <!-- Final Results Label -->
            <div class="text-center sticky top-0 z-10">
              <div
                class="bg-gray-800 text-white rounded-lg px-5 py-2.5 shadow-lg font-bold text-sm border border-gray-600"
              >
                Final Results
              </div>
            </div>

            <!-- Final Results Container -->
            <div class="flex flex-col flex-1 justify-center gap-20">
              <!-- Final Advanced Teams Pool -->
              <div
                class="flex flex-col gap-4 min-w-[260px] max-w-[300px] bg-green-900/30 border-2 border-green-500 rounded-lg p-4 -mb-12"
              >
                <div class="text-center">
                  <div
                    class="bg-green-700 text-white rounded-lg px-4 py-2 shadow-md font-bold text-sm border-2 border-green-500"
                  >
                    ADVANCED
                  </div>
                </div>
                <div class="flex flex-col gap-2 min-w-[200px]">
                  <div
                    v-for="team in getFinalAdvancedTeams"
                    :key="`final-advanced-${team.teamId}`"
                    class="flex flex-col gap-1 bg-green-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-green-600/50"
                  >
                    <div class="font-semibold text-green-300">
                      {{ team.teamName }}
                    </div>
                  </div>
                  <div
                    v-for="index in Math.max(
                      0,
                      getAdvancedSlots(maxRound + 1) -
                        getFinalAdvancedTeams.length,
                    )"
                    :key="`final-advanced-slot-empty-${index}`"
                    class="flex flex-col gap-1 bg-green-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-green-600/50 border-dashed"
                  >
                    <div class="font-semibold text-green-300/50">—</div>
                    <div class="text-xs text-green-200/30">—</div>
                  </div>
                </div>
              </div>

              <!-- Final Eliminated Teams Pool -->
              <div
                class="flex flex-col gap-4 min-w-[260px] max-w-[300px] bg-red-900/30 border-2 border-red-500 rounded-lg p-4"
              >
                <div class="text-center">
                  <div
                    class="bg-red-700 text-white rounded-lg px-4 py-2 shadow-md font-bold text-sm border-2 border-red-500"
                  >
                    ELIMINATED
                  </div>
                </div>
                <div class="flex flex-col gap-2 min-w-[200px]">
                  <div
                    v-for="team in getFinalEliminatedTeams"
                    :key="`final-eliminated-${team.teamId}`"
                    class="flex flex-col gap-1 bg-red-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-red-600/50"
                  >
                    <div class="font-semibold text-red-300">
                      {{ team.teamName }}
                    </div>
                  </div>
                  <div
                    v-for="index in Math.max(
                      0,
                      getEliminatedSlots(maxRound + 1) -
                        getFinalEliminatedTeams.length,
                    )"
                    :key="`final-eliminated-slot-empty-${index}`"
                    class="flex flex-col gap-1 bg-red-800/30 text-white rounded px-3 py-2 text-sm font-medium border border-red-600/50 border-dashed"
                  >
                    <div class="font-semibold text-red-300/50">—</div>
                    <div class="text-xs text-red-200/30">—</div>
                  </div>
                </div>
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
