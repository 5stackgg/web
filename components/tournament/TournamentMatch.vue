<script lang="ts" setup>
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import TimeAgo from "~/components/TimeAgo.vue";

interface Bracket {
  id: string;
  bye?: boolean;
  match_number?: number;
  path?: string;
  scheduled_eta?: string;
  match?: {
    id: string;
    options?: {
      best_of?: number;
    };
    lineup_1?: any;
    lineup_2?: any;
  };
  parent_bracket?: {
    round: number;
    match_number?: number;
  };
  loser_bracket?: {
    round: number;
    match_number?: number;
  };
  team_1?: {
    name?: string;
    team?: {
      name?: string;
    };
  };
  team_2?: {
    name?: string;
    team?: {
      name?: string;
    };
  };
  team_1_seed?: number;
  team_2_seed?: number;
  stage?: {
    match_options?: {
      best_of?: number;
    };
  };
  tournament?: {
    options?: {
      best_of?: number;
    };
  };
}

const props = defineProps<{
  round: number;
  brackets: Bracket[];
  stage: {
    match_options?: {
      best_of?: number;
    };
  };
  tournament?: {
    options?: {
      best_of?: number;
    };
  };
}>();

const getBestOf = (
  bracket: Bracket,
  stage: any,
  tournament: any,
): number | null => {
  // Try to get best_of from match options first
  if (bracket.match?.options?.best_of) {
    return bracket.match.options.best_of;
  }
  // If no match yet, try to get from stage match_options (if available)
  if (stage?.match_options?.best_of) {
    return stage.match_options.best_of;
  }
  // Fall back to tournament options (if available)
  if (tournament?.options?.best_of) {
    return tournament.options.best_of;
  }
};

const getTeamName = (team: Bracket["team_1"]): string => {
  return team?.team?.name || team?.name || "";
};

const router = useRouter();

const handleClick = (event: MouseEvent, bracket: Bracket) => {
  if (!bracket.match) return;

  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    window.open(`/matches/${bracket.match.id}`, "_blank");
    return;
  }

  router.push({
    name: "matches-id",
    params: { id: bracket.match.id },
  });
};
</script>

<template>
  <template v-for="bracket in props.brackets" :key="bracket.id">
    <div
      v-if="!(bracket.bye && !bracket.team_1 && !bracket.team_2)"
      :id="`bracket-${bracket.id}`"
      class="tournament-match cursor-pointer my-2 border-2 border-gray-700 rounded-lg p-1 transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm"
      :data-bracket-id="bracket.id"
      :data-round="props.round"
      @click="handleClick($event, bracket)"
    >
      <div class="text-center">
        <Badge v-if="bracket.bye">
          {{ $t("tournament.match.bye_round") }}
        </Badge>
        <Badge v-else>
          {{
            $t("tournament.match.round_match", {
              round: props.round,
              match: bracket.match_number,
              prefix: bracket.path === "LB" ? "Losers" : "",
            })
          }}
          <span
            v-if="getBestOf(bracket, stage, tournament)"
            class="ml-2 text-muted-foreground"
          >
            BO{{ getBestOf(bracket, stage, tournament) }}
          </span>
        </Badge>
      </div>

      <!-- Display scheduled ETA if available -->
      <div
        v-if="bracket.scheduled_eta && !bracket.match"
        class="mt-2 mb-3 text-xs text-muted-foreground flex flex-col items-center gap-1"
      >
        <span>{{ $t("tournament.match.scheduled_for") }}</span>
        <span class="text-blue-400 font-medium ml-1">
          <TimeAgo :date="bracket.scheduled_eta"></TimeAgo>
        </span>
      </div>

      <!-- Team Display -->
      <template v-if="bracket.bye">
        <!-- Bye round: show only the team that exists -->
        <div v-if="bracket.team_1 || bracket.team_2" class="items-center m-2">
          <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
            <span>
              {{ getTeamName(bracket.team_1 || bracket.team_2) }}
              <span
                v-if="bracket.team_1_seed || bracket.team_2_seed"
                class="text-muted-foreground ml-2"
              >
                (#{{ bracket.team_1_seed || bracket.team_2_seed }})
              </span>
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <!-- Regular match: show both teams -->
        <div class="items-center m-2">
          <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
            <span v-if="bracket.match" class="flex items-center gap-2">
              <TournamentRoundLineup
                :lineup_name="getTeamName(bracket.team_1)"
                :match="bracket.match"
                :lineup="bracket.match.lineup_1"
              />
              <span v-if="bracket.team_1_seed" class="text-muted-foreground">
                (#{{ bracket.team_1_seed }})
              </span>
            </span>
            <template v-else>
              <span v-if="bracket.team_1">
                {{ getTeamName(bracket.team_1) }}
                <span
                  v-if="bracket.team_1_seed"
                  class="text-muted-foreground ml-2"
                >
                  (#{{ bracket.team_1_seed }})
                </span>
              </span>
              <span v-else>
                {{ $t("tournament.match.team_1") }}
                <span
                  v-if="bracket.team_1_seed"
                  class="text-muted-foreground ml-2"
                >
                  (#{{ bracket.team_1_seed }})
                </span>
              </span>
            </template>
          </div>
        </div>

        <div class="items-center m-2">
          <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
            <span v-if="bracket.match" class="flex items-center gap-2">
              <TournamentRoundLineup
                :lineup_name="getTeamName(bracket.team_2)"
                :match="bracket.match"
                :lineup="bracket.match.lineup_2"
              />
              <span v-if="bracket.team_2_seed" class="text-muted-foreground">
                (#{{ bracket.team_2_seed }})
              </span>
            </span>
            <template v-else>
              <span v-if="bracket.team_2">
                {{ getTeamName(bracket.team_2) }}
                <span
                  v-if="bracket.team_2_seed"
                  class="text-muted-foreground ml-2"
                >
                  (#{{ bracket.team_2_seed }})
                </span>
              </span>
              <span v-else>
                {{ $t("tournament.match.team_2") }}
                <span
                  v-if="bracket.team_2_seed"
                  class="text-muted-foreground ml-2"
                >
                  (#{{ bracket.team_2_seed }})
                </span>
              </span>
            </template>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>
