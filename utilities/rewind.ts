import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";

export type RewindPlayer = {
  steam_id: string;
  name: string;
  lineup: 1 | 2;
  cash: number;
  armor: number;
  helmet: boolean;
  alive: boolean;
  weapons: string[];
  kills: number;
  deaths: number;
};

export type RewindRound = {
  round: number;
  lineup_1_score: number;
  lineup_2_score: number;
  lineup_1_side: e_sides_enum;
  lineup_2_side: e_sides_enum;
  winning_side: e_sides_enum | null;
  winning_reason: e_winning_reasons_enum | null;
  has_backup: boolean;
  undone: boolean;
  kills: number;
  damage: number;
  players: RewindPlayer[];
};

export type RewindRounds = {
  map_name: string;
  live_round: number;
  finished?: boolean;
  halftime: number;
  regulation: number;
  connected_players: number;
  expected_players: number;
  disconnected: string[];
  rounds: RewindRound[];
  start_side?: e_sides_enum | null;
  swaps?: boolean;
  economy_hidden?: boolean;
};

export type VetoStepType = "Ban" | "Pick" | "Side" | "Decider";

export type VetoStep = {
  step: number;
  type: VetoStepType;
  lineup: 1 | 2 | null;
  map: string;
  side?: e_sides_enum;
};

export function scoreBefore(
  data: RewindRounds,
  round: number,
): [number, number] {
  const previous = data.rounds.find((row) => row.round === round - 1);
  return previous ? [previous.lineup_1_score, previous.lineup_2_score] : [0, 0];
}

export function playersAtStartOf(data: RewindRounds, round: number) {
  return data.rounds.find((row) => row.round === round - 1)?.players ?? [];
}

export function canRewindTo(data: RewindRounds, round: number) {
  const row = data.rounds.find((candidate) => candidate.round === round - 1);
  return !!row?.has_backup;
}

// The round a preview opens on: the one being played, or else the latest
// before it that still has a backup to start from.
export function defaultRestoreRound(data: RewindRounds) {
  for (let round = data.live_round; round >= 1; round--) {
    if (canRewindTo(data, round)) {
      return round;
    }
  }
  return null;
}

const OVERTIME_ROUNDS = 6;

const opposite = (side: e_sides_enum) =>
  side === e_sides_enum.CT ? e_sides_enum.TERRORIST : e_sides_enum.CT;

// The api's MatchRecoveryService.sideForRound: swap at halftime, then halfway
// through every overtime, each overtime starting on the side the last ended on.
function lineup1SideIn(start: e_sides_enum, round: number, mr: number) {
  const index = round - 1;
  if (mr <= 0) {
    return start;
  }
  if (index < mr * 2) {
    return index < mr ? start : opposite(start);
  }
  const overtimeRound = index - mr * 2;
  const odd = (Math.floor(overtimeRound / OVERTIME_ROUNDS) + 1) % 2 === 1;
  const firstHalf = overtimeRound % OVERTIME_ROUNDS < OVERTIME_ROUNDS / 2;
  return odd === firstHalf ? opposite(start) : start;
}

// The sides a round is played on: as recorded once it has been, as the
// swaps make them before that.
export function sidesIn(data: RewindRounds, round: number) {
  const recorded = data.rounds.find(
    (candidate) => candidate.round === round,
  )?.lineup_1_side;
  const start =
    data.start_side ??
    data.rounds.find((candidate) => candidate.round === 1)?.lineup_1_side ??
    e_sides_enum.TERRORIST;
  const lineup1 =
    recorded ??
    (data.swaps === false ? start : lineup1SideIn(start, round, data.halftime));
  return { lineup1, lineup2: opposite(lineup1) };
}

export type RewindSummary = {
  direction: "replay" | "back" | "forward";
  from: number;
  to: number;
  kills: number;
  damage: number;
};

// What a restore to `target` throws away (or, past the live round, brings
// back). The live round's own kills are only known while it is being played.
export function rewindSummary(
  data: RewindRounds,
  target: number,
  liveKills = 0,
  liveDamage = 0,
): RewindSummary {
  const live = data.live_round;
  const between = (from: number, to: number) =>
    data.rounds.filter((row) => row.round >= from && row.round <= to);
  const total = (rows: RewindRound[]) => ({
    kills: rows.reduce((sum, row) => sum + row.kills, 0),
    damage: rows.reduce((sum, row) => sum + row.damage, 0),
  });

  if (target === live) {
    return {
      direction: "replay",
      from: live,
      to: live,
      kills: liveKills,
      damage: liveDamage,
    };
  }
  if (target < live) {
    const undone = total(between(target, live - 1));
    return {
      direction: "back",
      from: target,
      to: live - 1,
      kills: undone.kills + liveKills,
      damage: undone.damage + liveDamage,
    };
  }
  const restored = total(between(live, target - 1));
  return { direction: "forward", from: live, to: target - 1, ...restored };
}

