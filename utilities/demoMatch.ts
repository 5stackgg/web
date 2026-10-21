import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";
import type {
  RewindPlayer,
  RewindRound,
  RewindRounds,
  VetoStep,
} from "~/utilities/rewind";

export type DemoLineup = { id: 1 | 2; name: string; tag: string };

export const DEMO_LINEUPS: Record<1 | 2, DemoLineup> = {
  1: { id: 1, name: "Kestrel", tag: "K" },
  2: { id: 2, name: "Ironside", tag: "I" },
};

export const DEMO_DISCONNECTED = "tomek";

const NAMES: Record<1 | 2, string[]> = {
  1: ["vexa", "Moritz", "kuro", "deadlock", "Pip"],
  2: ["Saffron", DEMO_DISCONNECTED, "Juno", "brisk", "OLLIE"],
};

type Played = [winner: 1 | 2, reason: e_winning_reasons_enum];

const B = e_winning_reasons_enum.BombExploded;
const D = e_winning_reasons_enum.BombDefused;
const T = e_winning_reasons_enum.TimeRanOut;
const CT_WIN = e_winning_reasons_enum.CTsWin;
const T_WIN = e_winning_reasons_enum.TerroristsWin;

const PLAYED: Played[] = [
  [1, B],
  [1, T_WIN],
  [2, CT_WIN],
  [2, D],
  [1, B],
  [1, T_WIN],
  [2, T],
  [1, T_WIN],
  [2, CT_WIN],
  [1, B],
  [2, D],
  [1, T_WIN],
  [2, B],
  [1, CT_WIN],
  [2, T_WIN],
  [1, D],
];

const PLAYED_TO_THE_END: Played[] = [
  [2, B],
  [1, D],
  [1, CT_WIN],
  [2, T_WIN],
  [1, T],
  [2, B],
  [1, CT_WIN],
];

const KILLS = [
  7, 8, 6, 7, 9, 8, 5, 9, 7, 8, 6, 9, 8, 7, 9, 9, 8, 7, 9, 8, 6, 9, 8,
];
const DAMAGE = [
  880, 1010, 760, 905, 1150, 990, 640, 1120, 870, 1005, 790, 1145, 1020, 905,
  1130, 1132, 1040, 915, 1110, 1005, 760, 1150, 1020,
];

export const DEMO_LIVE_ROUND = PLAYED.length + 1;
export const DEMO_LIVE_ROUND_KILLS = 3;
export const DEMO_LIVE_ROUND_DAMAGE = 380;
const HALFTIME = 12;

function sidesFor(round: number) {
  const firstHalf = round <= HALFTIME;
  return {
    lineup_1_side: firstHalf ? e_sides_enum.TERRORIST : e_sides_enum.CT,
    lineup_2_side: firstHalf ? e_sides_enum.CT : e_sides_enum.TERRORIST,
  };
}

const RIFLES: Record<string, string[]> = {
  [e_sides_enum.CT]: ["m4a1_silencer", "m4a1", "famas", "m4a1", "aug"],
  [e_sides_enum.TERRORIST]: ["ak47", "galilar", "ak47", "ak47", "sg556"],
};

function loadout(side: e_sides_enum, slot: number, cash: number) {
  const pistol = side === e_sides_enum.CT ? "usp_silencer" : "glock";
  if (cash < 1500) {
    return [pistol];
  }
  if (slot === 1) {
    return ["awp", "deagle"];
  }
  return [RIFLES[side][slot], pistol];
}

function seeded(round: number, slot: number, lineup: number) {
  return (round * 1373 + slot * 911 + lineup * 577) % 97;
}

// The state a backup holds: everyone as they were when the round after it
// started, so row N is the start of round N + 1.
function snapshotAfter(round: number): RewindPlayer[] {
  const next = round + 1;
  const sides = sidesFor(next);
  return ([1, 2] as const).flatMap((lineup) =>
    NAMES[lineup].map((name, slot) => {
      const side = lineup === 1 ? sides.lineup_1_side : sides.lineup_2_side;
      const roll = seeded(round, slot, lineup);
      const pistolRound = next === 1 || next === HALFTIME + 1;
      const cash = pistolRound ? 800 : 1100 + (roll % 52) * 100;
      const survived = roll % 3 !== 0;
      const kills = Math.round(((10 + slot * 2 + lineup) * round) / 16);
      const deaths = Math.round(((9 + ((slot + lineup) % 4)) * round) / 16);
      return {
        steam_id: `demo-${lineup}-${slot}`,
        name,
        lineup,
        cash,
        armor: pistolRound || !survived ? 0 : 100,
        helmet: !pistolRound && survived && slot % 2 === 0,
        alive: survived,
        weapons: pistolRound
          ? [side === e_sides_enum.CT ? "usp_silencer" : "glock"]
          : survived
            ? loadout(side, slot, cash + 3000)
            : [],
        kills,
        deaths,
      };
    }),
  );
}

