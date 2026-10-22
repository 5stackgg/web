export type DraftHeaderPhase =
  "lobby" | "between" | "draft" | "checkin" | "veto" | "starting";

export type DraftHeaderTone = "amber" | "muted" | "success";

export type DraftHeaderPlayer = {
  steamId: string;
  name: string;
  src: string | null;
};

// One seat of a side's avatar stack. In a captains draft the stack is the
// pick order: the captain, then each pick the side makes, made or still to
// come; elsewhere it is the side's players and its open seats.
export type DraftHeaderSeat = {
  key: string;
  player: DraftHeaderPlayer | null;
  captain: boolean;
  // The pick this seat is, in the whole draft.
  no: number | null;
  // The seat the captain on the clock is filling.
  current: boolean;
  auto: boolean;
  mine: boolean;
};

export type DraftHeaderSide = {
  name: string;
  crest: string | null;
  monogram: string;
  seats: DraftHeaderSeat[];
  // A captains draft: the stack carries the pick order and opens to list it.
  ordered: boolean;
  captainName: string;
  mine: boolean;
};

export type DraftHeaderBox =
  | {
      kind: "clock";
      deadline: string | null;
      total: number;
      side: 1 | 2 | null;
      caption: string;
    }
  | { kind: "map"; label: string; patch: string | null; caption: string }
  // The room's own check-in box fills it edge to edge.
  | { kind: "checkin" }
  | { kind: "vs" };

export type DraftHeaderState = {
  phase: DraftHeaderPhase;
  tone: DraftHeaderTone;
  hot: boolean;
  title: string;
  detail: string;
  box: DraftHeaderBox;
  onClock: 1 | 2 | null;
};

// What the room's match plays with. A quick-hosted room has no options row
// until its first edit; the api then starts the match on its own defaults
// (DraftMatchService.createMatch), so those are what the room shows rather
// than reading the missing row as everything off.
export function draftRoomOptions(room: any, match?: any) {
  const mr = room.type === "Competitive" ? 12 : 8;
  const options = match?.options ?? room.options;
  if (options) {
    return { ...options, mr: options.mr ?? mr };
  }
  return {
    mr,
    best_of: 1,
    overtime: true,
    knife_round: true,
    map_veto: true,
    coaches: false,
    game_mode: null,
    map_pool: room.map_pool ?? null,
  };
}

export const clockLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
