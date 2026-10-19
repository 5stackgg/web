<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { Check, History, TriangleAlert } from "lucide-vue-next";
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
import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";
import { resolveWeapon } from "~/utilities/weaponIcon";

type RestorePlayer = {
  steam_id: string;
  name: string;
  lineup: number;
  cash: number;
  armor: number;
  helmet: boolean;
  alive: boolean;
  weapons: string[];
  kills: number;
  deaths: number;
};

type RestoreRound = {
  round: number;
  lineup_1_score: number;
  lineup_2_score: number;
  lineup_1_side: string | null;
  lineup_2_side: string | null;
  winning_side: string | null;
  winning_reason: string | null;
  lineup_1_timeouts: number | null;
  lineup_2_timeouts: number | null;
  next_lineup_1_side: string | null;
  next_lineup_2_side: string | null;
  has_backup: boolean;
  undone: boolean;
  players: RestorePlayer[];
};

type RestoreRounds = {
  map_name: string | null;
  restorable: boolean;
  blocked_reason: string | null;
  live_round: number | null;
  economy_hidden: boolean;
  connected_players: number;
  expected_players: number;
  disconnected: string[];
  rounds: RestoreRound[];
};

const props = defineProps<{
  match: Record<string, any>;
  open: boolean;
}>();

const emit = defineEmits<{ "update:open": [boolean] }>();

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
        lineup_1_timeouts
        lineup_2_timeouts
        next_lineup_1_side
        next_lineup_2_side
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

const loading = ref(false);
const loadError = ref<string | null>(null);
const data = ref<RestoreRounds | null>(null);
const selected = ref<number | null>(null);

function errorMessage(error: any) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    t("common.error")
  );
}

const roundsByNumber = computed(
  () => new Map((data.value?.rounds ?? []).map((row) => [row.round, row])),
);

// Replaying round N loads the backup taken after round N - 1.
function backupFor(round: number) {
  const row = roundsByNumber.value.get(round - 1);
  return row?.has_backup ? row : null;
}

const liveRound = computed(() => data.value?.live_round ?? null);

// Rounds a restore or a map restart undid come after the live round, and can
// be brought back until the next round is played.
const lastUndone = computed(
  () => data.value?.rounds.filter((row) => row.undone).at(-1)?.round ?? 0,
);

const selectableRounds = computed(() => {
  if (!liveRound.value) {
    return [];
  }
  const rounds: number[] = [];
  const last = Math.max(liveRound.value, lastUndone.value + 1);
  for (let round = 2; round <= last; round++) {
    if (backupFor(round)) {
      rounds.push(round);
    }
  }
  return rounds;
});

function defaultRound() {
  const live = liveRound.value ?? 0;
  return (
    selectableRounds.value.filter((round) => round <= live).at(-1) ??
    selectableRounds.value.at(-1) ??
    null
  );
}

async function load() {
  loading.value = true;
  try {
    const { data: result } = await nuxtApp.$apollo.defaultClient.query({
      query: MATCH_RESTORE_ROUNDS,
      variables: { matchId: props.match.id },
      fetchPolicy: "network-only",
    });
    data.value = result?.getMatchRestoreRounds ?? null;
    if (!selected.value || !selectableRounds.value.includes(selected.value)) {
      selected.value = defaultRound();
    }
  } catch (error) {
    if (!data.value) {
      loadError.value = errorMessage(error);
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      selected.value = null;
      data.value = null;
      loadError.value = null;
      void load();
    }
  },
  { immediate: true },
);

// The game server waits for this many players; a benched substitute who stays
// away doesn't hold a restore up.
const waiting = computed(
  () =>
    !!data.value &&
    data.value.restorable &&
    !data.value.blocked_reason &&
    data.value.connected_players < data.value.expected_players,
);

// The server refuses a restore until everyone is back, so keep checking.
let reconnectPoll: ReturnType<typeof setInterval> | undefined;

watch(
  () => props.open && waiting.value,
  (waiting) => {
    clearInterval(reconnectPoll);
    reconnectPoll = waiting
      ? setInterval(() => void load(), 10_000)
      : undefined;
  },
);

onBeforeUnmount(() => clearInterval(reconnectPoll));

