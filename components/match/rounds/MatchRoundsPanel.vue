<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import FaqHelpGlyph from "~/components/faq/FaqHelpGlyph.vue";
import MatchRoundsTab from "~/components/match/rounds/MatchRoundsTab.vue";
import { toast } from "~/components/ui/toast";
import { useMatchRoundsFocus } from "~/composables/useMatchRoundsFocus";
import { e_match_status_enum } from "~/generated/zeus";
import {
  canRewindTo,
  defaultRestoreRound,
  roundsFromMatchMap,
  toRewindRounds,
  type RestoreRoundsResponse,
} from "~/utilities/rewind";

const props = defineProps<{
  match: Record<string, any>;
  matchMap: Record<string, any> | null;
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const MATCH_RESTORE_ROUNDS = gql`
  query GetMatchRestoreRounds($matchId: uuid!) {
    getMatchRestoreRounds(match_id: $matchId) {
      map_name
      restorable
      blocked_reason
      live_round
      economy_hidden
      connected_players
      expected_players
      disconnected
      rounds {
        round
        lineup_1_score
        lineup_2_score
        lineup_1_side
        lineup_2_side
        winning_side
        winning_reason
        has_backup
        undone
        players {
          steam_id
          name
          lineup
          cash
          armor
          helmet
          alive
          weapons
          kills
          deaths
        }
      }
    }
  }
`;

const RESTORE_MATCH_ROUND = gql`
  mutation RestoreMatchRound($matchId: uuid!, $round: Int!) {
    restoreMatchRound(match_id: $matchId, round: $round) {
      success
    }
  }
`;

const IN_PROGRESS = ["Warmup", "Knife", "Live", "Overtime", "Paused"];

const mr = computed(() => Number(props.match.options?.mr) || 12);
const isCurrent = computed(() => !!props.matchMap?.is_current_map);
const inProgress = computed(
  () =>
    props.match.status === e_match_status_enum.Live &&
    isCurrent.value &&
    IN_PROGRESS.includes(props.matchMap?.status),
);

const organizer = computed(() => !!props.match.is_organizer && isCurrent.value);

const data = ref<RestoreRoundsResponse | null>(null);
const rewinding = ref(false);
const target = ref<number | null>(null);
const restoring = ref(false);

// A request from Fix a Problem or a map card waits for the restore rounds to
// arrive: the preview only opens once this map can actually be restored.
const pending = ref<number | null | undefined>(undefined);

async function load() {
  if (!organizer.value) {
    data.value = null;
    return;
  }
  try {
    const { data: result } = await nuxtApp.$apollo.defaultClient.query({
      query: MATCH_RESTORE_ROUNDS,
      variables: { matchId: props.match.id },
      fetchPolicy: "network-only",
    });
    data.value = result?.getMatchRestoreRounds ?? null;
  } catch {
    // A failed poll keeps the last rounds, so the preview stays open.
  }
  if (pending.value !== undefined && !canRewind.value) {
    pending.value = undefined;
  }
}

const playedRounds = computed(() => props.matchMap?.rounds?.length ?? 0);

watch(
  () => `${props.match.id}.${props.matchMap?.id}`,
  () => {
    data.value = null;
  },
);

watch(
  () => [
    props.match.id,
    props.matchMap?.id,
    organizer.value,
    playedRounds.value,
  ],
  () => void load(),
  { immediate: true },
);

const sides = computed(() => ({
  start: props.matchMap?.lineup_1_side ?? null,
  swaps: props.match.options?.type !== "Rush",
}));

const rounds = computed(() =>
  organizer.value && data.value
    ? toRewindRounds(data.value, mr.value, sides.value)
    : roundsFromMatchMap(
        props.matchMap,
        mr.value,
        inProgress.value,
        sides.value.swaps,
      ),
);

const blockedReason = computed(() => {
  const value = data.value;
  if (!organizer.value || !value) {
    return null;
  }
  if (value.blocked_reason === "rush") {
    return t("match.recovery.restore.rush");
  }
  if (value.blocked_reason === "team_member") {
    return t("match.recovery.restore.team_member");
  }
  if (value.blocked_reason === "not_live_yet") {
    return value.rounds.length > 0
      ? t("match.recovery.restore.not_live_yet")
      : t("match.recovery.restore.nothing_yet");
  }
  if (value.blocked_reason) {
    return t("match.recovery.restore.not_in_progress");
  }
  if (!value.rounds.some((row) => row.has_backup)) {
    return t("match.recovery.restore.nothing_yet");
  }
  return null;
});

const canRewind = computed(
  () =>
    organizer.value &&
    !!data.value?.restorable &&
    !data.value.blocked_reason &&
    !blockedReason.value,
);

const waiting = computed(
  () =>
    rewinding.value &&
    !!data.value &&
    data.value.connected_players < data.value.expected_players,
);

let poll: ReturnType<typeof setInterval> | undefined;
watch(waiting, (on) => {
  clearInterval(poll);
  poll = on ? setInterval(() => void load(), 10_000) : undefined;
});
onBeforeUnmount(() => clearInterval(poll));

function openPending() {
  if (pending.value === undefined || !canRewind.value) {
    return;
  }
  const asked = pending.value;
  target.value =
    asked !== null && canRewindTo(rounds.value, asked)
      ? asked
      : defaultRestoreRound(rounds.value);
  rewinding.value = target.value !== null;
  pending.value = undefined;
}

const { request } = useMatchRoundsFocus();
watch(
  request,
  (value) => {
    if (!value || value.matchId !== props.match.id) {
      return;
    }
    pending.value = value.round;
    request.value = null;
    openPending();
    if (organizer.value && data.value && !canRewind.value) {
      pending.value = undefined;
    }
  },
  { immediate: true },
);

watch(canRewind, (can) => {
  if (can) {
    openPending();
  } else {
    rewinding.value = false;
  }
});

async function restore(round: number) {
  if (restoring.value) {
    return;
  }
  restoring.value = true;
  try {
    // A backup is the state after a round, so the start of round N is the
    // backup taken after round N - 1.
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: RESTORE_MATCH_ROUND,
      variables: { matchId: props.match.id, round: round - 1 },
    });
    toast({ title: t("match.recovery.restore.started", { round }) });
    rewinding.value = false;
    target.value = null;
    await load();
  } catch (error: any) {
    toast({
      title: t("match.recovery.restore.failed"),
      description:
        error?.graphQLErrors?.[0]?.message ?? error?.message ?? undefined,
      variant: "destructive",
    });
  } finally {
    restoring.value = false;
  }
}
</script>

<template>
  <div
    v-if="!matchMap || (rounds.rounds.length === 0 && !organizer)"
    class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
  >
    {{ $t("match.rewind.no_rounds") }}
  </div>
  <MatchRoundsTab
    v-else
    v-model:rewinding="rewinding"
    v-model:target="target"
    :data="rounds"
    :lineup1="match.lineup_1?.name ?? ''"
    :lineup2="match.lineup_2?.name ?? ''"
    :map-number="matchMap.order"
    :can-rewind="canRewind"
    :blocked-reason="blockedReason"
    :paused="matchMap.status === 'Paused'"
    :finished="rounds.finished"
    :restoring="restoring"
    @restore="restore"
  >
    <template #aside>
      <FaqHelpGlyph v-if="match.is_organizer" section="restore" />
    </template>
  </MatchRoundsTab>
</template>
