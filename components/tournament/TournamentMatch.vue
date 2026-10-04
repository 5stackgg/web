<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import gql from "graphql-tag";
import {
  MoreVertical,
  RotateCcw,
  TriangleAlert,
  Undo2,
  Calendar as CalendarIcon,
  X,
} from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarDateTime,
  type CalendarDate,
  toZoned,
  getLocalTimeZone,
} from "@internationalized/date";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import { useBracketView } from "~/composables/useBracketView";
import MatchMapDots from "~/components/match/MatchMapDots.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import BracketNegotiation from "~/components/tournament/BracketNegotiation.vue";
import {
  e_match_status_enum,
  e_player_roles_enum,
  e_tournament_stage_types_enum,
} from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import type { Bracket } from "~/types/tournament";
import {
  isNegotiableBracket,
  type NegotiationWindow,
} from "~/utilities/bracketNegotiation";

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
    windows?: NegotiationWindow[] | null;
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    scheduling_mode?: string | null;
    league_season_division?: { id?: string } | null;
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
const resetStartDate = ref<CalendarDate | undefined>(undefined);
const resetStartTime = ref<string | undefined>(undefined);

watch([resetStartDate, resetStartTime], () => {
  if (!resetStartDate.value || !resetStartTime.value) {
    resetScheduledAt.value = "";
    return;
  }
  const [hours, minutes] = resetStartTime.value.split(":").map(Number);
  const cdt = new CalendarDateTime(
    resetStartDate.value.year,
    resetStartDate.value.month,
    resetStartDate.value.day,
    hours,
    minutes,
  );
  resetScheduledAt.value = toZoned(cdt, getLocalTimeZone()).toAbsoluteString();
});

const checkResetDate = ({
  day,
  month,
  year,
}: {
  day: number;
  month: number;
  year: number;
}) => {
  return new Date(year, month - 1, day + 1) < new Date();
};

