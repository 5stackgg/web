<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  e_match_status_enum,
  e_tournament_stage_types_enum,
} from "~/generated/zeus";
import type { Bracket } from "~/types/tournament";

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

const emit = defineEmits<{
  (e: "schedule-bracket", bracket: Bracket): void;
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

const hasProblemStatus = (bracket: Bracket): boolean => {
  const status = bracket.match?.status as e_match_status_enum | undefined;
  if (!status) return false;
  return [
    e_match_status_enum.Canceled,
    e_match_status_enum.Forfeit,
    e_match_status_enum.Surrendered,
    e_match_status_enum.WaitingForServer,
  ].includes(status);
};

const isActiveMatch = (bracket: Bracket): boolean => {
  const status = bracket.match?.status as e_match_status_enum | undefined;
  if (!status) return false;
  return [e_match_status_enum.Veto, e_match_status_enum.Live].includes(status);
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
  if (bracket.match) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(`/matches/${bracket.match.id}`, "_blank");
      return;
    }
    router.push({
      name: "matches-id",
      params: { id: bracket.match.id },
    });
    return;
  }
  // No match yet — open schedule dialog if organizer
  if (props.tournament?.is_organizer) {
    emit("schedule-bracket", bracket);
  }
};

/**
 * Get the feeding bracket for a given team slot (1 or 2).
 * Uses DB relationships: feeds whose parent_bracket_id points here
 * are winner feeds, feeds whose loser_parent_bracket_id points here
 * are loser drops. Slot 1 gets the first feed, slot 2 gets the second.
 */
const getFeedForSlot = (
  bracket: Bracket,
  slot: 1 | 2,
): FeedingBracket | undefined => {
  const feeds = bracket.feeding_brackets || [];
  if (feeds.length === 0) return undefined;
  return feeds[slot - 1];
};

/**
 * Get the WB feeding bracket for a given team slot.
 * Filters feeds to only those coming from WB (loser drops into LB).
 */
const getWbFeedForSlot = (
  bracket: Bracket,
  slot: 1 | 2,
): FeedingBracket | undefined => {
  const feed = getFeedForSlot(bracket, slot);
  if (feed && feed.path === "WB") return feed;
  return undefined;
};

const formatRoundRef = (
  round: number,
  match_number?: number,
  path?: string,
) => {
  const pathPrefix = path === "WB" ? "wb_" : path === "LB" ? "lb_" : "";
  return match_number
    ? t(`tournament.match.${pathPrefix}round_match_ref`, { round, match: match_number })
    : t(`tournament.match.${pathPrefix}round_ref`, { round });
};

const formatRoundRefCompact = (
  round: number,
  match_number?: number,
  path?: string,
) => {
  const pathPrefix = path === "WB" ? "wb_" : path === "LB" ? "lb_" : "";
  return match_number
    ? t(`tournament.match.${pathPrefix}round_match_compact`, {
        round,
        match: match_number,
      })
    : t(`tournament.match.${pathPrefix}round_compact`, { round });
};

const formatFeedingText = (bracket: Bracket, feeding?: FeedingBracket) => {
  if (!feeding) return "";
  const isLoserDrop = feeding.loser_parent_bracket_id === bracket.id;
  const prefix = isLoserDrop
    ? t("tournament.match.loser")
    : t("tournament.match.winner");
  const roundRef = formatRoundRefCompact(
    feeding.round,
    feeding.match_number,
    isLoserDrop ? feeding.path : undefined,
  );
  return `${prefix} ${roundRef}`.trim();
};

