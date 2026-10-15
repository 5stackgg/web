// The order of a veto, so the board can show every step before it happens.
// A port of the api's get_map_veto_pattern + get_map_veto_picking_lineup_id
// and get_region_veto_picking_lineup_id. It is display only: the api still
// decides whose turn it is (map_veto_picking_lineup_id) and what the step is
// (map_veto_type). Change these together with those functions.

export type VetoStepType = "Ban" | "Pick" | "Side" | "Decider";

export type VetoOrderStep = {
  type: VetoStepType;
  // 1 = lineup_1, 2 = lineup_2, null = nobody (the decider closes itself).
  lineup: 1 | 2 | null;
};

// What VetoBoard draws: the pool, every step with what happened on it so far,
// and the two lineups.
export type VetoBoardItem = {
  id: string;
  label: string;
  poster?: string | null;
  patch?: string | null;
  ping?: number | null;
  serverStatus?: string | null;
};

export type VetoBoardRecord = {
  itemId: string;
  lineup: 1 | 2 | null;
  side?: string | null;
  auto?: boolean;
};

export type VetoBoardStep = VetoOrderStep & {
  record: VetoBoardRecord | null;
};

export type VetoBoardLineup = {
  name: string;
  crest: string | null;
  monogram: string;
};

export function mapVetoPattern(
  bestOf: number,
  poolSize: number,
): VetoStepType[] {
  if (!bestOf || bestOf > poolSize) {
    return [];
  }

  const unit: VetoStepType[] = ["Ban", "Ban", "Pick", "Pick"];
  const picksNeeded = bestOf - 1;
  const pattern: VetoStepType[] = [];
  let unitIndex = 0;
  let picksMade = 0;

  for (let i = 1; i <= poolSize - 1; i++) {
    const stepsLeft = poolSize - i;
    let type: VetoStepType;
    if (picksMade === picksNeeded) {
      type = "Ban";
    } else if (stepsLeft === picksNeeded - picksMade) {
      type = "Pick";
    } else {
      type = unit[unitIndex++ % 4];
    }

    if (type === "Pick") {
      picksMade++;
      // Every pick is answered by the other team choosing a side.
      pattern.push("Pick", "Side");
    } else {
      pattern.push("Ban");
    }
  }

  pattern.push("Decider");
  return pattern;
}

export function mapVetoOrder(
  bestOf: number,
  poolSize: number,
): VetoOrderStep[] {
  let turn = 0;
  let picksMade = 0;
  let lastPick: 1 | 2 | null = null;

  return mapVetoPattern(bestOf, poolSize).map((type) => {
    if (type === "Side") {
      return { type, lineup: lastPick === 1 ? 2 : 1 };
    }
    if (type === "Decider") {
      return { type, lineup: null };
    }

    // Turns alternate, and every completed pair of picks reverses who leads,
    // so the picks snake: lineup 1, lineup 2, lineup 2, lineup 1.
    const reverse = Math.floor(picksMade / 2) % 2 === 1;
    const lineup: 1 | 2 = reverse
      ? turn % 2 === 0
        ? 2
        : 1
      : turn % 2 === 0
        ? 1
        : 2;
    turn++;
    if (type === "Pick") {
      picksMade++;
      lastPick = lineup;
    }
    return { type, lineup };
  });
}

// Lineups alternate bans, lineup 1 first, until one region is left.
export function regionVetoOrder(regionCount: number): VetoOrderStep[] {
  if (regionCount < 2) {
    return [];
  }

  const steps: VetoOrderStep[] = [];
  for (let i = 0; i < regionCount - 1; i++) {
    steps.push({ type: "Ban", lineup: i % 2 === 0 ? 1 : 2 });
  }
  steps.push({ type: "Decider", lineup: null });
  return steps;
}
