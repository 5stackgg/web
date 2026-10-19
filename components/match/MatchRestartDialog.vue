<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { Lock } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  e_match_status_enum,
  e_tournament_stage_types_enum,
} from "~/generated/zeus";

type Impact = {
  is_source: boolean;
  will_delete_match: boolean;
  stage_type: string;
};

type Standing = { tournament_team_id: string; wins: number; losses: number };

const props = defineProps<{
  match: Record<string, any>;
  open: boolean;
}>();

const emit = defineEmits<{ "update:open": [boolean] }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const PREVIEW_RESET = gql`
  mutation PreviewTournamentMatchReset($matchId: uuid!) {
    PreviewTournamentMatchReset(match_id: $matchId) {
      impacts {
        is_source
        will_delete_match
        stage_type
      }
    }
  }
`;

const RESET = gql`
  mutation ResetTournamentMatch(
    $matchId: uuid!
    $winningLineupId: uuid
    $resetStatus: String
  ) {
    ResetTournamentMatch(
      match_id: $matchId
      winning_lineup_id: $winningLineupId
      reset_status: $resetStatus
    ) {
      success
    }
  }
`;

const RESTART = gql`
  mutation RestartMatch($matchId: uuid!) {
    restartMatch(match_id: $matchId) {
      success
    }
  }
`;

const BLOCKED_REASONS: Record<string, string> = {
  "the next stage was already seeded from these standings":
    "match.recovery.restart.blocked_stage_seeded",
  "the next Swiss round was already paired from this result":
    "match.recovery.restart.blocked_swiss_paired",
  "cannot reset while an affected downstream match is live":
    "match.recovery.restart.blocked_downstream_live",
  "this playoff already decided the promotions and relegations":
    "match.recovery.restart.blocked_relegation_decided",
};

const ENDED = [
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
] as string[];

const mode = computed<"reopen" | "tournament">(() => {
  const status = props.match.status as string;
  const ended =
    ENDED.includes(status) ||
    (status === e_match_status_enum.Canceled &&
      !!props.match.winning_lineup_id);
  return ended ? "tournament" : "reopen";
});

const winnerIsLineup1 = computed(
  () =>
    !!props.match.winning_lineup_id &&
    props.match.winning_lineup_id === props.match.lineup_1_id,
);

const winner = computed(() => {
  if (!props.match.winning_lineup_id) {
    return null;
  }
  return winnerIsLineup1.value ? props.match.lineup_1 : props.match.lineup_2;
});

const loser = computed(() => {
  if (!props.match.winning_lineup_id) {
    return null;
  }
  return winnerIsLineup1.value ? props.match.lineup_2 : props.match.lineup_1;
});

const choice = ref<"replay" | "swap">("replay");
const loading = ref(false);
const blocked = ref<string | null>(null);
const impacts = ref<Impact[]>([]);
const bracket = ref<{
  tournament_team_id_1: string | null;
  tournament_team_id_2: string | null;
  stage: { type: string; results: Standing[] } | null;
} | null>(null);

function errorMessage(error: any) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    t("common.error")
  );
}

let previewRequest = 0;

async function loadTournamentPreview() {
  const request = ++previewRequest;
  loading.value = true;
  blocked.value = null;
  impacts.value = [];
  bracket.value = null;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: PREVIEW_RESET,
      variables: { matchId: props.match.id },
    });
    if (request !== previewRequest) {
      return;
    }
    impacts.value = data?.PreviewTournamentMatchReset?.impacts ?? [];
  } catch (error) {
    if (request !== previewRequest) {
      return;
    }
    const message = errorMessage(error);
    blocked.value = BLOCKED_REASONS[message]
      ? t(BLOCKED_REASONS[message])
      : message;
    loading.value = false;
    return;
  }

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: generateQuery({
        tournament_brackets: [
          { where: { match_id: { _eq: props.match.id } }, limit: 1 },
          {
            tournament_team_id_1: true,
            tournament_team_id_2: true,
            stage: {
              type: true,
              results: [
                {},
                { tournament_team_id: true, wins: true, losses: true },
              ],
            },
          },
        ],
      }),
      fetchPolicy: "network-only",
    });
    if (request === previewRequest) {
      bracket.value = (data as any)?.tournament_brackets?.[0] ?? null;
    }
  } finally {
    if (request === previewRequest) {
      loading.value = false;
    }
  }
}

