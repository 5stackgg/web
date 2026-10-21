import type { Component } from "vue";
import {
  FileText,
  Flag,
  Hand,
  History,
  Power,
  RefreshCw,
  RotateCcw,
  Timer,
  Trophy,
  Undo2,
} from "lucide-vue-next";
import { e_match_status_enum } from "~/generated/zeus";

export type FixProblemKey =
  | "restore"
  | "restart_map"
  | "restart"
  | "winner"
  | "forfeit"
  | "reboot"
  | "reparse"
  | "undo_last"
  | "mispick"
  | "redo"
  | "act"
  | "time";

export type FixProblemItem = {
  key: FixProblemKey | string;
  icon: Component;
  title: string;
  description: string;
  tone?: "danger";
};

export type FixProblemMenu = {
  stepLabel: string;
  now: FixProblemItem[];
  anytime: FixProblemItem[];
  later?: string;
};

export type FixProblemState = {
  status: string;
  stepLabel: string;
  hasWinner: boolean;
  currentMapStatus?: string | null;
  mapsStarted: boolean;
  rush: boolean;
  bracket: boolean;
  mapVeto: boolean;
  vetoPicks: number;
  vetoTeam?: string | null;
  vetoClockRunning: boolean;
  lastPick?: { team: string; map: string } | null;
  canSetWinner: boolean;
  canReboot: boolean;
  canReparse: boolean;
};

type Translate = (key: string, values?: Record<string, unknown>) => string;

const ENDED: string[] = [
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
];

const UNFINISHED: string[] = [
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForServer,
  e_match_status_enum.Live,
];

const PRE_MAP: string[] = [
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForServer,
];

const MAP_IN_PROGRESS = ["Warmup", "Live", "Overtime", "Paused"];
const MAP_RESTARTABLE = [...MAP_IN_PROGRESS, "Knife"];

// What Fix a Problem offers: the fixes for the step the match is in first,
// then the ones that always apply. A fix that can't apply yet is left out
// rather than shown greyed; `later` says what the next step unlocks.
export function fixProblemItems(
  t: Translate,
  state: FixProblemState,
): FixProblemMenu {
  const status = state.status;
  const live = status === e_match_status_enum.Live;
  const veto = status === e_match_status_enum.Veto;
  const canceled = status === e_match_status_enum.Canceled && !state.hasWinner;
  const ended =
    ENDED.includes(status) ||
    (status === e_match_status_enum.Canceled && state.hasWinner);
  const unfinished = UNFINISHED.includes(status);
  const mapInProgress =
    live && MAP_IN_PROGRESS.includes(state.currentMapStatus ?? "");
  const mapRestartable =
    live && MAP_RESTARTABLE.includes(state.currentMapStatus ?? "");
  const vetoRewindable =
    state.mapVeto &&
    state.vetoPicks > 0 &&
    (veto ||
      ((live || status === e_match_status_enum.WaitingForServer) &&
        !state.mapsStarted));

  const now: FixProblemItem[] = [];
  const anytime: FixProblemItem[] = [];

  if (veto && state.vetoPicks > 0 && state.lastPick) {
    now.push({
      key: "undo_last",
      icon: Undo2,
      title: t("match.fix_menu.undo_last_title"),
      description: t("match.fix_menu.undo_last_description", state.lastPick),
    });
  }

  if (vetoRewindable) {
    now.push(
      {
        key: "mispick",
        icon: History,
        title: t("match.fix_menu.mispick_title"),
        description: t("match.fix_menu.mispick_description"),
      },
      {
        key: "redo",
        icon: RotateCcw,
        title: t("match.fix_menu.redo_title"),
        description: t("match.fix_menu.redo_description"),
      },
    );
  }

  if (veto && state.vetoTeam) {
    now.push({
      key: "act",
      icon: Hand,
      title: t("match.fix_menu.act_title", { team: state.vetoTeam }),
      description: t("match.fix_menu.act_description"),
    });
  }

  if (veto && state.vetoTeam && state.vetoClockRunning) {
    now.push({
      key: "time",
      icon: Timer,
      title: t("match.fix_menu.time_title"),
      description: t("match.fix_menu.time_description", {
        team: state.vetoTeam,
      }),
    });
  }

  if (mapInProgress && !state.rush) {
    now.push({
      key: "restore",
      icon: History,
      title: t("match.recovery.fix.restore_title"),
      description: t("match.fix_menu.restore_description"),
    });
  }

  if (mapRestartable) {
    now.push({
      key: "restart_map",
      icon: RotateCcw,
      title: t("match.recovery.fix.restart_map_title"),
      description: t("match.recovery.fix.restart_map_description"),
    });
  }

  if (ended) {
    if (state.bracket) {
      now.push({
        key: "restart",
        icon: RefreshCw,
        title: t("match.recovery.fix.replay_title"),
        description: t("match.recovery.fix.replay_description"),
      });
    }
    if (state.canSetWinner) {
      now.push({
        key: "winner",
        icon: Trophy,
        title: t("match.recovery.fix.winner_title"),
        description: t("match.recovery.fix.winner_description"),
      });
    }
    if (state.canReparse) {
      now.push({
        key: "reparse",
        icon: FileText,
        title: t("match.recovery.fix.reparse_title"),
        description: t("match.recovery.fix.reparse_description"),
      });
    }
  }

  if (canceled) {
    now.push({
      key: "restart",
      icon: RefreshCw,
      title: t("match.recovery.fix.reopen_title"),
      description: t("match.recovery.fix.reopen_description"),
    });
    if (state.canSetWinner) {
      now.push({
        key: "winner",
        icon: Trophy,
        title: t("match.recovery.fix.winner_title"),
        description: t("match.recovery.fix.winner_description"),
      });
    }
  }

  if (unfinished) {
    if (state.canReboot) {
      anytime.push({
        key: "reboot",
        icon: Power,
        title: t("match.recovery.fix.reboot_title"),
        description: t("match.recovery.fix.reboot_description"),
      });
    }
    anytime.push({
      key: "restart",
      icon: RefreshCw,
      title: t("match.recovery.fix.restart_title"),
      description: t("match.recovery.fix.restart_description"),
    });
    if (state.canSetWinner) {
      anytime.push({
        key: "forfeit",
        icon: Flag,
        title: t("match.recovery.fix.forfeit_title"),
        description: t("match.recovery.fix.forfeit_description"),
        tone: "danger",
      });
    }
  }

  let later: string | undefined;
  if (PRE_MAP.includes(status)) {
    later = t("match.fix_menu.later_rounds");
  } else if (live) {
    later = t("match.fix_menu.later_results");
  }

  return { stepLabel: state.stepLabel, now, anytime, later };
}
