<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { History } from "lucide-vue-next";
import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";
import {
  canRewindTo,
  scoreBefore,
  type RewindRound,
  type RewindRounds,
} from "~/utilities/rewind";

const props = defineProps<{
  data: RewindRounds;
  lineup1: string;
  lineup2: string;
  canRewind?: boolean;
}>();

const emit = defineEmits<{ rewindTo: [number] }>();

const { t } = useI18n();

type Row =
  | { kind: "live"; round: number; score: [number, number] }
  | { kind: "played"; round: number; row: RewindRound }
  | { kind: "half"; round: number };

const rows = computed<Row[]>(() => {
  const live = props.data.live_round;
  const played = props.data.rounds.filter(
    (row) => !row.undone && row.round < live,
  );
  const list: Row[] = props.data.finished
    ? []
    : [{ kind: "live", round: live, score: scoreBefore(props.data, live) }];
  for (const row of [...played].reverse()) {
    if (row.round === props.data.halftime && live > props.data.halftime) {
      list.push({ kind: "half", round: row.round });
    }
    list.push({ kind: "played", round: row.round, row });
  }
  return list;
});

function pickable(round: number) {
  return !!props.canRewind && canRewindTo(props.data, round);
}

function winner(row: RewindRound) {
  return row.winning_side === row.lineup_1_side ? props.lineup1 : props.lineup2;
}

function sideText(side?: e_sides_enum | null) {
  return side === e_sides_enum.CT ? "text-sky-300" : "text-amber-300";
}

function reason(row: RewindRound) {
  switch (row.winning_reason) {
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
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/60 bg-card/30">
    <div
      class="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.2fr)_4rem_7.5rem] gap-3 border-b border-border/60 px-4 py-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground max-sm:grid-cols-[3rem_minmax(0,1fr)_4rem]"
    >
      <span>{{ $t("match.rewind.round") }}</span>
      <span>{{ $t("match.rewind.won_by") }}</span>
      <span class="max-sm:hidden">{{ $t("match.rewind.how") }}</span>
      <span class="text-right">{{ $t("match.rewind.score") }}</span>
      <span class="max-sm:hidden" />
    </div>
    <TransitionGroup
      tag="ol"
      enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <li
        v-for="item in rows"
        :key="`${item.kind}-${item.round}`"
        class="group border-t border-border/40 first:border-t-0"
      >
        <div
          v-if="item.kind === 'half'"
          class="px-4 py-1 text-center font-mono text-[0.58rem] uppercase tracking-[0.3em] text-muted-foreground/60"
        >
          {{ $t("match.rewind.halftime") }}
        </div>
        <component
          :is="pickable(item.round) ? 'button' : 'div'"
          v-else
          :type="pickable(item.round) ? 'button' : undefined"
          class="grid w-full grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.2fr)_4rem_8.5rem] items-center gap-3 px-4 py-2 text-left text-sm outline-none transition-colors duration-150 max-sm:grid-cols-[3rem_minmax(0,1fr)_4rem]"
          :class="[
            item.kind === 'live' && 'bg-[hsl(var(--tac-amber)/0.05)]',
            pickable(item.round) &&
              'group/row cursor-pointer hover:bg-[hsl(var(--tac-amber)/0.08)] focus-visible:bg-[hsl(var(--tac-amber)/0.08)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber))]',
          ]"
          @click="pickable(item.round) && emit('rewindTo', item.round)"
        >
          <span class="font-mono text-xs tabular-nums text-muted-foreground">
            {{ String(item.round).padStart(2, "0") }}
          </span>
          <template v-if="item.kind === 'live'">
            <span class="flex items-center gap-2 text-[hsl(var(--tac-amber))]">
              <span class="relative flex size-2">
                <span
                  class="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-60 motion-reduce:animate-none"
                />
                <span
                  class="relative inline-flex size-2 rounded-full bg-[hsl(var(--tac-amber))]"
                />
              </span>
              {{ $t("match.rewind.in_progress") }}
            </span>
            <span class="text-muted-foreground max-sm:hidden">—</span>
            <span class="text-right tabular-nums text-muted-foreground">
              {{ item.score[0] }}–{{ item.score[1] }}
            </span>
          </template>
          <template v-else>
            <span
              class="truncate font-semibold"
              :class="sideText(item.row.winning_side)"
            >
              {{ winner(item.row) }}
            </span>
            <span class="truncate text-muted-foreground max-sm:hidden">
              {{ reason(item.row) }}
            </span>
            <span class="text-right tabular-nums">
              {{ item.row.lineup_1_score }}–{{ item.row.lineup_2_score }}
            </span>
          </template>
          <span class="flex justify-end max-sm:hidden">
            <span
              v-if="pickable(item.round)"
              class="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.14em] text-[hsl(var(--tac-amber))] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible/row:opacity-100"
            >
              <History class="size-3" />
              {{ $t("match.rewind.restore_from_here") }}
            </span>
          </span>
        </component>
      </li>
    </TransitionGroup>
  </div>
</template>