watch(
  () => [props.open, mode.value] as const,
  ([open, current]) => {
    if (!open) {
      return;
    }
    previewRequest++;
    loading.value = false;
    choice.value = "replay";
    blocked.value = null;
    impacts.value = [];
    bracket.value = null;
    if (current === "tournament") {
      void loadTournamentPreview();
    }
  },
  { immediate: true },
);

const isStandingsStage = computed(() =>
  [
    e_tournament_stage_types_enum.RoundRobin,
    e_tournament_stage_types_enum.Swiss,
  ].includes(bracket.value?.stage?.type as e_tournament_stage_types_enum),
);

const downstreamCount = computed(
  () =>
    impacts.value.filter(
      (impact) => !impact.is_source && impact.will_delete_match,
    ).length,
);

// Lineup 1 always plays as the bracket's team 1 (schedule_tournament_match).
const standings = computed(() => {
  if (!isStandingsStage.value || !bracket.value || !winner.value) {
    return [];
  }
  const results = bracket.value.stage?.results ?? [];
  const find = (teamId: string | null) =>
    results.find((row) => row.tournament_team_id === teamId);

  const rows = [
    {
      name: props.match.lineup_1?.name,
      current: find(bracket.value.tournament_team_id_1),
      won: winnerIsLineup1.value,
    },
    {
      name: props.match.lineup_2?.name,
      current: find(bracket.value.tournament_team_id_2),
      won: !winnerIsLineup1.value,
    },
  ];

  return rows
    .filter((row) => row.current)
    .map((row) => {
      const wins = Number(row.current!.wins) || 0;
      const losses = Number(row.current!.losses) || 0;
      let afterWins = row.won ? wins - 1 : wins;
      let afterLosses = row.won ? losses : losses - 1;
      if (choice.value === "swap") {
        afterWins += row.won ? 0 : 1;
        afterLosses += row.won ? 1 : 0;
      }
      return {
        name: row.name,
        now: `${wins}–${losses}`,
        after: `${Math.max(0, afterWins)}–${Math.max(0, afterLosses)}`,
      };
    });
});

const reopenLines = computed(() => [
  props.match.status === e_match_status_enum.Canceled
    ? t("match.recovery.restart.reopen_canceled")
    : t("match.recovery.restart.reopen_live"),
  props.match.options?.map_veto
    ? t("match.recovery.restart.reopen_veto")
    : t("match.recovery.restart.reopen_fixed_maps"),
]);

const submitting = ref(false);

