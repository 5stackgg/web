<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { computed, ref } from "vue";
import gql from "graphql-tag";
import { RotateCcw, TriangleAlert, Undo2 } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import MatchMapDots from "~/components/match/MatchMapDots.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  e_match_status_enum,
  e_player_roles_enum,
  e_tournament_stage_types_enum,
} from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
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
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();

type ResetImpact = {
  bracket_id: string;
  match_id: string | null;
  depth: number;
  round: number;
  match_number: number;
  path: string | null;
  stage_type: string;
  match_status: string | null;
  is_source: boolean;
  will_delete_match: boolean;
};

const resetDialogOpen = ref(false);
const resetConfirmDialogOpen = ref(false);
const resetLoading = ref(false);
const resetImpacts = ref<ResetImpact[]>([]);
const resetTargetWinner = ref<"clear" | "lineup1" | "lineup2">("clear");
const resetScheduledAt = ref<string>("");
const previewAcknowledged = ref(false);
const finalAcknowledged = ref(false);
const selectedBracket = ref<Bracket | null>(null);

const previewResetMutation = gql`
  mutation PreviewTournamentMatchReset($matchId: uuid!) {
    PreviewTournamentMatchReset(match_id: $matchId) {
      impacts {
        bracket_id
        match_id
        depth
        round
        match_number
        path
        stage_type
        match_status
        is_source
        will_delete_match
      }
    }
  }
`;

const executeResetMutation = gql`
  mutation ResetTournamentMatch(
    $matchId: uuid!
    $winningLineupId: uuid
    $resetStatus: String
    $scheduledAt: timestamptz
  ) {
    ResetTournamentMatch(
      match_id: $matchId
      winning_lineup_id: $winningLineupId
      reset_status: $resetStatus
      scheduled_at: $scheduledAt
    ) {
      success
    }
  }
`;

const orderedImpacts = computed(() =>
  [...resetImpacts.value].sort((a, b) => a.depth - b.depth),
);

const canManageBracketReset = computed(
  () =>
    !!props.tournament?.is_organizer ||
    authStore.isRoleAbove(e_player_roles_enum.administrator),
);

const requiresScheduledAt = computed(() => resetTargetWinner.value === "clear");

const previewFormErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {};

  if (previewAcknowledged.value !== true) {
    errors.previewAcknowledged = "Please confirm the warning acknowledgement.";
  }

  return errors;
});

const canContinuePreviewStep = computed(
  () =>
    !resetLoading.value && Object.keys(previewFormErrors.value).length === 0,
);

const canConfirmFinalStep = computed(
  () => !resetLoading.value && finalAcknowledged.value === true,
);

const formatImpactLabel = (impact: ResetImpact): string => {
  if (impact.is_source) {
    return "Source match (winner reset)";
  }
  if (impact.will_delete_match) {
    return "Match will be deleted and recreated";
  }
  return "Bracket slot/state will be reset";
};

const impactSummary = computed(() => ({
  deleteAndRecreate: orderedImpacts.value.filter(
    (impact) => impact.will_delete_match,
  ).length,
  resetOnly: orderedImpacts.value.filter(
    (impact) => !impact.is_source && !impact.will_delete_match,
  ).length,
}));

const getImpactToneClasses = (impact: ResetImpact): string => {
  if (impact.is_source) {
    return "border-blue-500/40 bg-blue-950/30";
  }
  if (impact.will_delete_match) {
    return "border-red-500/40 bg-red-950/30";
  }
  return "border-amber-500/40 bg-amber-950/20";
};

const getImpactBadgeVariant = (
  impact: ResetImpact,
): "default" | "secondary" | "destructive" | "outline" => {
  if (impact.is_source) return "default";
  if (impact.will_delete_match) return "destructive";
  return "outline";
};

const getWinningLineupId = (bracket: Bracket | null): string | null => {
  if (!bracket?.match) return null;
  const lineup1Id =
    bracket.match.lineup_1_id ?? bracket.match.lineup_1?.id ?? null;
  const lineup2Id =
    bracket.match.lineup_2_id ?? bracket.match.lineup_2?.id ?? null;

  if (resetTargetWinner.value === "lineup1") {
    return lineup1Id;
  }
  if (resetTargetWinner.value === "lineup2") {
    return lineup2Id;
  }
  return null;
};