const formatDestinationText = (
  type: "winner" | "loser",
  dest?: { round: number; match_number?: number; path?: string },
  path?: string,
) => {
  if (!dest) return "";
  const prefix =
    type === "winner"
      ? t("tournament.match.winner_arrow")
      : t("tournament.match.loser_arrow");
  const roundMatch = formatRoundRef(dest.round, dest.match_number, path);
  return `${prefix} ${roundMatch}`;
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
      class="tournament-match cursor-pointer border-2 rounded-lg p-1 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm relative flex flex-col gap-2"
      :class="{
        'border-green-500 hover:border-green-400': isActiveMatch(bracket),
        'border-red-500 hover:border-red-400': hasProblemStatus(bracket),
        'border-gray-700 hover:border-blue-500':
          !isActiveMatch(bracket) && !hasProblemStatus(bracket),
      }"
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
              prefix: bracket.path === "LB" ? "LB" : (bracket.path === "WB" && stage.type === e_tournament_stage_types_enum.DoubleElimination ? "WB" : ""),
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

      <!-- Display organizer-set schedule if available -->
      <div
        v-if="bracket.scheduled_at && !bracket.match"
        class="text-xs text-muted-foreground flex flex-col items-center gap-1"
      >
        <span>{{ $t("tournament.bracket.scheduled_at") }}</span>
        <span class="text-green-400 font-medium">
          <TimeAgo :date="bracket.scheduled_at"></TimeAgo>
        </span>
      </div>
      <!-- Display auto-calculated ETA if no organizer schedule -->
      <div
        v-else-if="bracket.scheduled_eta && !bracket.match"
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
          <!-- Bye round: show both slots for consistent height -->
          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4 min-h-8">
              <span class="flex items-center gap-2">
                <span
                  v-if="bracket.team_1_seed"
                  class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                >
                  #{{ bracket.team_1_seed }}
                </span>
                {{ getTeamName(bracket.team_1) }}
              </span>
            </div>
          </div>
          <div class="items-center">
            <div class="bg-gray-600 text-gray-300 rounded py-1 px-4 min-h-8">
              <span class="flex items-center gap-2">
                <span
                  v-if="bracket.team_2_seed"
                  class="text-xs text-gray-200/80 bg-gray-700/70 border border-gray-800 rounded px-1.5 py-0.5"
                >
                  #{{ bracket.team_2_seed }}
                </span>
                {{ getTeamName(bracket.team_2) }}
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
                  <template v-if="!bracket.team_1">
                    <span
                      v-if="
                        bracket.path !== 'WB' &&
                        (getWbFeedForSlot(bracket, 1)?.team_1_seed ||
                          getWbFeedForSlot(bracket, 1)?.team_2_seed)
                      "
                      class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                    >
                      #{{
                        getWbFeedForSlot(bracket, 1)?.team_1_seed || "?"
                      }}<span
                        v-if="getWbFeedForSlot(bracket, 1)?.team_2_seed"
                        >/{{
                          getWbFeedForSlot(bracket, 1)?.team_2_seed
                        }}</span
                      >
                    </span>
                    <!-- Show where this team will come from -->
                    <template v-if="getFeedForSlot(bracket, 1)">
                      {{
                        formatFeedingText(
                          bracket,
                          getFeedForSlot(bracket, 1),
                        )
                      }}
                    </template>
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
                  <template v-if="!bracket.team_2">
                    <span
                      v-if="
                        bracket.path === 'LB' &&
                        (getWbFeedForSlot(bracket, 2)?.team_1_seed ||
                          getWbFeedForSlot(bracket, 2)?.team_2_seed)
                      "
                      class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                    >
                      #{{
                        getWbFeedForSlot(bracket, 2)?.team_1_seed || "?"
                      }}<span
                        v-if="getWbFeedForSlot(bracket, 2)?.team_2_seed"
                        >/{{
                          getWbFeedForSlot(bracket, 2)?.team_2_seed
                        }}</span
                      >
                    </span>
                    <!-- Show where this team will come from -->
                    <template v-if="getFeedForSlot(bracket, 2)">
                      {{
                        formatFeedingText(
                          bracket,
                          getFeedForSlot(bracket, 2),
                        )
                      }}
                    </template>
                  </template>
                </span>
                {{ getTeamName(bracket.team_2) }}
              </template>
            </div>
          </div>
        </template>
      </div>

      <template
        v-if="stage.type === e_tournament_stage_types_enum.DoubleElimination"
      >
        <div v-if="isLbFeedingToWb(bracket)" class="text-center">
          <div class="text-xs text-green-400 font-medium">
            {{
              formatDestinationText(
                "winner",
                bracket.parent_bracket,
                bracket.parent_bracket?.path,
              )
            }}
          </div>
        </div>
        <div v-if="bracket.loser_bracket && !bracket.bye" class="text-center">
          <div class="text-xs text-red-400 font-medium">
            {{
              formatDestinationText(
                "loser",
                bracket.loser_bracket,
                bracket.loser_bracket.path,
              )
            }}
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
