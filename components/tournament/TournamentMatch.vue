<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_tournament_stage_types_enum } from "~/generated/zeus";

interface Bracket {
  id: string;
  bye?: boolean;
  match_number?: number;
  path?: string;
  group?: number;
  scheduled_eta?: string;
  options?: any;
  feeding_brackets?: Array<{
    id: string;
    round: number;
    match_number?: number;
    path?: string;
    team_1_seed?: number;
    team_2_seed?: number;
  }>;
  match?: {
    id: string;
    status?: string;
    e_match_status?: {
      description: string;
    };
    options?: {
      best_of?: number;
    };
    lineup_1?: any;
    lineup_2?: any;
    match_maps?: Array<{ status?: string }>;
  };
  parent_bracket?: {
    id?: string;
    round: number;
    group?: number;
    match_number?: number;
    path?: string;
  };
  loser_bracket?: {
    id?: string;
    round: number;
    group?: number;
    match_number?: number;
    path?: string;
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
    options?: {
      best_of?: number;
    };
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    options?: {
      best_of?: number;
    };
  };
}

type FeedingBracket = NonNullable<Bracket["feeding_brackets"]>[number];

const props = defineProps<{
  round: number;
  brackets: Bracket[];
  stage: {
    type?: string;
    max_teams?: number;
    groups?: number;
    default_best_of?: number;
    decider_best_of?: number;
    settings?: {
      round_best_of?: Record<string, number>;
    };
    options?: {
      best_of?: number;
    };
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    options?: {
      best_of?: number;
    };
  };
}>();

const { t } = useI18n();

const getTeamsPerGroup = (stage: any): number => {
  return Math.ceil((stage.max_teams || 0) / Math.max(stage.groups || 1, 1));
};

const getTotalRounds = (stage: any): number => {
  return Math.ceil(Math.log2(Math.max(getTeamsPerGroup(stage), 2)));
};

const isThirdPlaceMatch = (bracket: Bracket): boolean => {
  const stage = props.stage;
  if (stage?.type !== e_tournament_stage_types_enum.SingleElimination)
    return false;
  if (bracket.match_number !== 2) return false;
  return props.round === getTotalRounds(stage);
};

const getBestOf = (
  bracket: Bracket,
  stage: any,
  tournament: any,
): number | null => {
  // Try to get best_of from bracket options first (organizer override)
  if (bracket.options?.best_of) {
    return bracket.options.best_of;
  }
  // Try to get best_of from match options (already resolved at scheduling time)
  if (bracket.match?.options?.best_of) {
    return bracket.match.options.best_of;
  }
  // SE 3rd place match uses decider_best_of (separate field, not in round_best_of)
  if (
    stage?.type === e_tournament_stage_types_enum.SingleElimination &&
    stage?.decider_best_of &&
    bracket.match_number === 2
  ) {
    if (props.round === getTotalRounds(stage)) {
      return stage.decider_best_of;
    }
  }
  // If no match yet, try to compute from per-round settings
  if (stage?.settings?.round_best_of) {
    const roundBestOf = stage.settings.round_best_of;
    let key: string;
    if (stage.type === e_tournament_stage_types_enum.Swiss) {
      key = getSwissMatchType(bracket);
    } else if (
      stage.type === e_tournament_stage_types_enum.DoubleElimination &&
      bracket.path === "WB"
    ) {
      // DE Grand Final uses "GF" key (round > wb_rounds)
      const wbRounds = getTotalRounds(stage);
      key = props.round > wbRounds ? "GF" : `WB:${props.round}`;
    } else {
      key = bracket.path ? `${bracket.path}:${props.round}` : "";
    }
    if (key && roundBestOf[key] !== undefined) {
      return roundBestOf[key];
    }
  }
  // Fall back to stage default_best_of
  if (stage?.default_best_of) {
    return stage.default_best_of;
  }
  // Fall back to stage options best_of
  if (stage?.options?.best_of) {
    return stage.options.best_of;
  }
  // Fall back to tournament options (if available)
  if (tournament?.options?.best_of) {
    return tournament.options.best_of;
  }
  return null;
};