export type RestoreRoundsResponse = {
  map_name: string | null;
  restorable: boolean;
  blocked_reason: string | null;
  live_round: number | null;
  economy_hidden: boolean;
  connected_players: number;
  expected_players: number;
  disconnected: string[];
  rounds: Array<{
    round: number;
    lineup_1_score: number;
    lineup_2_score: number;
    lineup_1_side: string | null;
    lineup_2_side: string | null;
    winning_side: string | null;
    winning_reason: string | null;
    has_backup: boolean;
    undone: boolean;
    players: Array<Omit<RewindPlayer, "lineup"> & { lineup: number }>;
  }>;
};

// getMatchRestoreRounds as the Rounds tab draws it. Kills and damage per round
// aren't reported yet, so the undo tally stays off.
export function toRewindRounds(
  data: RestoreRoundsResponse,
  mr: number,
  sides: { start: string | null; swaps: boolean } = {
    start: null,
    swaps: true,
  },
): RewindRounds {
  const last = data.rounds.at(-1)?.round ?? 0;
  return {
    map_name: data.map_name ?? "",
    start_side: sides.start as e_sides_enum | null,
    swaps: sides.swaps,
    economy_hidden: data.economy_hidden,
    live_round: data.live_round ?? last + 1,
    finished: data.live_round === null,
    halftime: mr,
    regulation: mr * 2,
    connected_players: data.connected_players,
    expected_players: data.expected_players,
    disconnected: data.disconnected,
    rounds: data.rounds.map((row) => ({
      round: row.round,
      lineup_1_score: row.lineup_1_score,
      lineup_2_score: row.lineup_2_score,
      lineup_1_side: row.lineup_1_side as e_sides_enum,
      lineup_2_side: row.lineup_2_side as e_sides_enum,
      winning_side: row.winning_side as e_sides_enum | null,
      winning_reason: row.winning_reason as e_winning_reasons_enum | null,
      has_backup: row.has_backup,
      undone: row.undone,
      kills: 0,
      damage: 0,
      players: row.players.map((player) => ({
        ...player,
        lineup: player.lineup === 2 ? 2 : 1,
      })),
    })),
  };
}

// A map's rounds from the match page itself, for everyone who can't restore.
export function roundsFromMatchMap(
  matchMap: {
    map?: { name?: string | null } | null;
    status?: string | null;
    lineup_1_side?: string | null;
    rounds?: Array<Record<string, any>> | null;
  } | null,
  mr: number,
  inProgress: boolean,
  swaps = true,
): RewindRounds {
  const rows = (matchMap?.rounds ?? [])
    .filter((row) => row.round > 0 && row.winning_side)
    .sort((a, b) => a.round - b.round);
  const last = rows.at(-1)?.round ?? 0;
  return {
    map_name: matchMap?.map?.name ?? "",
    start_side: (matchMap?.lineup_1_side ?? null) as e_sides_enum | null,
    swaps,
    live_round: last + 1,
    finished: !inProgress,
    halftime: mr,
    regulation: mr * 2,
    connected_players: 0,
    expected_players: 0,
    disconnected: [],
    rounds: rows.map((row) => ({
      round: row.round,
      lineup_1_score: row.lineup_1_score ?? 0,
      lineup_2_score: row.lineup_2_score ?? 0,
      lineup_1_side: row.lineup_1_side,
      lineup_2_side: row.lineup_2_side,
      winning_side: row.winning_side,
      winning_reason: row.winning_reason,
      has_backup: false,
      undone: false,
      kills: 0,
      damage: 0,
      players: [],
    })),
  };
}

// The veto as the Fix the Veto window draws it: every step of the pattern,
// with the map and side of the ones already taken.
export function vetoTimelineSteps(
  steps: Array<{
    type: VetoStepType;
    lineup: 1 | 2 | null;
    record: {
      itemId: string;
      lineup: 1 | 2 | null;
      side?: string | null;
    } | null;
  }>,
  mapName: (mapId: string) => string,
): VetoStep[] {
  return steps.map((step, index) => ({
    step: index + 1,
    type: step.type,
    lineup: step.record?.lineup ?? step.lineup,
    map: step.record ? mapName(step.record.itemId) : "",
    side: (step.record?.side ?? undefined) as e_sides_enum | undefined,
  }));
}
