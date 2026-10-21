export type DraftHeaderPhase =
  "lobby" | "between" | "draft" | "checkin" | "veto" | "starting";

export type DraftHeaderTone = "amber" | "muted" | "success";

export type DraftHeaderPlayer = {
  steamId: string;
  name: string;
  src: string | null;
};

export type DraftHeaderSide = {
  name: string;
  crest: string | null;
  monogram: string;
  players: DraftHeaderPlayer[];
  seats: number;
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
  | { kind: "count"; value: number; of: number; caption: string }
  | { kind: "map"; label: string; patch: string | null; caption: string }
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
