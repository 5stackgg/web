// Pure logic behind hosting from /play: the Host a room button's remembered
// choices and payload, and the intro's draft board.
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";

export const DRAFT_REHOST_KEY = "draft-games:rehost";
export const DRAFT_INTRO_DISMISSED_KEY = "draft-games:intro-dismissed";

export type HostMode = "Captains" | "Host" | "Pug";
export type HostAccess = "Open" | "Friends" | "Invite";

export const HOST_MODES: HostMode[] = ["Captains", "Host", "Pug"];
export const HOST_ACCESS: HostAccess[] = ["Open", "Friends", "Invite"];

// Biggest format first, the same order as the room list's format filter.
export const HOST_TYPES = (
  Object.entries(EXPECTED_PLAYERS) as Array<[string, number]>
)
  .sort((a, b) => b[1] - a[1])
  .map(([type, players]) => ({ type, perSide: players / 2 }));

export function formatLabel(type: string | undefined): string {
  const players = EXPECTED_PLAYERS[type as keyof typeof EXPECTED_PLAYERS];
  return players ? `${players / 2}v${players / 2}` : "";
}

// A duel has nobody to draft: it is always auto-split.
export const hostModes = (type: string): HostMode[] =>
  type === "Duel" ? ["Pug"] : HOST_MODES;

// No match options on purpose: the api then spawns the match on the same
// defaults matchmaking uses for the type. Anything else is "All settings".
export function quickHostPayload(settings: {
  type: string;
  mode: HostMode;
  access: HostAccess;
  regions: string[];
}) {
  return {
    ...settings,
    captain_selection: "TopEloTwo",
    draft_order: "Snake",
    require_approval: false,
    keep_lobby_together: false,
  };
}

export type HostChoices = {
  type: string;
  mode: HostMode;
  access: HostAccess;
};

export function readRehostPreset(): any {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_REHOST_KEY) || "null");
  } catch {
    return null;
  }
}

// The choices of the last room hosted on this device. The full wizard saves
// under the same key, so a choice the Host button can't make (pre-made
// teams, private) falls back to the default.
export function hostChoices(preset: any): HostChoices {
  const type = preset?.payload?.type ?? preset?.values?.type;
  return {
    type: HOST_TYPES.some((option) => option.type === type)
      ? type
      : HOST_TYPES[0].type,
    mode: HOST_MODES.includes(preset?.mode) ? preset.mode : "Captains",
    access: HOST_ACCESS.includes(preset?.access) ? preset.access : "Open",
  };
}

export function rememberHostChoices(choices: HostChoices, regions: string[]) {
  try {
    localStorage.setItem(
      DRAFT_REHOST_KEY,
      JSON.stringify({
        mode: choices.mode,
        access: choices.access,
        payload: quickHostPayload({ ...choices, regions }),
      }),
    );
  } catch {}
}

export type BoardSlot = {
  pick: number;
  state: "picked" | "picking" | "open";
};

// A captains draft part-way through, for the intro: two captains picking in
// snake order (1-2-2-1…), the first `picked` picks made.
export function snakeBoard(perSide: number, picked = 3) {
  const picks = (perSide - 1) * 2;
  const done = Math.min(picked, picks - 1);
  const teams: [BoardSlot[], BoardSlot[]] = [[], []];
  for (let index = 0; index < picks; index++) {
    // Each round of two reverses who picks first.
    const side = Math.floor(index / 2) % 2 === index % 2 ? 0 : 1;
    teams[side].push({
      pick: index + 1,
      state: index < done ? "picked" : index === done ? "picking" : "open",
    });
  }
  return { teams, pool: picks - done };
}