const totalColumns = computed(() => {
  const regulation = (Number(props.match.options?.mr) || 12) * 2;
  const last = data.value?.rounds.at(-1)?.round ?? 0;
  return Math.max(
    regulation,
    liveRound.value ?? last,
    last,
    selectableRounds.value.at(-1) ?? 0,
  );
});

const halftime = computed(() => Number(props.match.options?.mr) || 12);

function wonBy(row: RestoreRound | undefined, lineup: 1 | 2) {
  if (!row?.winning_side) {
    return false;
  }
  return (
    row.winning_side === (lineup === 1 ? row.lineup_1_side : row.lineup_2_side)
  );
}

function cellClass(row: RestoreRound | undefined, lineup: 1 | 2) {
  if (!wonBy(row, lineup)) {
    return "bg-black/30 ring-1 ring-inset ring-border/30";
  }
  if (row?.winning_side === e_sides_enum.CT) {
    return "bg-sky-500/15 ring-1 ring-inset ring-sky-400/50 shadow-[inset_0_-2px_0_0_theme(colors.sky.400)]";
  }
  return "bg-amber-500/15 ring-1 ring-inset ring-amber-400/50 shadow-[inset_0_-2px_0_0_theme(colors.amber.400)]";
}

const columns = computed(() =>
  Array.from({ length: totalColumns.value }, (_, index) => {
    const round = index + 1;
    const row = roundsByNumber.value.get(round);
    const isLive = round === liveRound.value;
    return {
      round,
      row,
      isLive,
      future: !row && !isLive,
      undone: !!row?.undone && !isLive,
      selectable: selectableRounds.value.includes(round),
    };
  }),
);

function reasonLabel(reason?: string | null) {
  switch (reason) {
    case e_winning_reasons_enum.BombExploded:
      return t("round_history.bomb_exploded");
    case e_winning_reasons_enum.BombDefused:
      return t("round_history.bomb_defused");
    case e_winning_reasons_enum.TimeRanOut:
      return t("round_history.time_ran_out");
    case e_winning_reasons_enum.CTsWin:
      return t("round_history.cts_eliminated_ts");
    case e_winning_reasons_enum.TerroristsWin:
      return t("round_history.ts_eliminated_cts");
    default:
      return t("round_history.unknown");
  }
}

function sideLabel(side?: string | null) {
  if (side === e_sides_enum.CT) {
    return "CT";
  }
  if (side === e_sides_enum.TERRORIST) {
    return "T";
  }
  return "";
}

function columnLabel(column: (typeof columns.value)[number]) {
  if (column.isLive) {
    return t("match.recovery.restore.replay_live", { round: column.round });
  }
  if (!column.row) {
    return String(column.round);
  }
  const winner = wonBy(column.row, 1)
    ? props.match.lineup_1?.name
    : props.match.lineup_2?.name;
  return t("match.recovery.restore.round_result", {
    round: column.round,
    team: winner,
    reason: reasonLabel(column.row.winning_reason),
  });
}

const preview = computed(() => {
  if (!selected.value) {
    return null;
  }
  const row = backupFor(selected.value);
  if (!row) {
    return null;
  }

  const winner = wonBy(row, 1)
    ? props.match.lineup_1?.name
    : props.match.lineup_2?.name;
  const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;

  const team = (lineup: 1 | 2) => {
    const players = row.players.filter((player) => player.lineup === lineup);
    return {
      lineup,
      name:
        lineup === 1 ? props.match.lineup_1?.name : props.match.lineup_2?.name,
      side: sideLabel(
        lineup === 1 ? row.next_lineup_1_side : row.next_lineup_2_side,
      ),
      timeouts: lineup === 1 ? row.lineup_1_timeouts : row.lineup_2_timeouts,
      bank: money(players.reduce((total, player) => total + player.cash, 0)),
      players: players.map((player) => {
        const weapon = mainWeapon(player.weapons);
        return {
          ...player,
          cashLabel: money(player.cash),
          armorLabel:
            player.armor > 0
              ? `${player.armor}${player.helmet ? " +H" : ""}`
              : t("match.recovery.restore.no_armor"),
          weapon: weapon ? resolveWeapon(weapon) : null,
        };
      }),
    };
  };

  return {
    round: selected.value,
    isLive: selected.value === liveRound.value,
    forward: selected.value > (liveRound.value ?? 0),
    backupRound: row.round,
    lineup1Score: row.lineup_1_score,
    lineup2Score: row.lineup_2_score,
    previous: t("match.recovery.restore.previous_round", {
      round: row.round,
      team: winner,
      side: sideLabel(row.winning_side),
      reason: reasonLabel(row.winning_reason),
    }),
    teams: [team(1), team(2)],
    undo: undoLine(selected.value),
  };
});

