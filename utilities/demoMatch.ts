import {
  e_match_map_status_enum,
  e_match_status_enum,
  e_sides_enum,
  e_winning_reasons_enum,
} from "~/generated/zeus";
import type {
  RewindPlayer,
  RewindRound,
  RewindRounds,
  VetoStep,
  VetoStepType,
} from "~/utilities/rewind";
import { mapVetoOrder } from "~/utilities/vetoOrder";

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
    // The map down to its last round, which is being played.
    lastRound?: boolean;
  } = {},
): RewindRounds {
  const played = options.finished
    ? [...PLAYED, ...PLAYED_TO_THE_END]
    : options.lastRound
      ? [...PLAYED, ...PLAYED_TO_THE_END.slice(0, -1)]
      : PLAYED;
  const live =
    options.finished || options.lastRound
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

export type DemoStep = "veto" | "live" | "finished";

// The demo is shown as a match the api hands over, so the match page's own
// components draw it. Nothing here exists on the api: every id is made up.
export const DEMO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

export const DEMO_LINEUP_IDS: Record<1 | 2, string> = {
  1: "00000000-0000-0000-0000-000000000001",
  2: "00000000-0000-0000-0000-000000000002",
};

export const DEMO_VETO_CLOCK = 45;

export type DemoMap = {
  id: string;
  name: string;
  label: null;
  poster: string;
  patch: string;
};

export function demoMap(name: string): DemoMap {
  return {
    id: name,
    name,
    label: null,
    poster: `/img/maps/screenshots/${name}.webp`,
    patch: `/img/maps/icons/${name}.svg`,
  };
}

const POOL = DEMO_MAP_POOL.map(demoMap);

export const DEMO_VETO_ORDER = mapVetoOrder(3, POOL.length);

// A veto pick as the api hands it over.
export type DemoPick = {
  id: string;
  type: VetoStepType;
  side: e_sides_enum | null;
  auto_picked: boolean;
  match_lineup_id: string | null;
  map: DemoMap;
};

export function demoPick(
  type: VetoStepType,
  lineup: 1 | 2 | null,
  map: string,
  options: { side?: e_sides_enum | null; auto?: boolean } = {},
): DemoPick {
  return {
    id: `${type}-${map}`,
    type,
    side: options.side ?? null,
    auto_picked: options.auto ?? false,
    match_lineup_id: lineup ? DEMO_LINEUP_IDS[lineup] : null,
    map: demoMap(map),
  };
}

// The first `count` moves of the demo's veto.
export function demoPicks(count: number) {
  return DEMO_VETO.slice(0, count).map((step) =>
    demoPick(step.type, step.lineup, step.map, { side: step.side }),
  );
}

// The api closes the veto itself: with one map left, it is the decider.
export function withDecider(picks: DemoPick[]) {
  if (DEMO_VETO_ORDER[picks.length]?.type !== "Decider") {
    return picks;
  }
  const used = new Set(
    picks.filter((pick) => pick.type !== "Side").map((pick) => pick.map.id),
  );
  const decider = POOL.find((map) => !used.has(map.id));
  return decider ? [...picks, demoPick("Decider", null, decider.name)] : picks;
}

const otherSide = (side: e_sides_enum) =>
  side === e_sides_enum.CT ? e_sides_enum.TERRORIST : e_sides_enum.CT;

// Map rounds newest first, as the match subscription orders them.
function newestFirst(
  rows: Array<{
    round: number;
    lineup_1_side: e_sides_enum;
    lineup_2_side: e_sides_enum;
    winning_side: e_sides_enum | null;
    winning_reason: e_winning_reasons_enum | null;
  }>,
) {
  let score: [number, number] = [0, 0];
  return rows
    .map((row) => {
      score =
        row.winning_side === row.lineup_1_side
          ? [score[0] + 1, score[1]]
          : [score[0], score[1] + 1];
      return {
        round: row.round,
        lineup_1_side: row.lineup_1_side,
        lineup_2_side: row.lineup_2_side,
        winning_side: row.winning_side,
        winning_reason: row.winning_reason,
        lineup_1_score: score[0],
        lineup_2_score: score[1],
      };
    })
    .reverse();
}

function matchMap(
  order: number,
  pick: DemoPick,
  sides: { lineup_1_side: e_sides_enum; lineup_2_side: e_sides_enum },
  played: {
    status: e_match_map_status_enum;
    current?: boolean;
    rounds?: ReturnType<typeof newestFirst>;
  },
) {
  const rounds = played.rounds ?? [];
  const lineup1 = rounds[0]?.lineup_1_score ?? 0;
  const lineup2 = rounds[0]?.lineup_2_score ?? 0;
  return {
    id: `00000000-0000-0000-0001-00000000000${order}`,
    order,
    map: pick.map,
    status: played.status,
    is_current_map: !!played.current,
    lineup_1_score: lineup1,
    lineup_2_score: lineup2,
    ...sides,
    winning_lineup_id:
      played.status === e_match_map_status_enum.Finished
        ? DEMO_LINEUP_IDS[lineup1 > lineup2 ? 1 : 2]
        : null,
    vetos: [{ type: pick.type, match_lineup_id: pick.match_lineup_id }],
    rounds,
    demos: [],
  };
}

function lineup(slot: 1 | 2, picking: boolean) {
  return {
    id: DEMO_LINEUP_IDS[slot],
    name: DEMO_LINEUPS[slot].name,
    team_id: null,
    team: null,
    is_on_lineup: false,
    can_update_lineup: false,
    can_pick_map_veto: false,
    is_picking_map_veto: picking,
    lineup_players: NAMES[slot].map((name, index) => ({
      steam_id: `demo-${slot}-${index}`,
      captain: index === 0,
      player: { steam_id: `demo-${slot}-${index}`, name, avatar_url: null },
    })),
  };
}

// The match as its page sees it at one step of the demo. `rounds` is the map
// being played (or the last one played, once the match is over).
export function demoMatch(state: {
  step: DemoStep;
  paused?: boolean;
  picks: DemoPick[];
  deadline?: string | null;
  rounds: RewindRounds;
}) {
  const { step, picks } = state;
  const turn = step === "veto" ? DEMO_VETO_ORDER[picks.length] : null;
  const picking = turn && turn.type !== "Decider" ? turn.lineup : null;

  const sidesOf = (map: string) => {
    const side = picks.find(
      (pick) => pick.type === "Side" && pick.map.id === map,
    );
    if (!side?.side) {
      return {
        lineup_1_side: e_sides_enum.CT,
        lineup_2_side: e_sides_enum.TERRORIST,
      };
    }
    const chosen = side.side;
    return side.match_lineup_id === DEMO_LINEUP_IDS[1]
      ? { lineup_1_side: chosen, lineup_2_side: otherSide(chosen) }
      : { lineup_1_side: otherSide(chosen), lineup_2_side: chosen };
  };

  const played = picks.filter(
    (pick) => pick.type === "Pick" || pick.type === "Decider",
  );

  let matchMaps;
  if (step === "veto") {
    matchMaps = played.map((pick, index) =>
      matchMap(index + 1, pick, sidesOf(pick.map.id), {
        status: e_match_map_status_enum.Scheduled,
      }),
    );
  } else {
    const data = state.rounds;
    const current = data.rounds.filter(
      (row) => !row.undone && (data.finished || row.round < data.live_round),
    );
    const [mirage, ancient, dust2] = withDecider(demoPicks(8)).filter(
      (pick) => pick.type === "Pick" || pick.type === "Decider",
    );
    matchMaps = [
      matchMap(1, mirage, sidesOf("de_mirage"), {
        status: e_match_map_status_enum.Finished,
        rounds: newestFirst(demoMirageRounds()),
      }),
      matchMap(
        2,
        ancient,
        sidesFor(data.finished ? current.length : data.live_round),
        {
          status: data.finished
            ? e_match_map_status_enum.Finished
            : state.paused
              ? e_match_map_status_enum.Paused
              : e_match_map_status_enum.Live,
          current: step === "live",
          rounds: newestFirst(current),
        },
      ),
    ];
    if (step === "live") {
      matchMaps.push(
        matchMap(3, dust2, sidesOf("de_dust2"), {
          status: e_match_map_status_enum.Scheduled,
        }),
      );
    }
  }

  const status =
    step === "veto"
      ? e_match_status_enum.Veto
      : step === "live"
        ? e_match_status_enum.Live
        : e_match_status_enum.Finished;

  return {
    id: DEMO_MATCH_ID,
    source: "5stack",
    status,
    is_organizer: true,
    is_captain: false,
    is_in_lineup: false,
    is_server_online: step === "live",
    connection_string: step === "live" ? "connect 203.0.113.10:27015" : null,
    e_region: { description: "US East" },
    options: {
      type: "Competitive",
      best_of: 3,
      map_veto: true,
      region_veto: false,
      knife_round: false,
      coaches: false,
      tv_delay: 115,
      veto_pick_timeout: DEMO_VETO_CLOCK,
      map_pool: { maps: POOL },
    },
    min_players_per_lineup: 5,
    max_players_per_lineup: 5,
    lineup_1_id: DEMO_LINEUP_IDS[1],
    lineup_2_id: DEMO_LINEUP_IDS[2],
    lineup_1: lineup(1, picking === 1),
    lineup_2: lineup(2, picking === 2),
    map_veto_type: picking ? turn?.type : null,
    map_veto_picking_lineup_id: picking ? DEMO_LINEUP_IDS[picking] : null,
    veto_pick_expires_at: picking ? (state.deadline ?? null) : null,
    winning_lineup_id: step === "finished" ? DEMO_LINEUP_IDS[1] : null,
    match_maps: matchMaps,
  };
}

export type DemoMatch = ReturnType<typeof demoMatch>;