async function restart() {
  if (submitting.value || blocked.value) {
    return;
  }
  submitting.value = true;
  try {
    if (mode.value === "reopen") {
      await nuxtApp.$apollo.defaultClient.mutate({
        mutation: RESTART,
        variables: { matchId: props.match.id },
      });
    } else {
      await nuxtApp.$apollo.defaultClient.mutate({
        mutation: RESET,
        variables: {
          matchId: props.match.id,
          winningLineupId:
            choice.value === "swap" ? (loser.value?.id ?? null) : null,
          resetStatus: e_match_status_enum.WaitingForCheckIn,
        },
      });
    }
    toast({
      title:
        choice.value === "swap"
          ? t("match.recovery.restart.result_changed")
          : t("match.recovery.restart.restarted"),
    });
    emit("update:open", false);
  } catch (error) {
    toast({
      title: t("match.recovery.restart.failed"),
      description: errorMessage(error),
      variant: "destructive",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogContent class="max-w-xl">
      <template v-if="blocked">
        <DialogHeader>
          <div class="flex items-start gap-3.5">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
            >
              <Lock class="h-[18px] w-[18px]" />
            </span>
            <div class="flex flex-col gap-1.5">
              <DialogTitle>{{
                $t("match.recovery.restart.blocked_title")
              }}</DialogTitle>
              <DialogDescription>{{ blocked }}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="emit('update:open', false)">
            {{ $t("common.close") }}
          </Button>
        </DialogFooter>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ $t("match.recovery.restart.title") }}</DialogTitle>
          <DialogDescription>
            {{
              $t("match.recovery.fix.description", {
                team_1: match.lineup_1?.name,
                team_2: match.lineup_2?.name,
              })
            }}
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="mode === 'reopen'"
          class="flex flex-col gap-2 rounded-lg bg-muted/30 px-3.5 py-3 text-sm"
        >
          <p v-for="line of reopenLines" :key="line">{{ line }}</p>
        </div>

        <div
          v-else-if="loading"
          class="flex items-center justify-center py-10 text-muted-foreground"
        >
          <Spinner class="h-5 w-5" />
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            role="radiogroup"
            :aria-label="$t('match.recovery.restart.title')"
            class="flex flex-col gap-2"
          >
            <label
              class="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-lg border p-3.5 transition-colors duration-150 ease-out motion-reduce:transition-none"
              :class="
                choice === 'replay'
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.06)]'
                  : 'border-border hover:border-[hsl(var(--tac-amber)/0.4)]'
              "
            >
              <input
                v-model="choice"
                type="radio"
                name="restart-choice"
                value="replay"
                class="mt-0.5 accent-[hsl(var(--tac-amber))]"
              />
              <span class="flex flex-col gap-1">
                <span class="text-sm font-semibold">{{
                  $t("match.recovery.restart.replay_title")
                }}</span>
                <span class="text-xs text-muted-foreground">{{
                  $t("match.recovery.restart.replay_description")
                }}</span>
              </span>
            </label>
            <label
              v-if="loser"
              class="grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-lg border p-3.5 transition-colors duration-150 ease-out motion-reduce:transition-none"
              :class="
                choice === 'swap'
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.06)]'
                  : 'border-border hover:border-[hsl(var(--tac-amber)/0.4)]'
              "
            >
              <input
                v-model="choice"
                type="radio"
                name="restart-choice"
                value="swap"
                class="mt-0.5 accent-[hsl(var(--tac-amber))]"
              />
              <span class="flex flex-col gap-1">
                <span class="text-sm font-semibold">{{
                  $t("match.recovery.restart.swap_title", { team: loser.name })
                }}</span>
                <span class="text-xs text-muted-foreground">{{
                  $t("match.recovery.restart.swap_description")
                }}</span>
              </span>
            </label>
          </div>

          <div v-if="standings.length > 0" class="flex flex-col gap-2">
            <span
              class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
              >{{ $t("match.recovery.restart.standings") }}</span
            >
            <div class="overflow-hidden rounded-lg border border-border/60">
              <div
                v-for="row of standings"
                :key="row.name"
                class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border/40 px-3 py-2 text-sm first:border-t-0"
              >
                <span class="truncate font-semibold">{{ row.name }}</span>
                <span class="tabular-nums">
                  <span class="text-muted-foreground">{{ row.now }}</span>
                  →
                  <span class="text-[hsl(var(--tac-amber))]">{{
                    row.after
                  }}</span>
                </span>
              </div>
            </div>
            <span class="text-xs text-muted-foreground">{{
              $t("match.recovery.restart.standings_hint")
            }}</span>
          </div>

          <p
            v-if="downstreamCount > 0"
            class="rounded-lg bg-muted/30 px-3.5 py-3 text-sm"
          >
            {{
              $t(
                "match.recovery.restart.downstream",
                { count: downstreamCount },
                downstreamCount,
              )
            }}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="emit('update:open', false)">
            {{ $t("common.cancel") }}
          </Button>
          <Button :disabled="loading" :loading="submitting" @click="restart">
            {{
              choice === "swap"
                ? $t("match.recovery.restart.swap_confirm")
                : $t("match.recovery.restart.title")
            }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