function undoLine(round: number) {
  const live = liveRound.value ?? round;
  if (round - 1 > live) {
    return t("match.recovery.restore.redo_rounds", {
      from: live,
      to: round - 1,
    });
  }
  if (round > live) {
    return t("match.recovery.restore.redo_round", { round: live });
  }
  const lastPlayed = live - 1;
  if (round > lastPlayed) {
    return t("match.recovery.restore.undo_live");
  }
  if (round === lastPlayed) {
    return t("match.recovery.restore.undo_round", { round });
  }
  return t("match.recovery.restore.undo_rounds", {
    from: round,
    to: lastPlayed,
  });
}

const NOT_GUNS =
  /^weapon_(hegrenade|flashbang|smokegrenade|molotov|incgrenade|decoy|c4|taser|healthshot)/;
const PISTOLS = new Set([
  "weapon_glock",
  "weapon_hkp2000",
  "weapon_usp_silencer",
  "weapon_p250",
  "weapon_deagle",
  "weapon_fiveseven",
  "weapon_elite",
  "weapon_tec9",
  "weapon_cz75a",
  "weapon_revolver",
]);

function mainWeapon(weapons: string[]) {
  const guns = weapons.filter(
    (weapon) => weapon.startsWith("weapon_") && !NOT_GUNS.test(weapon),
  );
  return guns.find((weapon) => !PISTOLS.has(weapon)) ?? guns[0];
}

const unavailable = computed(() => {
  if (!data.value) {
    return null;
  }
  if (data.value.blocked_reason === "rush") {
    return t("match.recovery.restore.rush");
  }
  if (data.value.blocked_reason === "team_member") {
    return t("match.recovery.restore.team_member");
  }
  if (data.value.blocked_reason) {
    return t("match.recovery.restore.not_in_progress");
  }
  if (selectableRounds.value.length === 0) {
    return t("match.recovery.restore.nothing_yet");
  }
  return null;
});

const submitting = ref(false);

