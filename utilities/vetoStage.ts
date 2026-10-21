import { lineupSlot } from "~/utilities/vetoLineups";

// After the last pick the veto board stays up as the start stage while the
// match server boots: the maps to be played, each team's starting side. It
// gives way once the server is up (or a map has started).
export const STARTING_STATUSES = ["Live", "WaitingForServer", "CreatingMatch"];

// How long a draft room keeps its finished veto up once the match starts, so
// the last ban and the decider are seen before it hands over to the match page.
export const DRAFT_VETO_HOLD_MS = 4000;
const NOT_STARTED = ["Scheduled", "Warmup"];

export type VetoStartSide = "CT" | "T";

export type VetoStartMap = {
  itemId: string;
  decider: boolean;
  pickedBy: 1 | 2 | null;
  // Each lineup's starting side; null when a knife round settles it.
  sides: { 1: VetoStartSide; 2: VetoStartSide } | null;
};

export type VetoStart = {
  phase: "waiting" | "booting" | "ready";
  maps: VetoStartMap[];
};

// Every map of the series is set by the veto.
export function vetoMapsSet(match: any): boolean {
  const bestOf = match?.options?.best_of ?? 0;
  return (
    !!match?.options?.map_veto &&
    !!bestOf &&
    (match.match_maps ?? []).length >= bestOf
  );
}

export function vetoStarting(match: any): boolean {
  if (!vetoMapsSet(match)) return false;
  if (!STARTING_STATUSES.includes(match.status)) return false;
  // A dedicated server does not boot; offline is its own state.
  if (match.is_server_online || match.server_type === "Dedicated") return false;
  const first = [...match.match_maps].sort(
    (a: any, b: any) => a.order - b.order,
  )[0];
  return NOT_STARTED.includes(first?.status ?? "Scheduled");
}

// The map veto board is on the page: the veto itself, or the start stage
// after it.
export function vetoBoardUp(match: any): boolean {
  if (!match?.options?.map_veto) return false;
  return match.status === "Veto" || vetoStarting(match);
}

const side = (value: string | null | undefined): VetoStartSide =>
  value === "CT" ? "CT" : "T";

// The series in order of play, from the match's maps and the veto's picks.
export function vetoStartMaps(match: any, picks: any[]): VetoStartMap[] {
  return [...(match?.match_maps ?? [])]
    .sort((a: any, b: any) => a.order - b.order)
    .map((matchMap: any) => {
      const pick = picks.find(
        (entry: any) =>
          entry.map?.id === matchMap.map?.id &&
          (entry.type === "Pick" || entry.type === "Decider"),
      );
      const decider = pick?.type === "Decider";
      return {
        itemId: matchMap.map?.id,
        decider,
        pickedBy:
          pick?.type === "Pick"
            ? lineupSlot(match, pick.match_lineup_id)
            : null,
        sides:
          decider && match.options?.knife_round
            ? null
            : {
                1: side(matchMap.lineup_1_side),
                2: side(matchMap.lineup_2_side),
              },
      };
    });
}