const getScheduledAtIso = (): string | null => {
  if (!requiresScheduledAt.value) {
    return null;
  }

  if (!resetScheduledAt.value) {
    return null;
  }

  const parsed = new Date(resetScheduledAt.value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const openResetFlow = async (bracket: Bracket) => {
  if (!bracket.match?.id) {
    return;
  }

  selectedBracket.value = bracket;
  resetTargetWinner.value = "clear";
  resetScheduledAt.value = "";
  previewAcknowledged.value = false;
  finalAcknowledged.value = false;
  resetLoading.value = true;
  resetDialogOpen.value = false;
  resetConfirmDialogOpen.value = false;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: previewResetMutation,
      variables: {
        matchId: bracket.match.id,
      },
    });

    resetImpacts.value = data?.PreviewTournamentMatchReset?.impacts || [];
    resetDialogOpen.value = true;
  } catch (error: any) {
    toast({
      title: "Unable to preview tournament match reset",
      description: error?.message || "Please try again.",
      variant: "destructive",
    });
  } finally {
    resetLoading.value = false;
  }
};

const continueResetFlow = () => {
  const errors = previewFormErrors.value;
  const firstError = Object.values(errors)[0];
  if (firstError) {
    toast({
      title: "Please resolve validation errors",
      description: firstError,
      variant: "destructive",
    });
    return;
  }

  resetDialogOpen.value = false;
  resetConfirmDialogOpen.value = true;
};

const executeResetFlow = async () => {
  if (!previewAcknowledged.value || !finalAcknowledged.value) {
    return;
  }
  if (!selectedBracket.value?.match?.id) return;

  const targetWinnerId = getWinningLineupId(selectedBracket.value);
  if (resetTargetWinner.value !== "clear" && !targetWinnerId) {
    toast({
      title: "Unable to set selected winner",
      description: "Selected lineup id is missing for this match.",
      variant: "destructive",
    });
    return;
  }

  const scheduledAtIso = getScheduledAtIso();
  const resolvedResetStatus =
    resetTargetWinner.value === "clear"
      ? scheduledAtIso
        ? "Scheduled"
        : "WaitingForCheckIn"
      : null;
  resetLoading.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: executeResetMutation,
      variables: {
        matchId: selectedBracket.value.match.id,
        winningLineupId: targetWinnerId,
        resetStatus: resolvedResetStatus,
        scheduledAt: scheduledAtIso,
      },
    });

    resetDialogOpen.value = false;
    resetConfirmDialogOpen.value = false;
    toast({
      title: "Tournament match reset applied",
    });
  } catch (error: any) {
    toast({
      title: "Unable to reset tournament match",
      description: error?.message || "Please try again.",
      variant: "destructive",
    });
  } finally {
    resetLoading.value = false;
  }
};

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