const getSwissMatchType = (bracket: Bracket): string => {
  const group = bracket.group ?? 0;
  const wins = Math.floor(group / 100);
  const losses = group % 100;
  const winsNeeded = 3;
  if (wins === winsNeeded - 1) return "advancement";
  if (losses === winsNeeded - 1) return "elimination";
  return "regular";
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

const getFeedingBracketsByPath = (bracket: Bracket, path: "WB" | "LB") => {
  return (bracket.feeding_brackets || []).filter((b) => b.path === path);
};

const getFeedingBracketAt = (
  bracket: Bracket,
  path: "WB" | "LB",
  index: number,
) => {
  return getFeedingBracketsByPath(bracket, path)[index];
};

const isShowingDestinations = (bracket: Bracket) => {
  return bracket.path === "WB" && !bracket.match;
};

const getBracketLabel = (path?: string) => {
  if (path === "WB") return t("tournament.match.upper_bracket");
  if (path === "LB") return t("tournament.match.lower_bracket");
  return "";
};

const getFeedPrefix = (currentPath?: string, feedingPath?: string) => {
  if (!currentPath || !feedingPath) return t("tournament.match.winner_of");
  return currentPath === feedingPath
    ? t("tournament.match.winner_of")
    : t("tournament.match.loser_of");
};

const formatFeedingText = (bracket: Bracket, feeding?: FeedingBracket) => {
  if (!feeding) return "";
  const prefix = getFeedPrefix(bracket.path, feeding.path);
  const roundMatch = feeding.match_number
    ? t("tournament.match.round_match_ref", {
        round: feeding.round,
        match: feeding.match_number,
      })
    : t("tournament.match.round_ref", { round: feeding.round });
  return `${prefix} ${roundMatch}`.trim();
};

const formatDestinationText = (
  type: "winner" | "loser",
  dest?: { round: number; match_number?: number },
) => {
  if (!dest) return "";
  const prefix =
    type === "winner"
      ? t("tournament.match.winner_arrow")
      : t("tournament.match.loser_arrow");
  if (dest.match_number) {
    return `${prefix} ${t("tournament.match.round_match_ref", { round: dest.round, match: dest.match_number })}`;
  }
  return `${prefix} ${t("tournament.match.round_ref", { round: dest.round })}`;
};

const isLbFeedingToWb = (bracket: Bracket) => {
  return bracket.path === "LB" && bracket.parent_bracket?.path === "WB";
};
</script>

<template>
  <template v-for="bracket in props.brackets" :key="bracket.id">
    <div
      v-if="!(bracket.bye && !bracket.team_1 && !bracket.team_2)"
      :id="`bracket-${bracket.id}`"
      class="tournament-match cursor-pointer border-2 border-gray-700 rounded-lg p-1 transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm relative flex flex-col gap-2"
      :data-bracket-id="bracket.id"
      :data-round="props.round"
      @click="handleClick($event, bracket)"
    >
      <div class="flex items-center justify-between gap-2">
        <Badge v-if="bracket.bye">
          {{ $t("tournament.match.bye_round") }}
        </Badge>
        <Badge v-else class="flex items-center gap-2">
          {{
            $t("tournament.match.round_match", {
              round: props.round,
              match: bracket.match_number,
              prefix: bracket.path === "LB" ? "Losers" : "",
            })
          }}
          <span
            v-if="getBestOf(bracket, stage, tournament)"
            class="text-muted-foreground"
          >
            BO{{ getBestOf(bracket, stage, tournament) }}
          </span>
        </Badge>
      </div>

      <!-- Display scheduled ETA if available -->
      <div
        v-if="bracket.scheduled_eta && !bracket.match"
        class="text-xs text-muted-foreground flex flex-col items-center gap-1"
      >
        <span>{{ $t("tournament.match.scheduled_for") }}</span>
        <span class="text-blue-400 font-medium">
          <TimeAgo :date="bracket.scheduled_eta"></TimeAgo>
        </span>
      </div>

      <!-- Team Display -->
      <div class="flex flex-col gap-2">
        <template v-if="bracket.bye">
          <!-- Bye round: show only the team that exists -->
          <div v-if="bracket.team_1 || bracket.team_2" class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
              <span class="flex items-center gap-2">
                <span
                  v-if="bracket.team_1_seed || bracket.team_2_seed"
                  class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                >
                  #{{ bracket.team_1_seed || bracket.team_2_seed }}
                </span>
              </span>
            </div>
          </div>
        </template>
        <template v-else>
          <!-- Match exists: show both teams -->
          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4 min-h-8">
              <span v-if="bracket.match" class="flex items-center gap-2">
                <span
                  v-if="bracket.team_1_seed"
                  class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                >
                  #{{ bracket.team_1_seed }}
                </span>
                <TournamentRoundLineup
                  :lineup_name="getTeamName(bracket.team_1)"
                  :match="bracket.match"
                  :lineup="bracket.match.lineup_1"
                />
              </span>
              <template v-else>
                <!-- No match yet: Team 1 row shows WB feed if available, otherwise placeholder -->
                <span class="flex items-center gap-2">
                  <span
                    v-if="bracket.team_1_seed"
                    class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                  >
                    #{{ bracket.team_1_seed }}
                  </span>
                  <span
                    v-else-if="
                      bracket.path !== 'WB' &&
                      (getFeedingBracketAt(bracket, 'WB', 0)?.team_1_seed ||
                        getFeedingBracketAt(bracket, 'WB', 0)?.team_2_seed)
                    "
                    class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                  >
                    #{{
                      getFeedingBracketAt(bracket, "WB", 0)?.team_1_seed || "?"
                    }}<span
                      v-if="getFeedingBracketAt(bracket, 'WB', 0)?.team_2_seed"
                      >/{{
                        getFeedingBracketAt(bracket, "WB", 0)?.team_2_seed
                      }}</span
                    >
                  </span>
                  <!-- LB: show only WB feeds in Team 1/2 -->
                  <template
                    v-if="
                      bracket.path === 'LB' &&
                      getFeedingBracketAt(bracket, 'WB', 0)
                    "
                  >
                    {{
                      formatFeedingText(
                        bracket,
                        getFeedingBracketAt(bracket, "WB", 0),
                      )
                    }}
                  </template>
                  {{ getTeamName(bracket.team_1) }}
                </span>
              </template>
            </div>
          </div>

          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4 min-h-8">
              <span v-if="bracket.match" class="flex items-center gap-2">
                <span
                  v-if="bracket.team_2_seed"
                  class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                >
                  #{{ bracket.team_2_seed }}
                </span>
                <TournamentRoundLineup
                  :lineup_name="getTeamName(bracket.team_2)"
                  :match="bracket.match"
                  :lineup="bracket.match.lineup_2"
                />
              </span>
              <template v-else>
                <!-- No match yet: Team 2 row shows LB feed if available, otherwise placeholder -->
                <span class="flex items-center gap-2">
                  <span
                    v-if="bracket.team_2_seed"
                    class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                  >
                    #{{ bracket.team_2_seed }}
                  </span>
                  <span
                    v-else-if="
                      bracket.path === 'LB' &&
                      (getFeedingBracketAt(bracket, 'WB', 1)?.team_1_seed ||
                        getFeedingBracketAt(bracket, 'WB', 1)?.team_2_seed)
                    "
                    class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                  >
                    #{{
                      getFeedingBracketAt(bracket, "WB", 1)?.team_1_seed || "?"
                    }}<span
                      v-if="getFeedingBracketAt(bracket, 'WB', 1)?.team_2_seed"
                      >/{{
                        getFeedingBracketAt(bracket, "WB", 1)?.team_2_seed
                      }}</span
                    >
                  </span>
                  <!-- WB: show where loser goes -->
                  <template
                    v-if="bracket.path === 'WB' && bracket.loser_bracket"
                  >
                    <span class="text-red-400">
                      {{
                        formatDestinationText("loser", bracket.loser_bracket)
                      }}
                    </span>
                  </template>
                  <!-- LB: show only WB feeds in Team 1/2 -->
                  <template
                    v-else-if="
                      bracket.path === 'LB' &&
                      getFeedingBracketAt(bracket, 'WB', 1)
                    "
                  >
                    {{
                      formatFeedingText(
                        bracket,
                        getFeedingBracketAt(bracket, "WB", 1),
                      )
                    }}
                  </template>
                </span>
                {{ getTeamName(bracket.team_2) }}
              </template>
            </div>
          </div>
        </template>
      </div>

      <div
        v-if="bracket.match?.status && bracket.match?.e_match_status"
        class="flex justify-center"
      >
        <MatchStatus :match="bracket.match" />
      </div>

      <template
        v-if="stage.type === e_tournament_stage_types_enum.DoubleElimination"
      >
        <div v-if="isLbFeedingToWb(bracket)" class="text-center">
          <div class="text-xs text-green-400 font-medium">
            <span class="inline-flex items-center gap-1">
              <span>{{ $t("tournament.match.winner_bracket_arrow") }}</span>
              <span v-if="bracket.parent_bracket?.match_number">
                {{
                  $t("tournament.match.round_match_ref", {
                    round: bracket.parent_bracket.round,
                    match: bracket.parent_bracket.match_number,
                  })
                }}
              </span>
              <span v-else>
                {{
                  $t("tournament.match.round_ref", {
                    round: bracket.parent_bracket?.round,
                  })
                }}
              </span>
            </span>
          </div>
        </div>
        <div
          v-if="bracket.loser_bracket && !isShowingDestinations(bracket)"
          class="text-center"
        >
          <div class="text-xs text-red-400 font-medium">
            <span class="inline-flex items-center gap-1">
              <span>{{ $t("tournament.match.loser_arrow") }}</span>
              <span v-if="bracket.loser_bracket.match_number">
                {{
                  $t("tournament.match.round_match_ref", {
                    round: bracket.loser_bracket.round,
                    match: bracket.loser_bracket.match_number,
                  })
                }}
              </span>
              <span v-else>
                {{
                  $t("tournament.match.round_ref", {
                    round: bracket.loser_bracket.round,
                  })
                }}
              </span>
            </span>
          </div>
        </div>
      </template>
      <div v-if="isThirdPlaceMatch(bracket)" class="text-center">
        <div class="text-xs text-green-400 font-medium">
          {{ $t("tournament.match.third_place_decider") }}
        </div>
      </div>
    </div>
  </template>
</template>
