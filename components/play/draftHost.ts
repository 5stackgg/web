// Pure logic behind hosting from /play: the quick-host bar's choices and
// payload, the "re-host last" preset, and the intro's draft board.
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";
import { setupOptionsVariables } from "~/utilities/setupOptions";

export const DRAFT_REHOST_KEY = "draft-games:rehost";
export const DRAFT_INTRO_DISMISSED_KEY = "draft-games:intro-dismissed";

export type HostMode = "Captains" | "Host" | "Pug";
export type HostAccess = "Open" | "Friends" | "Invite";

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
  type === "Duel" ? ["Pug"] : ["Captains", "Host", "Pug"];

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

export function readRehostPreset(): any {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_REHOST_KEY) || "null");
  } catch {
    return null;
  }
}

// The create payload of the last room hosted on this device. Presets saved
// before the payload was stored only carry the form values.
export function rehostPayload(preset: any) {
  if (preset?.payload) {
    return preset.payload;
  }
  const values = preset?.values;
  if (!values) {
    return null;
  }
  return {
    type: values.type,
    mode: preset.mode,
    access: preset.access,
    regions: values.regions,
    map_pool_id: values.map_pool_id,
    captain_selection: preset.captain_selection,
    draft_order: preset.draft_order,
    require_approval: preset.require_approval,
    min_elo: preset.min_elo ?? undefined,
    max_elo: preset.max_elo ?? undefined,
    team_1_id: preset.mode === "Teams" ? preset.team_1_id : undefined,
    team_2_id: preset.mode === "Teams" ? preset.team_2_id : undefined,
    keep_lobby_together: false,
    options: setupOptionsVariables(values, { mapPoolId: values.map_pool_id }),
  };
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