async function restore() {
  if (!preview.value || submitting.value) {
    return;
  }
  submitting.value = true;
  const round = preview.value.round;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: RESTORE_MATCH_ROUND,
      variables: { matchId: props.match.id, round: preview.value.backupRound },
    });
    toast({ title: t("match.recovery.restore.started", { round }) });
    emit("update:open", false);
  } catch (error) {
    toast({
      title: t("match.recovery.restore.failed"),
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
    <DialogContent class="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ $t("match.recovery.restore.title") }}</DialogTitle>
        <DialogDescription>
          <template v-if="data?.map_name && liveRound">
            {{
              $t("match.recovery.restore.description", {
                map: data.map_name,
                round: liveRound,
              })
            }}
          </template>
          <template v-else>
            {{ $t("match.recovery.restore.description_short") }}
          </template>
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="loading && !data"
        class="flex items-center justify-center py-12 text-muted-foreground"
      >
        <Spinner class="h-5 w-5" />
      </div>

      <div
        v-else-if="loadError"
        class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        <p class="font-semibold text-foreground">
          {{ $t("match.recovery.restore.load_failed") }}
        </p>
        <p class="mt-1">{{ loadError }}</p>
      </div>

      <div
        v-else-if="unavailable"
        class="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
      >
        <History class="h-5 w-5" />
        <p>{{ unavailable }}</p>
      </div>

      <div v-else-if="data" class="flex min-w-0 flex-col gap-4">
        <div
          class="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3"
        >
          <div class="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            <div
              class="flex w-16 shrink-0 flex-col gap-[3px] pt-[3px] text-[11px] text-muted-foreground"
            >
              <span class="flex h-5 items-center truncate">{{
                match.lineup_1?.name
              }}</span>
              <span class="flex h-5 items-center truncate">{{
                match.lineup_2?.name
              }}</span>
            </div>
            <div class="flex min-w-0 flex-1 gap-0.5">
              <button
                v-for="column of columns"
                :key="column.round"
                type="button"
                class="flex min-w-[1.25rem] flex-1 flex-col gap-[3px] rounded-[5px] p-[3px] transition-colors duration-150 ease-out disabled:cursor-default motion-reduce:transition-none"
                :class="[
                  column.round === halftime + 1 && 'ml-2',
                  selected === column.round
                    ? 'bg-[hsl(var(--tac-amber)/0.12)] ring-2 ring-[hsl(var(--tac-amber))]'
                    : column.selectable && 'hover:bg-muted/60',
                ]"
                :disabled="!column.selectable"
                :aria-pressed="selected === column.round"
                :aria-label="columnLabel(column)"
                :title="columnLabel(column)"
                @click="selected = column.round"
              >
                <template v-if="column.isLive">
                  <span
                    class="h-5 rounded-[3px] border border-dashed border-[hsl(var(--tac-amber)/0.6)]"
                  ></span>
                  <span
                    class="h-5 rounded-[3px] border border-dashed border-[hsl(var(--tac-amber)/0.6)]"
                  ></span>
                </template>
                <template v-else-if="column.future">
                  <span class="h-5 rounded-[3px] bg-muted/20"></span>
                  <span class="h-5 rounded-[3px] bg-muted/20"></span>
                </template>
                <template v-else>
                  <span
                    class="h-5 rounded-[3px]"
                    :class="[
                      cellClass(column.row, 1),
                      column.undone && 'opacity-40',
                    ]"
                  ></span>
                  <span
                    class="h-5 rounded-[3px]"
                    :class="[
                      cellClass(column.row, 2),
                      column.undone && 'opacity-40',
                    ]"
                  ></span>
                </template>
                <span
                  class="text-center font-mono text-[9px] font-bold leading-3"
                  :class="
                    selected === column.round
                      ? 'text-[hsl(var(--tac-amber))]'
                      : column.selectable
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/40'
                  "
                >
                  {{
                    column.isLive
                      ? $t("match.recovery.restore.now")
                      : column.round
                  }}
                </span>
              </button>
            </div>
          </div>
          <div
            class="flex flex-wrap gap-x-4 gap-y-1 pl-[4.375rem] text-[11px] text-muted-foreground"
          >
            <span class="inline-flex items-center gap-1.5">
              <span
                class="h-2.5 w-2.5 rounded-sm bg-sky-500/15 ring-1 ring-inset ring-sky-400/50"
              ></span>
              {{ $t("match.recovery.restore.won_ct") }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span
                class="h-2.5 w-2.5 rounded-sm bg-amber-500/15 ring-1 ring-inset ring-amber-400/50"
              ></span>
              {{ $t("match.recovery.restore.won_t") }}
            </span>
            <span v-if="lastUndone" class="inline-flex items-center gap-1.5">
              <span
                class="h-2.5 w-2.5 rounded-sm bg-sky-500/15 opacity-40 ring-1 ring-inset ring-sky-400/50"
              ></span>
              {{ $t("match.recovery.restore.undone") }}
            </span>
            <span>{{ $t("match.recovery.restore.round_one") }}</span>
          </div>
        </div>

        <div
          v-if="preview"
          class="flex min-w-0 flex-col rounded-lg border border-border/60 bg-background/60"
        >
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3"
          >
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-base font-semibold">
                {{
                  preview.isLive
                    ? $t("match.recovery.restore.headline_live", {
                        round: preview.round,
                      })
                    : preview.forward
                      ? $t("match.recovery.restore.headline_forward", {
                          round: preview.round,
                        })
                      : $t("match.recovery.restore.headline", {
                          round: preview.round,
                        })
                }}
              </span>
              <span class="text-xs text-muted-foreground">{{
                preview.previous
              }}</span>
            </div>
            <div class="flex items-center gap-2.5 tabular-nums">
              <span class="text-sm text-muted-foreground">{{
                match.lineup_1?.name
              }}</span>
              <span class="text-2xl font-bold">
                {{ preview.lineup1Score
                }}<span class="px-1.5 text-muted-foreground/60">–</span
                >{{ preview.lineup2Score }}
              </span>
              <span class="text-sm text-muted-foreground">{{
                match.lineup_2?.name
              }}</span>
            </div>
          </div>

          <div
            v-if="data.economy_hidden"
            class="px-4 py-3 text-xs text-muted-foreground"
          >
            {{ $t("match.recovery.restore.economy_hidden") }}
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2">
            <div
              v-for="team of preview.teams"
              :key="team.lineup"
              class="flex min-w-0 flex-col gap-2 px-4 py-3"
              :class="
                team.lineup === 2 &&
                'border-t border-border/60 md:border-l md:border-t-0'
              "
            >
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold">{{
                  team.name
                }}</span>
                <span
                  v-if="team.side"
                  class="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.16em]"
                  :class="
                    team.side === 'CT'
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-amber-500/15 text-amber-300'
                  "
                  >{{ team.side }}</span
                >
                <span class="flex-1"></span>
                <span class="whitespace-nowrap text-xs text-muted-foreground">
                  {{ $t("match.recovery.restore.bank", { amount: team.bank }) }}
                  <template v-if="team.timeouts != null">
                    ·
                    {{
                      $t("match.recovery.restore.timeouts", {
                        count: team.timeouts,
                      })
                    }}
                  </template>
                </span>
              </div>
              <div
                class="grid grid-cols-[minmax(0,1fr)_4rem_3.5rem_minmax(0,6rem)_3rem] gap-x-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>{{ $t("match.recovery.restore.player") }}</span>
                <span class="text-right">{{
                  $t("match.recovery.restore.cash")
                }}</span>
                <span>{{ $t("match.recovery.restore.armor") }}</span>
                <span>{{ $t("match.recovery.restore.carries") }}</span>
                <span class="text-right">{{
                  $t("match.recovery.restore.kd")
                }}</span>
              </div>
              <div
                v-for="player of team.players"
                :key="player.steam_id"
                class="grid grid-cols-[minmax(0,1fr)_4rem_3.5rem_minmax(0,6rem)_3rem] items-center gap-x-2 border-t border-border/40 py-1 text-sm"
              >
                <span class="truncate font-semibold">{{ player.name }}</span>
                <span
                  class="text-right tabular-nums text-[hsl(var(--success))]"
                  >{{ player.cashLabel }}</span
                >
                <span
                  class="text-xs tabular-nums"
                  :class="player.armor > 0 ? '' : 'text-muted-foreground/60'"
                  >{{ player.armorLabel }}</span
                >
                <span
                  v-if="player.alive && player.weapon"
                  class="inline-flex min-w-0 items-center gap-1.5 text-xs"
                  :title="player.weapon.label"
                >
                  <img
                    v-if="player.weapon.icon"
                    :src="player.weapon.icon"
                    alt=""
                    class="h-3.5 w-auto shrink-0 opacity-80 brightness-0 invert"
                  />
                  <span class="truncate">{{ player.weapon.label }}</span>
                </span>
                <span
                  v-else-if="player.alive"
                  class="text-xs text-muted-foreground"
                  >{{ $t("match.recovery.restore.knife_only") }}</span
                >
                <span v-else class="text-xs text-muted-foreground/60">{{
                  $t("match.recovery.restore.died")
                }}</span>
                <span
                  class="text-right text-xs tabular-nums text-muted-foreground"
                  >{{ player.kills }} / {{ player.deaths }}</span
                >
              </div>
            </div>
          </div>

          <div
            class="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground"
          >
            {{ preview.undo }}
          </div>
        </div>

        <div
          v-if="waiting"
          class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 text-sm"
        >
          <TriangleAlert
            class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <span>{{
            $t("match.recovery.restore.waiting", {
              connected: data.connected_players,
              expected: data.expected_players,
              names: data.disconnected.join(", "),
            })
          }}</span>
        </div>
        <div
          v-else
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Check class="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          {{ $t("match.recovery.restore.everyone_connected") }}
        </div>
      </div>

      <DialogFooter class="items-center gap-2 sm:justify-between">
        <span
          v-if="preview && !unavailable"
          class="text-xs text-muted-foreground"
        >
          {{ $t("match.recovery.restore.pauses") }}
        </span>
        <div class="flex gap-2">
          <Button variant="outline" @click="emit('update:open', false)">
            {{ $t("common.cancel") }}
          </Button>
          <Button
            v-if="data && !unavailable"
            :disabled="!preview || waiting"
            :loading="submitting"
            @click="restore"
          >
            {{
              preview?.isLive
                ? $t("match.recovery.restore.confirm_live", {
                    round: preview.round,
                  })
                : $t("match.recovery.restore.confirm", {
                    round: preview?.round ?? "",
                  })
            }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