export function demoRewindRounds(
  options: {
    live?: number;
    undoneFrom?: number | null;
    connected?: boolean;
    finished?: boolean;
  } = {},
): RewindRounds {
  const played = options.finished ? [...PLAYED, ...PLAYED_TO_THE_END] : PLAYED;
  const live = options.finished
    ? played.length + 1
    : (options.live ?? DEMO_LIVE_ROUND);
  const undoneFrom = options.undoneFrom ?? null;
  let score: [number, number] = [0, 0];
  const rounds: RewindRound[] = played.map(([winner, reason], index) => {
    const round = index + 1;
    score = winner === 1 ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
    const sides = sidesFor(round);
    return {
      round,
      lineup_1_score: score[0],
      lineup_2_score: score[1],
      ...sides,
      winning_side: winner === 1 ? sides.lineup_1_side : sides.lineup_2_side,
      winning_reason: reason,
      has_backup: true,
      undone: undoneFrom !== null && round >= undoneFrom,
      kills: KILLS[index],
      damage: DAMAGE[index],
      players: snapshotAfter(round),
    };
  });

  return {
    map_name: "de_ancient",
    live_round: live,
    finished: options.finished ?? false,
    halftime: HALFTIME,
    regulation: HALFTIME * 2,
    connected_players: options.connected === false ? 9 : 10,
    expected_players: 10,
    disconnected: options.connected === false ? [DEMO_DISCONNECTED] : [],
    rounds,
  };
}

export const DEMO_VETO: VetoStep[] = [
  { step: 1, type: "Ban", lineup: 1, map: "de_nuke" },
  { step: 2, type: "Ban", lineup: 2, map: "de_vertigo" },
  { step: 3, type: "Pick", lineup: 1, map: "de_mirage" },
  { step: 4, type: "Side", lineup: 2, map: "de_mirage", side: e_sides_enum.CT },
  { step: 5, type: "Pick", lineup: 2, map: "de_ancient" },
  {
    step: 6,
    type: "Side",
    lineup: 1,
    map: "de_ancient",
    side: e_sides_enum.TERRORIST,
  },
  { step: 7, type: "Ban", lineup: 2, map: "de_anubis" },
  { step: 8, type: "Ban", lineup: 1, map: "de_inferno" },
  { step: 9, type: "Decider", lineup: null, map: "de_dust2" },
];

export const DEMO_MAP_POOL = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_vertigo",
];

export const DEMO_PLAYER_NAMES = NAMES;

const MIRAGE: Played[] = [
  [1, B],
  [1, T_WIN],
  [2, CT_WIN],
  [1, B],
  [1, T_WIN],
  [2, D],
  [1, T_WIN],
  [2, T],
  [1, B],
  [1, T_WIN],
  [2, CT_WIN],
  [1, B],
  [2, B],
  [1, CT_WIN],
  [2, T_WIN],
  [1, D],
  [2, B],
  [1, CT_WIN],
  [2, T_WIN],
  [1, T],
  [2, B],
  [1, CT_WIN],
];

export function demoMirageRounds() {
  return MIRAGE.map(([winner, reason], index) => {
    const sides = sidesFor(index + 1);
    return {
      round: index + 1,
      ...sides,
      winning_side: winner === 1 ? sides.lineup_1_side : sides.lineup_2_side,
      winning_reason: reason,
    };
  });
}

export type DemoChatLine = { name: string; lineup: 1 | 2; text: string };

export const DEMO_CHAT: Record<"veto" | "live" | "finished", DemoChatLine[]> = {
  veto: [
    { name: "Moritz", lineup: 1, text: "wait we clicked mirage by mistake" },
    {
      name: "vexa",
      lineup: 1,
      text: "we wanted inferno, can an admin undo it?",
    },
  ],
  live: [
    { name: "tomek", lineup: 2, text: "game crashed, reconnecting" },
    {
      name: "Saffron",
      lineup: 2,
      text: "we lost that round 4v5 because of it",
    },
    { name: "Saffron", lineup: 2, text: "admin can we replay round 16?" },
  ],
  finished: [
    { name: "brisk", lineup: 2, text: "gg" },
    { name: "vexa", lineup: 1, text: "gg wp" },
  ],
};

export type DemoMapSlot = {
  map: string;
  pickedBy: 1 | 2 | null;
  status: "Scheduled" | "Live" | "Paused" | "Finished";
  score?: [number, number];
  rounds?: Array<Record<string, unknown>>;
  current?: boolean;
};
