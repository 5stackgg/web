import { e_tournament_stage_types_enum } from "~/generated/zeus";
import { getRoundLabel } from "~/utilities/tournamentRoundLabels";

export type ProgressStepKind =
  | "round"
  | "quarterfinals"
  | "semifinals"
  | "upper_final"
  | "final"
  | "grand_final"
  | "swiss"
  | "groups"
  | "playoffs";

export type ProgressStepState = "done" | "current" | "upcoming";

export interface ProgressStep {
  key: string;
  kind: ProgressStepKind;
  number?: number;
  state: ProgressStepState;
  liveCount: number;
  startsAt: string | null;
}

export interface ProgressBracket {
  round: number;
  group?: number | string | null;
  path?: string | null;
  bye?: boolean | null;
  finished?: boolean | null;
  scheduled_at?: string | null;
  match?: {
    status?: string | null;
    winning_lineup_id?: string | null;
  } | null;
}

export interface ProgressStage {
  type?: string | null;
  order?: number | null;
  groups?: number | null;
  brackets?: ProgressBracket[] | null;
}

const LABEL_KINDS: Record<string, ProgressStepKind> = {
  "tournament.round_labels.quarter_finals": "quarterfinals",
  "tournament.round_labels.wb_quarter_finals": "quarterfinals",
  "tournament.round_labels.semi_finals": "semifinals",
  "tournament.round_labels.wb_semi_finals": "semifinals",
  "tournament.round_labels.wb_final": "upper_final",
  "tournament.round_labels.final": "final",
  "tournament.round_labels.grand_final": "grand_final",
};

function isDone(bracket: ProgressBracket) {
  return !!bracket.finished || !!bracket.match?.winning_lineup_id;
}

function playable(brackets?: ProgressBracket[] | null) {
  return (brackets || []).filter((bracket) => !bracket.bye);
}

function isElimination(type?: string | null) {
  return (
    type === e_tournament_stage_types_enum.SingleElimination ||
    type === e_tournament_stage_types_enum.DoubleElimination
  );
}

// Lower-bracket groups sit after the divisions (division + stage.groups).
function isLowerBracket(bracket: ProgressBracket, divisions: number) {
  return (
    bracket.path === "LB" ||
    (bracket.group != null && Number(bracket.group) > divisions)
  );
}

function stageKind(type?: string | null): ProgressStepKind {
  if (type === e_tournament_stage_types_enum.Swiss) return "swiss";
  if (type === e_tournament_stage_types_enum.RoundRobin) return "groups";
  return "playoffs";
}

function stageDone(stage: ProgressStage) {
  const brackets = playable(stage.brackets);
  return brackets.length > 0 && brackets.every(isDone);
}

function earliest(brackets: ProgressBracket[]): string | null {
  let best: string | null = null;
  for (const bracket of brackets) {
    if (!bracket.scheduled_at) continue;
    if (
      !best ||
      new Date(bracket.scheduled_at).getTime() < new Date(best).getTime()
    ) {
      best = bracket.scheduled_at;
    }
  }
  return best;
}

function liveCount(brackets: ProgressBracket[]) {
  return brackets.filter((bracket) => bracket.match?.status === "Live").length;
}

function roundSteps(stage: ProgressStage, isFinalStage: boolean) {
  const elimination = isElimination(stage.type);
  const divisions = stage.groups || 1;
  const brackets = (stage.brackets || []).filter(
    (bracket) => !elimination || !isLowerBracket(bracket, divisions),
  );

  const byRound = new Map<number, ProgressBracket[]>();
  for (const bracket of brackets) {
    const list = byRound.get(bracket.round) || [];
    list.push(bracket);
    byRound.set(bracket.round, list);
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1];
  // Labels count the matches of one division, byes included -- the same count
  // the bracket viewer hands getRoundLabel.
  const firstGroup = Math.min(
    ...brackets.map((bracket) => Number(bracket.group ?? 1)),
  );

  const steps: ProgressStep[] = [];
  let currentFound = false;

  for (const round of rounds) {
    const all = byRound.get(round)!;
    const real = playable(all);
    if (!real.length) continue;

    const done = real.every(isDone);
    let state: ProgressStepState = "done";
    if (!done) {
      state = currentFound ? "upcoming" : "current";
      currentFound = true;
    }

    let kind: ProgressStepKind = "round";
    let number: number | undefined = round;
    if (elimination) {
      const matchesInRound =
        all.filter((bracket) => Number(bracket.group ?? 1) === firstGroup)
          .length || all.length;
      const label = getRoundLabel(
        round,
        stage.order ?? 1,
        isFinalStage,
        matchesInRound,
        false,
        stage.type,
        round === maxRound,
      );
      if (LABEL_KINDS[label.key]) {
        kind = LABEL_KINDS[label.key];
        number = undefined;
      } else if (typeof label.params?.number === "number") {
        number = label.params.number;
      }
    }

    steps.push({
      key: `${stage.order ?? 1}-${round}`,
      kind,
      number,
      state,
      liveCount: state === "done" ? 0 : liveCount(real),
      startsAt:
        state === "done" ? null : earliest(real.filter((b) => !isDone(b))),
    });
  }

  return steps;
}

// The run of a tournament as one row of steps: the current stage's rounds
// (upper path only for elimination) with every other stage collapsed to a
// single step. The current step is the lowest round with an unplayed match.
export function tournamentProgressSteps(
  stages?: ProgressStage[] | null,
): ProgressStep[] {
  const ordered = [...(stages || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  if (!ordered.length) return [];

  const currentIndex = ordered.findIndex((stage) => !stageDone(stage));
  const expandIndex = currentIndex === -1 ? ordered.length - 1 : currentIndex;

  const steps: ProgressStep[] = [];
  ordered.forEach((stage, index) => {
    if (index === expandIndex) {
      const rounds = roundSteps(stage, index === ordered.length - 1);
      if (rounds.length) {
        steps.push(...rounds);
        return;
      }
    }

    const brackets = playable(stage.brackets);
    const state: ProgressStepState =
      index < expandIndex
        ? "done"
        : index === expandIndex
          ? currentIndex === -1
            ? "done"
            : "current"
          : "upcoming";

    steps.push({
      key: `stage-${stage.order ?? index + 1}`,
      kind: stageKind(stage.type),
      state,
      liveCount: state === "current" ? liveCount(brackets) : 0,
      startsAt: state === "done" ? null : earliest(brackets),
    });
  });

  return steps;
}