const isWaitingForCheckIn = (bracket: Bracket): boolean => {
  const status = bracket.match?.status as e_match_status_enum | undefined;
  if (!status) return false;
  return status === e_match_status_enum.WaitingForCheckIn;
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
 * Sorts feeds to match the DB slot assignment order from
 * assign_team_to_bracket_slot: loser drops first, then winner
 * feeds, then by round and match_number within each group.
 */
const getSortedFeeds = (bracket: Bracket): FeedingBracket[] => {
  const feeds = bracket.feeding_brackets || [];
  if (feeds.length === 0) return [];
  return [...feeds].sort((a, b) => {
    const aLoser = a.loser_parent_bracket_id === bracket.id ? 0 : 1;
    const bLoser = b.loser_parent_bracket_id === bracket.id ? 0 : 1;
    if (aLoser !== bLoser) return aLoser - bLoser;
    if ((a.round ?? 0) !== (b.round ?? 0))
      return (a.round ?? 0) - (b.round ?? 0);
    return (a.match_number ?? 0) - (b.match_number ?? 0);
  });
};

const getFeedForSlot = (
  bracket: Bracket,
  slot: 1 | 2,
): FeedingBracket | undefined => {
  const sorted = getSortedFeeds(bracket);
  return sorted[slot - 1];
};

const formatRoundRef = (
  round: number,
  match_number?: number,
  path?: string,
) => {
  const pathPrefix = path === "WB" ? "wb_" : path === "LB" ? "lb_" : "";
  return match_number
    ? t(`tournament.match.${pathPrefix}round_match_ref`, {
        round,
        match: match_number,
      })
    : t(`tournament.match.${pathPrefix}round_ref`, { round });
};

/** Same pattern as formatDestinationText: "Winner → …" / "Loser → …" + full round ref. */
const formatFeedingText = (bracket: Bracket, feeding?: FeedingBracket) => {
  if (!feeding) return "";
  const isLoserDrop = feeding.loser_parent_bracket_id === bracket.id;
  const prefix = isLoserDrop
    ? t("tournament.match.loser_arrow")
    : t("tournament.match.winner_arrow");
  const roundRef = formatRoundRef(
    feeding.round,
    feeding.match_number,
    feeding.path,
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

/**
 * Bracket viewers render one group at a time; SVG lines only connect matches in
 * the same DOM. When source and target differ by group (e.g. WB → LB), show a
 * hint instead of duplicating what a line already conveys.
 */
const isSameViewerGroup = (
  a: number | undefined,
  b: number | undefined,
): boolean => a === b;

/**
 * Show feed-in text only when the feeder is not in the same viewer as this
 * match (no drawn connector), or the graph edge is missing from feed metadata.
 * Swiss layout does not draw connector lines, so always show when a feed exists.
 */
const shouldShowFeedInHint = (
  bracket: Bracket,
  feeding: FeedingBracket | undefined,
): boolean => {
  if (!feeding) return false;
  if (props.stage.type === e_tournament_stage_types_enum.Swiss) {
    return true;
  }
  const hasGraphEdge =
    feeding.parent_bracket_id === bracket.id ||
    feeding.loser_parent_bracket_id === bracket.id;
  if (!hasGraphEdge) return true;
  return !isSameViewerGroup(feeding.group, bracket.group);
};

/**
 * Map sorted feeds to top/bottom rows. Top = same-view / incoming line; bottom
 * = cross-view amber hint when only one feed needs that hint. If two feeds and
 * exactly one needs a cross-view label, put the same-view feed on top and the
 * hint on the bottom.
 */
const getFeedForDisplayRow = (
  bracket: Bracket,
  row: 1 | 2,
): FeedingBracket | undefined => {
  const sorted = getSortedFeeds(bracket);
  if (sorted.length === 0) return undefined;

  const needsHint = (f: FeedingBracket) => shouldShowFeedInHint(bracket, f);
  const hintFeeds = sorted.filter(needsHint);
  const noHintFeeds = sorted.filter((f) => !needsHint(f));

  if (
    sorted.length === 2 &&
    hintFeeds.length === 1 &&
    noHintFeeds.length === 1
  ) {
    return row === 1 ? noHintFeeds[0] : hintFeeds[0];
  }

  if (sorted.length === 1) {
    if (needsHint(sorted[0])) {
      return row === 2 ? sorted[0] : undefined;
    }
    return row === 1 ? sorted[0] : undefined;
  }

  return sorted[row - 1];
};

const getWbFeedForDisplayRow = (
  bracket: Bracket,
  row: 1 | 2,
): FeedingBracket | undefined => {
  const feed = getFeedForDisplayRow(bracket, row);
  if (feed && feed.path === "WB") return feed;
  return undefined;
};

const shouldShowCrossBracketDestination = (
  bracket: Bracket,
  dest?: { id?: string; group?: number },
): boolean => {
  if (!dest?.id) return false;
  return !isSameViewerGroup(dest.group, bracket.group);
};
</script>

<template>
  <template v-for="bracket in props.brackets" :key="bracket.id">
    <div
      v-if="
        !bracket.bye ||
        bracket.team_1 ||
        bracket.team_2 ||
        bracket.feeding_brackets?.length
      "
      :id="`bracket-${bracket.id}`"
      class="tournament-match cursor-pointer border-2 rounded-lg p-1 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm relative flex flex-col gap-2"
      :class="{
        'border-green-500 hover:border-green-400': isActiveMatch(bracket),
        'border-amber-500 hover:border-amber-400': isWaitingForCheckIn(bracket),
        'border-red-500 hover:border-red-400': hasProblemStatus(bracket),
        'border-gray-700 hover:border-blue-500':
          !isActiveMatch(bracket) &&
          !isWaitingForCheckIn(bracket) &&
          !hasProblemStatus(bracket),
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
              prefix:
                bracket.path === "LB"
                  ? "LB"
                  : bracket.path === "WB" &&
                      stage.type ===
                        e_tournament_stage_types_enum.DoubleElimination
                    ? "WB"
                    : "",
            })
          }}
          <span
            v-if="getBestOf(bracket, stage, tournament)"
            class="text-muted-foreground"
          >
            BO{{ getBestOf(bracket, stage, tournament) }}
          </span>
        </Badge>
        <div class="flex items-center gap-2">
          <MatchMapDots v-if="bracket.match" :match="bracket.match" />
          <DropdownMenu
            v-if="canManageBracketReset && bracket.match && !bracket.bye"
          >
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7 border-slate-500/70 bg-slate-900/70 text-slate-100 hover:bg-slate-800 hover:text-slate-50 data-[state=open]:bg-slate-800 data-[state=open]:text-slate-50"
                :disabled="resetLoading"
                @click.stop
              >
                <span class="sr-only">Open match actions</span>
                <span aria-hidden="true" class="flex items-center gap-0.5">
                  <span class="h-1 w-1 rounded-full bg-current" />
                  <span class="h-1 w-1 rounded-full bg-current" />
                  <span class="h-1 w-1 rounded-full bg-current" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem
                class="text-red-300 focus:bg-red-950/50 focus:text-red-200"
                @click.stop="openResetFlow(bracket)"
              >
                Reset winner
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- Display organizer-set schedule if available -->
      <div
        v-if="bracket.scheduled_at && !bracket.match"
        class="text-xs text-muted-foreground flex flex-col items-center gap-1"
      >
        <span>{{ $t("common.scheduled") }}</span>
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
                        (getWbFeedForDisplayRow(bracket, 1)?.team_1_seed ||
                          getWbFeedForDisplayRow(bracket, 1)?.team_2_seed)
                      "
                      class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                    >
                      #{{
                        getWbFeedForDisplayRow(bracket, 1)?.team_1_seed || "?"
                      }}<span
                        v-if="getWbFeedForDisplayRow(bracket, 1)?.team_2_seed"
                        >/{{
                          getWbFeedForDisplayRow(bracket, 1)?.team_2_seed
                        }}</span
                      >
                    </span>
                    <!-- Cross-view feed only (no connector line in this bracket column) -->
                    <Badge
                      v-if="
                        shouldShowFeedInHint(
                          bracket,
                          getFeedForDisplayRow(bracket, 1),
                        )
                      "
                      variant="outline"
                      class="min-w-0 shrink border-amber-500/50 bg-amber-950/35 text-amber-200 font-normal px-2.5 py-1"
                    >
                      {{
                        formatFeedingText(
                          bracket,
                          getFeedForDisplayRow(bracket, 1),
                        )
                      }}
                    </Badge>
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
                        (getWbFeedForDisplayRow(bracket, 2)?.team_1_seed ||
                          getWbFeedForDisplayRow(bracket, 2)?.team_2_seed)
                      "
                      class="text-xs text-gray-200/70 bg-gray-700/60 border border-gray-800 rounded px-1.5 py-0.5"
                    >
                      #{{
                        getWbFeedForDisplayRow(bracket, 2)?.team_1_seed || "?"
                      }}<span
                        v-if="getWbFeedForDisplayRow(bracket, 2)?.team_2_seed"
                        >/{{
                          getWbFeedForDisplayRow(bracket, 2)?.team_2_seed
                        }}</span
                      >
                    </span>
                    <Badge
                      v-if="
                        shouldShowFeedInHint(
                          bracket,
                          getFeedForDisplayRow(bracket, 2),
                        )
                      "
                      variant="outline"
                      class="min-w-0 shrink border-amber-500/50 bg-amber-950/35 text-amber-200 font-normal px-2.5 py-1"
                    >
                      {{
                        formatFeedingText(
                          bracket,
                          getFeedForDisplayRow(bracket, 2),
                        )
                      }}
                    </Badge>
                  </template>
                  {{ getTeamName(bracket.team_2) }}
                </span>
              </template>
            </div>
          </div>
        </template>
      </div>

      <template
        v-if="stage.type === e_tournament_stage_types_enum.DoubleElimination"
      >
        <div
          v-if="
            isLbFeedingToWb(bracket) &&
            shouldShowCrossBracketDestination(bracket, bracket.parent_bracket)
          "
          class="flex justify-center"
        >
          <Badge
            variant="outline"
            class="border-emerald-500/40 bg-emerald-950/25 text-emerald-300 font-normal"
          >
            {{
              formatDestinationText(
                "winner",
                bracket.parent_bracket,
                bracket.parent_bracket?.path,
              )
            }}
          </Badge>
        </div>
        <div
          v-if="
            bracket.loser_bracket &&
            !bracket.bye &&
            shouldShowCrossBracketDestination(bracket, bracket.loser_bracket)
          "
          class="flex justify-center"
        >
          <Badge
            variant="outline"
            class="border-red-500/45 bg-red-950/30 text-red-300 font-normal"
          >
            {{
              formatDestinationText(
                "loser",
                bracket.loser_bracket,
                bracket.loser_bracket.path,
              )
            }}
          </Badge>
        </div>
      </template>
      <div v-if="isThirdPlaceMatch(bracket)" class="text-center">
        <div class="text-xs text-green-400 font-medium">
          {{ $t("tournament.match.third_place_decider") }}
        </div>
      </div>
    </div>
  </template>

  <AlertDialog
    :open="resetDialogOpen"
    @update:open="(open) => (resetDialogOpen = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reset tournament match winner?</AlertDialogTitle>
        <AlertDialogDescription>
          Changing this result can delete downstream matches in the bracket
          chain.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-3 text-sm">
        <div class="font-medium">Affected match chain preview:</div>
        <div
          class="grid grid-cols-1 gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 text-xs md:grid-cols-2"
        >
          <div
            class="rounded border border-border/80 bg-background/70 px-2 py-1"
          >
            <div class="text-muted-foreground">Delete & recreate</div>
            <div class="font-semibold text-foreground">
              {{ impactSummary.deleteAndRecreate }}
            </div>
          </div>
          <div
            class="rounded border border-border/80 bg-background/70 px-2 py-1"
          >
            <div class="text-muted-foreground">Reset only</div>
            <div class="font-semibold text-foreground">
              {{ impactSummary.resetOnly }}
            </div>
          </div>
        </div>

        <div v-if="orderedImpacts.length === 0" class="text-muted-foreground">
          No affected bracket chain was returned.
        </div>
        <ul
          v-else
          class="max-h-[45vh] overflow-y-auto overflow-x-hidden space-y-2 pr-1 text-muted-foreground"
        >
          <li
            v-for="(impact, index) in orderedImpacts"
            :key="impact.bracket_id"
            class="relative pl-5"
          >
            <div
              v-if="index < orderedImpacts.length - 1"
              class="absolute left-[6px] top-4 h-[calc(100%+0.5rem)] w-px bg-border/70"
            ></div>
            <span
              class="absolute left-0 top-3 h-3 w-3 rounded-full border-2 border-background"
              :class="
                impact.is_source
                  ? 'bg-blue-400'
                  : impact.will_delete_match
                    ? 'bg-red-400'
                    : 'bg-amber-300'
              "
            ></span>

            <div
              class="rounded-md border px-3 py-2"
              :class="getImpactToneClasses(impact)"
            >
              <div class="mb-1 flex items-start justify-between gap-2">
                <div class="font-medium text-foreground">
                  {{ impact.path || "Main" }} R{{ impact.round }} M{{
                    impact.match_number
                  }}
                </div>
                <Badge
                  :variant="getImpactBadgeVariant(impact)"
                  class="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                >
                  <span v-if="impact.is_source">source</span>
                  <span v-else-if="impact.will_delete_match">delete</span>
                  <span v-else>reset</span>
                </Badge>
              </div>
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="truncate">
                  {{ formatImpactLabel(impact) }}
                </span>
                <span
                  v-if="impact.match_status"
                  class="text-muted-foreground/90"
                >
                  {{ impact.match_status }}
                </span>
              </div>
            </div>
          </li>
        </ul>

        <div
          v-if="selectedBracket?.match"
          class="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3"
        >
          <div class="flex items-center gap-2 font-medium">
            <RotateCcw class="h-4 w-4 text-blue-300" />
            Winner after reset
          </div>
          <RadioGroup v-model="resetTargetWinner" class="gap-2">
            <div
              class="flex cursor-pointer items-center space-x-3 rounded-md border border-border bg-background/70 p-2 transition-colors hover:bg-muted/50"
              @click="resetTargetWinner = 'clear'"
            >
              <RadioGroupItem id="reset-winner-clear" value="clear" />
              <Label class="cursor-pointer text-sm" for="reset-winner-clear">
                No winner (reset to setup)
              </Label>
            </div>
            <div
              class="flex cursor-pointer items-center space-x-3 rounded-md border border-border bg-background/70 p-2 transition-colors hover:bg-muted/50"
              @click="resetTargetWinner = 'lineup1'"
            >
              <RadioGroupItem id="reset-winner-lineup1" value="lineup1" />
              <Label class="cursor-pointer text-sm" for="reset-winner-lineup1">
                {{
                  selectedBracket.match.lineup_1?.name ||
                  selectedBracket.match.lineup_1_id
                }}
              </Label>
            </div>
            <div
              class="flex cursor-pointer items-center space-x-3 rounded-md border border-border bg-background/70 p-2 transition-colors hover:bg-muted/50"
              @click="resetTargetWinner = 'lineup2'"
            >
              <RadioGroupItem id="reset-winner-lineup2" value="lineup2" />
              <Label class="cursor-pointer text-sm" for="reset-winner-lineup2">
                {{
                  selectedBracket.match.lineup_2?.name ||
                  selectedBracket.match.lineup_2_id
                }}
              </Label>
            </div>
          </RadioGroup>
          <div class="text-xs text-muted-foreground">
            {{
              resetTargetWinner === "clear"
                ? "The winner will be cleared. Add a time to keep this match Scheduled, or leave it empty to move it to Waiting for Check-In."
                : "The winner will be reassigned to the lineup you select."
            }}
          </div>

          <div
            v-if="resetTargetWinner === 'clear'"
            class="space-y-3 rounded-md border border-border bg-background/70 p-3"
          >
            <Label class="text-sm font-medium" for="reset-scheduled-at">
              Scheduled at
            </Label>
            <Input
              id="reset-scheduled-at"
              v-model="resetScheduledAt"
              type="datetime-local"
            />
            <p class="text-xs text-muted-foreground">
              Optional. Set a time if you want this match to remain Scheduled.
            </p>
          </div>
        </div>

        <div
          class="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 cursor-pointer"
          @click="previewAcknowledged = !previewAcknowledged"
        >
          <div class="flex items-start gap-2">
            <input
              id="preview-reset-ack"
              v-model="previewAcknowledged"
              type="checkbox"
              class="mt-0.5 h-4 w-4 cursor-pointer rounded border border-amber-300/80 bg-background accent-amber-400"
              @click.stop
            />
            <div class="space-y-1">
              <div class="cursor-pointer text-sm font-medium text-amber-100">
                I understand this can remove already played downstream matches.
              </div>
              <div class="text-xs text-amber-200/80">
                Review the affected chain above before continuing.
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="resetLoading">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction
          :disabled="!canContinuePreviewStep"
          @click="continueResetFlow"
        >
          Continue
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog
    :open="resetConfirmDialogOpen"
    @update:open="(open) => (resetConfirmDialogOpen = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Final confirmation required</AlertDialogTitle>
        <AlertDialogDescription>
          This will reset the selected bracket chain and can remove already
          played downstream matches. Use this only for tournament admin
          corrections.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div
        class="rounded-lg border border-red-500/40 bg-red-950/25 p-3 cursor-pointer"
        @click="finalAcknowledged = !finalAcknowledged"
      >
        <div class="mb-2 flex items-center gap-2 text-red-100">
          <TriangleAlert class="h-4 w-4" />
          <span class="text-sm font-medium">Irreversible action</span>
        </div>
        <div class="flex items-start gap-2 text-sm">
          <input
            id="final-reset-ack"
            v-model="finalAcknowledged"
            type="checkbox"
            class="mt-0.5 h-4 w-4 cursor-pointer rounded border border-red-300/80 bg-background accent-red-500"
            @click.stop
          />
          <span class="cursor-pointer leading-5 text-red-100">
            I confirm I want to reset this tournament match chain.
          </span>
        </div>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="resetLoading">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction
          :disabled="!canConfirmFinalStep"
          @click="executeResetFlow"
        >
          <Undo2 class="mr-1 h-4 w-4" />
          Confirm reset
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