const clearResetSchedule = () => {
  resetStartDate.value = undefined;
  resetStartTime.value = undefined;
};
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
    return t("tournament_match_impact.source_reset");
  }
  if (impact.will_delete_match) {
    return t("tournament_match_impact.delete_recreate");
  }
  return t("tournament_match_impact.slot_reset");
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
  resetStartDate.value = undefined;
  resetStartTime.value = undefined;
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
      title: t("toasts.preview_reset_failed"),
      description: error?.message || t("toasts.please_try_again"),
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
      title: t("toasts.resolve_validation_errors"),
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
      title: t("toasts.set_winner_failed"),
      description: t("toasts.set_winner_failed_description"),
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
      title: t("toasts.match_reset_applied"),
    });
  } catch (error: any) {
    toast({
      title: t("toasts.match_reset_failed"),
      description: error?.message || t("toasts.please_try_again"),
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

const getRoundMatchLabel = (bracket: Bracket): string => {
  const isDoubleElimination =
    props.stage.type === e_tournament_stage_types_enum.DoubleElimination;
  return t("tournament.match.round_match", {
    round: props.round,
    match: bracket.match_number,
    prefix:
      bracket.path === "LB"
        ? "LB"
        : bracket.path === "WB" && isDoubleElimination
          ? "WB"
          : "",
  }).trim();
};

const SLOTS = [1, 2] as const;

const { followTeamId } = useBracketView();

const slotTeam = (bracket: Bracket, slot: 1 | 2) =>
  slot === 1 ? bracket.team_1 : bracket.team_2;

const slotSeed = (bracket: Bracket, slot: 1 | 2) =>
  slot === 1 ? bracket.team_1_seed : bracket.team_2_seed;

const slotLineup = (bracket: Bracket, slot: 1 | 2) =>
  slot === 1 ? bracket.match?.lineup_1 : bracket.match?.lineup_2;

const isForfeit = (bracket: Bracket) =>
  bracket.match?.status === e_match_status_enum.Forfeit;

const matchWinnerId = (bracket: Bracket): string | null =>
  (bracket.match as { winning_lineup_id?: string | null } | undefined)
    ?.winning_lineup_id ?? null;

const slotOutcome = (bracket: Bracket, slot: 1 | 2): "won" | "lost" | null => {
  const winner = matchWinnerId(bracket);
  const lineup = slotLineup(bracket, slot);
  if (!winner || !lineup) return null;
  return lineup.id === winner ? "won" : "lost";
};

const statusLabel = (bracket: Bracket) =>
  bracket.match?.status
    ? t(`tournament.notifications.status.${bracket.match.status}`)
    : "";

const teamIds = (bracket: Bracket) =>
  [bracket.team_1?.id, bracket.team_2?.id].filter(Boolean) as string[];

const isEmptyBracket = (bracket: Bracket) =>
  !bracket.match && !bracket.team_1 && !bracket.team_2;

const cardClasses = (bracket: Bracket) => {
  const following = followTeamId.value;
  const onPath = !!following && teamIds(bracket).includes(following);
  return [
    isEmptyBracket(bracket)
      ? "border-dashed border-muted-foreground/25 bg-[hsl(240_6%_6.5%)]"
      : "bg-[hsl(240_6%_8%)]",
    onPath
      ? "border-[hsl(var(--tac-amber))]"
      : isActiveMatch(bracket)
        ? "border-emerald-500/70 shadow-[0_0_0_1px_rgb(16_185_129/0.25)]"
        : isWaitingForCheckIn(bracket)
          ? "border-amber-500/60"
          : hasProblemStatus(bracket) && !isForfeit(bracket)
            ? "border-red-500/60"
            : isEmptyBracket(bracket)
              ? ""
              : "border-border [@media(hover:hover)]:hover:border-foreground/35",
    following && !onPath && "opacity-30",
  ];
};

// Where this match sends its teams, shown only until it is decided and only
// for edges no connector line draws (another bracket section).
const footerLines = (bracket: Bracket) => {
  const lines: { text: string; class: string }[] = [];
  if (isThirdPlaceMatch(bracket)) {
    lines.push({
      text: t("tournament.match.third_place_decider"),
      class: "text-emerald-400",
    });
  }
  if (
    props.stage.type !== e_tournament_stage_types_enum.DoubleElimination ||
    bracket.bye ||
    matchWinnerId(bracket)
  ) {
    return lines;
  }
  if (
    isLbFeedingToWb(bracket) &&
    shouldShowCrossBracketDestination(bracket, bracket.parent_bracket)
  ) {
    lines.push({
      text: formatDestinationText(
        "winner",
        bracket.parent_bracket,
        bracket.parent_bracket?.path,
      ),
      class: "text-emerald-400/90",
    });
  }
  if (
    bracket.loser_bracket &&
    shouldShowCrossBracketDestination(bracket, bracket.loser_bracket)
  ) {
    lines.push({
      text: formatDestinationText(
        "loser",
        bracket.loser_bracket,
        bracket.loser_bracket.path,
      ),
      class: "text-red-300/80",
    });
  }
  return lines;
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
      class="tournament-match relative flex w-[13.5rem] cursor-pointer flex-col overflow-hidden rounded-md border transition-[border-color,opacity,box-shadow] duration-150"
      :class="cardClasses(bracket)"
      :data-bracket-id="bracket.id"
      :data-round="props.round"
      :data-teams="teamIds(bracket).join(' ')"
      @click="handleClick($event, bracket)"
    >
      <div
        class="flex h-[1.375rem] items-center justify-between gap-2 bg-muted/35 pl-2 pr-1 text-[0.66rem] font-semibold text-muted-foreground"
      >
        <span
          class="min-w-0 truncate"
          :title="bracket.bye ? undefined : getRoundMatchLabel(bracket)"
        >
          {{
            bracket.bye
              ? $t("tournament.match.bye_round")
              : $t("tournament.bracket.match_short", {
                  match: bracket.match_number,
                })
          }}
          <span
            v-if="!bracket.bye && getBestOf(bracket, stage, tournament)"
            class="ml-1 font-medium text-muted-foreground/70"
          >
            Bo{{ getBestOf(bracket, stage, tournament) }}
          </span>
        </span>
        <span class="flex shrink-0 items-center gap-1.5">
          <span
            v-if="isActiveMatch(bracket)"
            class="inline-flex items-center gap-1 font-bold uppercase tracking-[0.08em] text-emerald-400"
          >
            <span class="relative flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              ></span>
            </span>
            {{ $t("common.live") }}
          </span>
          <span v-else-if="isWaitingForCheckIn(bracket)" class="text-amber-400">
            {{ statusLabel(bracket) }}
          </span>
          <span
            v-else-if="hasProblemStatus(bracket) && !isForfeit(bracket)"
            class="text-red-400"
          >
            {{ statusLabel(bracket) }}
          </span>
          <MatchMapDots v-else-if="bracket.match" :match="bracket.match" />
          <span
            v-else-if="
              !isNegotiableBracket(props.tournament, bracket) &&
              (bracket.scheduled_at || bracket.scheduled_eta)
            "
            class="inline-flex items-center gap-1"
            :class="bracket.scheduled_at ? 'text-foreground/80' : ''"
          >
            <CalendarIcon class="h-3 w-3" />
            <TimeAgo
              :date="(bracket.scheduled_at || bracket.scheduled_eta) as string"
            />
          </span>
          <DropdownMenu
            v-if="canManageBracketReset && bracket.match && !bracket.bye"
          >
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="relative h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground after:absolute after:-inset-1.5"
                :disabled="resetLoading"
                @click.stop
              >
                <span class="sr-only">{{
                  $t("tournament.open_match_actions")
                }}</span>
                <MoreVertical aria-hidden="true" class="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem
                class="text-red-300 focus:bg-red-950/50 focus:text-red-200"
                @click.stop="openResetFlow(bracket)"
              >
                <RotateCcw />
                {{ $t("tournament.match.reset_winner") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      <div
        v-for="slot in SLOTS"
        :key="slot"
        class="flex h-7 min-w-0 items-center gap-1.5 pl-2 text-[0.8rem] font-semibold"
        :class="[
          slot === 2 && 'border-t border-border/60',
          followTeamId &&
            slotTeam(bracket, slot)?.id === followTeamId &&
            'bg-[hsl(var(--tac-amber)/0.1)]',
        ]"
        :data-slot="slot"
        :data-feed="getFeedForSlot(bracket, slot)?.id"
      >
        <span
          v-if="slotSeed(bracket, slot)"
          class="inline-grid h-4 min-w-[1.125rem] shrink-0 place-items-center rounded-[3px] bg-muted/70 px-1 text-[0.625rem] font-semibold tabular-nums text-muted-foreground"
        >
          {{ slotSeed(bracket, slot) }}
        </span>
        <span
          v-if="slotTeam(bracket, slot)"
          class="min-w-0 flex-1 truncate"
          :class="
            slotOutcome(bracket, slot) === 'lost' && 'text-muted-foreground'
          "
          :title="getTeamName(slotTeam(bracket, slot))"
        >
          {{ getTeamName(slotTeam(bracket, slot)) }}
        </span>
        <span
          v-else
          class="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-muted-foreground"
        >
          {{
            bracket.bye
              ? ""
              : formatFeedingText(bracket, getFeedForSlot(bracket, slot)) ||
                $t("common.tbd")
          }}
        </span>
        <span
          v-if="bracket.match && slotLineup(bracket, slot)"
          class="grid w-8 shrink-0 place-items-center self-stretch bg-muted/35 text-[0.8rem] font-extrabold tabular-nums"
        >
          <span
            v-if="isForfeit(bracket) && slotOutcome(bracket, slot)"
            :class="
              slotOutcome(bracket, slot) === 'won'
                ? 'text-green-400'
                : 'text-red-400'
            "
          >
            {{
              slotOutcome(bracket, slot) === "won"
                ? $t("tournament.bracket.walkover_win")
                : $t("tournament.bracket.forfeit_short")
            }}
          </span>
          <MatchLineupScoreDisplay
            v-else
            :match="bracket.match"
            :lineup="slotLineup(bracket, slot)"
            :halves="false"
          />
        </span>
      </div>

      <div
        v-if="
          footerLines(bracket).length ||
          isNegotiableBracket(props.tournament, bracket)
        "
        class="grid gap-1 border-t border-border/60 px-2 py-1.5 text-[0.66rem] text-muted-foreground"
      >
        <BracketNegotiation
          v-if="isNegotiableBracket(props.tournament, bracket)"
          :bracket="bracket"
          :windows="props.stage.windows"
          :title="getRoundMatchLabel(bracket)"
          :best-of="getBestOf(bracket, stage, tournament)"
        />
        <span
          v-for="line in footerLines(bracket)"
          :key="line.text"
          class="truncate"
          :class="line.class"
          :title="line.text"
        >
          {{ line.text }}
        </span>
      </div>
    </div>
  </template>

  <AlertDialog
    :open="resetDialogOpen"
    @update:open="(open) => (resetDialogOpen = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("tournament.match.reset_title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("tournament.match.reset_warning") }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-3 text-sm">
        <div class="font-medium">
          {{ $t("tournament.match.affected_chain_preview") }}
        </div>
        <div
          class="grid grid-cols-1 gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 text-xs md:grid-cols-2"
        >
          <div
            class="rounded border border-border/80 bg-background/70 px-2 py-1"
          >
            <div class="text-muted-foreground">
              {{ $t("tournament.match.delete_recreate") }}
            </div>
            <div class="font-semibold text-foreground">
              {{ impactSummary.deleteAndRecreate }}
            </div>
          </div>
          <div
            class="rounded border border-border/80 bg-background/70 px-2 py-1"
          >
            <div class="text-muted-foreground">
              {{ $t("tournament.match.reset_only") }}
            </div>
            <div class="font-semibold text-foreground">
              {{ impactSummary.resetOnly }}
            </div>
          </div>
        </div>

        <div v-if="orderedImpacts.length === 0" class="text-muted-foreground">
          {{ $t("tournament.match.no_affected_chain") }}
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
                  {{ impact.path || $t("tournament.bracket.main_path") }} R{{
                    impact.round
                  }} M{{
                    impact.match_number
                  }}
                </div>
                <Badge
                  :variant="getImpactBadgeVariant(impact)"
                  class="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                >
                  <span v-if="impact.is_source">{{
                    $t("tournament.bracket.impact_source")
                  }}</span>
                  <span v-else-if="impact.will_delete_match">{{
                    $t("tournament.bracket.impact_delete")
                  }}</span>
                  <span v-else>{{ $t("tournament.bracket.impact_reset") }}</span>
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
            {{ $t("tournament.match.winner_after_reset") }}
          </div>
          <RadioGroup v-model="resetTargetWinner" class="gap-2">
            <div
              class="flex cursor-pointer items-center space-x-3 rounded-md border border-border bg-background/70 p-2 transition-colors hover:bg-muted/50"
              @click="resetTargetWinner = 'clear'"
            >
              <RadioGroupItem id="reset-winner-clear" value="clear" />
              <Label class="cursor-pointer text-sm" for="reset-winner-clear">
                {{ $t("tournament.match.no_winner_reset") }}
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
                ? $t("tournament.match.winner_cleared_hint")
                : $t("tournament.match.winner_reassigned_hint")
            }}
          </div>

          <div
            v-if="resetTargetWinner === 'clear'"
            class="space-y-3 rounded-md border border-border bg-background/70 p-3"
          >
            <Label class="text-sm font-medium">
              {{ $t("tournament.match.scheduled_at") }}
            </Label>
            <div class="flex items-center gap-2">
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    class="flex-1 justify-start text-left font-normal"
                    :class="{ 'text-muted-foreground': !resetStartDate }"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    {{ resetStartDate || $t("common.pick_date") }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0 z-[80]">
                  <Calendar
                    :is-date-disabled="checkResetDate"
                    v-model="resetStartDate"
                    initial-focus
                  />
                </PopoverContent>
              </Popover>

              <Input
                type="time"
                v-model="resetStartTime"
                style="color-scheme: dark"
                class="w-[120px]"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                :disabled="!resetStartDate && !resetStartTime"
                @click.prevent="clearResetSchedule"
                :title="$t('match.schedule.reset')"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("tournament.match.scheduled_optional_hint") }}
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
                {{ $t("tournament.match.remove_downstream_ack") }}
              </div>
              <div class="text-xs text-amber-200/80">
                {{ $t("tournament.match.review_chain_hint") }}
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
          {{ $t("tournament.match.continue") }}
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
        <AlertDialogTitle>{{
          $t("tournament.match.final_confirmation_required")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("tournament.match.reset_chain_warning") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div
        class="rounded-lg border border-red-500/40 bg-red-950/25 p-3 cursor-pointer"
        @click="finalAcknowledged = !finalAcknowledged"
      >
        <div class="mb-2 flex items-center gap-2 text-red-100">
          <TriangleAlert class="h-4 w-4" />
          <span class="text-sm font-medium">{{
            $t("tournament.match.irreversible_action")
          }}</span>
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
            {{ $t("tournament.match.confirm_reset_chain_ack") }}
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
          {{ $t("tournament.match.confirm_reset") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
