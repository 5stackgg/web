<script setup lang="ts">
import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import {
  ChevronRight,
  FileText,
  History,
  Power,
  RefreshCw,
  RotateCcw,
  Trophy,
  UserX,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { e_match_status_enum } from "~/generated/zeus";

export type FixProblemAction =
  "restore" | "restart_map" | "restart" | "winner" | "reboot" | "reparse";

type Row = {
  key: FixProblemAction;
  icon: Component;
  title: string;
  description: string;
  action: string;
  blocked?: string;
  primary?: boolean;
};

const props = defineProps<{
  match: Record<string, any>;
  open: boolean;
  canSetWinner: boolean;
  canReboot: boolean;
  canReparse: boolean;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  select: [FixProblemAction];
}>();

const { t } = useI18n();

const ENDED = [
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
] as string[];

const UNFINISHED = [
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForServer,
  e_match_status_enum.Live,
] as string[];

const MAP_IN_PROGRESS = ["Warmup", "Live", "Overtime", "Paused"];

const MAP_RESTARTABLE = [...MAP_IN_PROGRESS, "Knife"];

const state = computed(() => {
  const status = props.match.status as string;
  const hasWinner = !!props.match.winning_lineup_id;
  const currentMap = props.match.match_maps?.find(
    (map: any) => map.is_current_map,
  );
  return {
    unfinished: UNFINISHED.includes(status),
    canceled: status === e_match_status_enum.Canceled && !hasWinner,
    ended:
      ENDED.includes(status) ||
      (status === e_match_status_enum.Canceled && hasWinner),
    mapInProgress:
      status === e_match_status_enum.Live &&
      MAP_IN_PROGRESS.includes(currentMap?.status),
    mapRestartable:
      status === e_match_status_enum.Live &&
      MAP_RESTARTABLE.includes(currentMap?.status),
    rush: props.match.options?.type === "Rush",
    bracket:
      !!props.match.is_tournament_match ||
      (props.match.tournament_brackets?.length ?? 0) > 0,
  };
});

const rows = computed<Row[]>(() => {
  const s = state.value;
  const rows: Row[] = [];

  if (s.unfinished || s.ended) {
    let blocked: string | undefined;
    if (s.rush) {
      blocked = t("match.recovery.fix.restore_rush");
    } else if (s.ended) {
      blocked = t("match.recovery.fix.restore_over");
    } else if (!s.mapInProgress) {
      blocked = t("match.recovery.fix.restore_not_live");
    }
    rows.push({
      key: "restore",
      icon: History,
      title: t("match.recovery.fix.restore_title"),
      description: t("match.recovery.fix.restore_description"),
      action: t("match.recovery.restore.title"),
      blocked,
      primary: !blocked,
    });
  }

  if (s.mapRestartable) {
    rows.push({
      key: "restart_map",
      icon: RotateCcw,
      title: t("match.recovery.fix.restart_map_title"),
      description: t("match.recovery.fix.restart_map_description"),
      action: t("match.recovery.restart_map.title"),
    });
  }

  if (s.unfinished || s.canceled) {
    rows.push({
      key: "restart",
      icon: RefreshCw,
      title: s.canceled
        ? t("match.recovery.fix.reopen_title")
        : t("match.recovery.fix.restart_title"),
      description: s.canceled
        ? t("match.recovery.fix.reopen_description")
        : t("match.recovery.fix.restart_description"),
      action: t("match.recovery.restart.title"),
      primary: s.canceled,
    });
  } else if (s.ended) {
    rows.push({
      key: "restart",
      icon: RefreshCw,
      title: t("match.recovery.fix.replay_title"),
      description: t("match.recovery.fix.replay_description"),
      action: t("match.recovery.restart.title"),
      blocked: s.bracket
        ? undefined
        : t("match.recovery.fix.replay_bracket_only"),
      primary: s.bracket,
    });
  }

  if (props.canSetWinner && (s.unfinished || s.canceled || s.ended)) {
    rows.push({
      key: "winner",
      icon: s.unfinished ? UserX : Trophy,
      title: s.unfinished
        ? t("match.recovery.fix.forfeit_title")
        : t("match.recovery.fix.winner_title"),
      description: s.unfinished
        ? t("match.recovery.fix.forfeit_description")
        : t("match.recovery.fix.winner_description"),
      action: t("match.winner.set"),
    });
  }

  if (props.canReboot) {
    rows.push({
      key: "reboot",
      icon: Power,
      title: t("match.recovery.fix.reboot_title"),
      description: t("match.recovery.fix.reboot_description"),
      action: t("match.server.reboot"),
    });
  }

  if (props.canReparse && s.ended) {
    rows.push({
      key: "reparse",
      icon: FileText,
      title: t("match.recovery.fix.reparse_title"),
      description: t("match.recovery.fix.reparse_description"),
      action: t("match.actions.reparse_demos"),
    });
  }

  const firstPrimary = rows.findIndex((row) => row.primary);
  return rows.map((row, index) => ({
    ...row,
    primary: index === firstPrimary,
  }));
});

function choose(row: Row) {
  if (row.blocked) {
    return;
  }
  emit("update:open", false);
  emit("select", row.key);
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ $t("match.recovery.fix.title") }}</DialogTitle>
        <DialogDescription>
          {{
            $t("match.recovery.fix.description", {
              team_1: match.lineup_1?.name,
              team_2: match.lineup_2?.name,
            })
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-1.5">
        <button
          v-for="row of rows"
          :key="row.key"
          type="button"
          class="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg border p-3 text-left transition-colors duration-150 ease-out motion-reduce:transition-none"
          :class="
            row.blocked
              ? 'cursor-default border-dashed border-border'
              : row.primary
                ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.06)] hover:bg-[hsl(var(--tac-amber)/0.12)]'
                : 'border-border hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-muted/40'
          "
          :aria-disabled="!!row.blocked"
          @click="choose(row)"
        >
          <span
            class="grid h-9 w-9 place-items-center rounded-md"
            :class="
              row.blocked
                ? 'bg-muted/30 text-muted-foreground/60'
                : row.primary
                  ? 'bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
                  : 'bg-muted text-foreground/80'
            "
          >
            <component :is="row.icon" class="h-[18px] w-[18px]" />
          </span>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span
              class="text-sm font-semibold"
              :class="row.blocked && 'text-muted-foreground'"
              >{{ row.title }}</span
            >
            <span
              class="text-xs"
              :class="
                row.blocked
                  ? 'text-muted-foreground/70'
                  : 'text-muted-foreground'
              "
              >{{ row.blocked ?? row.description }}</span
            >
          </span>
          <span
            class="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
            :class="
              row.blocked
                ? 'text-muted-foreground/40'
                : row.primary
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-foreground/80'
            "
          >
            {{ row.action }}
            <ChevronRight v-if="!row.blocked" class="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
