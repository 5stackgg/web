import {
  e_match_map_status_enum,
  e_match_status_enum,
  e_sides_enum,
} from "~/generated/zeus";
import {
  DEMO_MAP_POOL,
  DEMO_PLAYER_NAMES,
  demoMap,
  type DemoChatLine,
} from "~/utilities/demoMatch";
import { mapVetoOrder } from "~/utilities/vetoOrder";

// The FAQ's demo draft: a quick-hosted Captains draft from its first pick to
// its match, shown to the draft room and the match page the way the api hands
// them over. The match has the api's draft defaults: best of one, map veto, knife
// round, MR12, a 60 second veto clock, and one region (so no region veto).
// Nothing here exists on the api: every id is made up.
export const DEMO_DRAFT_ID = "00000000-0000-0000-0002-000000000000";
export const DEMO_DRAFT_MATCH_ID = "00000000-0000-0000-0003-000000000000";

const LINEUP_IDS: Record<1 | 2, string> = {
  1: "00000000-0000-0000-0003-000000000001",
  2: "00000000-0000-0000-0003-000000000002",
};

export type DemoDraftStep = "picks" | "check_in" | "veto" | "booting" | "ready";

export const DEMO_DRAFT_STEPS: DemoDraftStep[] = [
  "picks",
  "check_in",
  "veto",
  "booting",
  "ready",
];

const VETO_CLOCK_SECONDS = 60;

// The one region the draft was hosted for.
const REGION = { value: "US-East", description: "US East" };

const POOL = DEMO_MAP_POOL.map(demoMap);

// A best of one bans six maps in turn; the api closes the veto on the last
// one, in the same move as the sixth ban.
const ORDER = mapVetoOrder(1, POOL.length);
const BANS = [
  "de_vertigo",
  "de_anubis",
  "de_nuke",
  "de_inferno",
  "de_ancient",
  "de_dust2",
];
const DECIDER = "de_mirage";
export const DEMO_DRAFT_BANS = BANS.length;

// Who checks in last, so the demo can watch it happen.
const LAST_CHECK_IN = { lineup: 2 as const, slot: 2 };
// Everyone's check-in in turn, the seat a signed-in viewer takes first.
const CHECK_IN_ORDER: Array<[1 | 2, number]> = [
  [1, 3],
  [1, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [2, 3],
  [1, 2],
  [2, 4],
  [1, 4],
  [LAST_CHECK_IN.lineup, LAST_CHECK_IN.slot],
];
export const DEMO_DRAFT_PLAYERS = CHECK_IN_ORDER.length;
// The seat a signed-in viewer takes, so the demo shows them a player's view.
const VIEWER_SEAT = { lineup: 1 as const, slot: 3 };

export const DEMO_DRAFT_CHAT: DemoChatLine[] = [
  { name: DEMO_PLAYER_NAMES[1][0], lineup: 1, text: "glhf" },
  { name: DEMO_PLAYER_NAMES[2][0], lineup: 2, text: "gl, ban vertigo pls" },
  {
    name: DEMO_PLAYER_NAMES[LAST_CHECK_IN.lineup][LAST_CHECK_IN.slot],
    lineup: LAST_CHECK_IN.lineup,
    text: "checking in, one sec",
  },
];

export type DemoViewer = {
  steam_id: string;
  name: string;
  avatar_url?: string | null;
  custom_avatar_url?: string | null;
  country?: string | null;
} | null;

const ELO = [5640, 5310, 5175, 5090, 4985];

function player(lineup: 1 | 2, slot: number, viewer: DemoViewer) {
  if (viewer && lineup === VIEWER_SEAT.lineup && slot === VIEWER_SEAT.slot) {
    return {
      ...profile(`765611980000000${lineup}${slot}`, viewer.name, 0),
      steam_id: viewer.steam_id,
      avatar_url: viewer.avatar_url ?? null,
      custom_avatar_url: viewer.custom_avatar_url ?? null,
      country: viewer.country ?? null,
    };
  }
  return profile(
    `765611980000000${lineup}${slot}`,
    DEMO_PLAYER_NAMES[lineup][slot],
    ELO[slot] - (lineup === 2 ? 40 : 0),
  );
}

function profile(steamId: string, name: string, elo: number) {
  return {
    steam_id: steamId,
    name,
    role: "user",
    country: null,
    avatar_url: null,
    custom_avatar_url: null,
    roster_image_url: null,
    is_banned: false,
    is_gagged: false,
    is_muted: false,
    vac_banned: false,
    vac_ban_count: 0,
    game_ban_count: 0,
    days_since_last_ban: null,
    premier_rank: null,
    premier_rank_updated_at: null,
    faceit_skill_level: null,
    // get_player_elo's shape: a rating per match type.
    elo: elo ? { competitive: elo } : null,
  };
}

const SLOTS = [0, 1, 2, 3, 4];

// The seconds a captain has for each pick (the api's PICK_SECONDS).
const PICK_CLOCK_SECONDS = 30;

// A snake draft after the two top-rated players became captains: each
// captain's picks, in order.
const DRAFT_PICKS: Array<[1 | 2, number]> = [
  [1, 1],
  [2, 1],
  [2, 2],
  [1, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [1, 4],
];

export const DEMO_DRAFT_PICKS = DRAFT_PICKS.length;

// The room `picked` picks into the draft (the current pick's clock started at
// `turnAt`), or once every pick is in: making its match, then made.
export function demoDraftRoom(
  viewer: DemoViewer,
  startedAt: number,
  draft: { picked?: number; turnAt?: number; matchMade?: boolean } = {},
) {
  const created = new Date(startedAt - 6 * 60 * 1000).toISOString();
  const picked = draft.picked ?? DRAFT_PICKS.length;
  const drafting = picked < DRAFT_PICKS.length;
  const matchMade = !drafting && draft.matchMade !== false;
  const pickOf = (lineup: 1 | 2, slot: number) =>
    DRAFT_PICKS.slice(0, picked).findIndex(
      ([side, seat]) => side === lineup && seat === slot,
    );
  return {
    id: DEMO_DRAFT_ID,
    host_steam_id: player(1, 0, viewer).steam_id,
    is_organizer: false,
    status: drafting ? "Drafting" : matchMade ? "Completed" : "CreatingMatch",
    created_at: created,
    type: "Competitive",
    mode: "Captains",
    access: "Open",
    require_approval: false,
    regions: [REGION.value],
    capacity: 10,
    map_pool_id: "demo-pool",
    team_1_id: null,
    team_2_id: null,
    inner_squad: false,
    team_1: null,
    team_2: null,
    captain_selection: "TopEloTwo",
    draft_order: "Snake",
    min_elo: null,
    max_elo: null,
    match_id: matchMade ? DEMO_DRAFT_MATCH_ID : null,
    current_pick_lineup: drafting ? DRAFT_PICKS[picked][0] : null,
    pattern: DRAFT_PICKS.map(([lineup]) => lineup),
    pick_deadline: drafting
      ? new Date(
          (draft.turnAt ?? startedAt) + PICK_CLOCK_SECONDS * 1000,
        ).toISOString()
      : null,
    expires_at: null,
    host: player(1, 0, viewer),
    map_pool: { id: "demo-pool", type: "Competitive" },
    players: ([1, 2] as const).flatMap((lineup) =>
      SLOTS.map((slot) => {
        // Captains are not picked; everyone else sits in the pool until they
        // are, then takes their side's next pick.
        const sided = slot === 0 || pickOf(lineup, slot) >= 0;
        return {
          steam_id: player(lineup, slot, viewer).steam_id,
          status: "Accepted",
          joined_at: created,
          elo_snapshot: player(lineup, slot, viewer).elo?.competitive ?? null,
          is_captain: slot === 0,
          lineup: sided ? lineup : null,
          pick_order: slot && sided ? slot : null,
          player: player(lineup, slot, viewer),
        };
      }),
    ),
    options: {
      mr: 12,
      best_of: 1,
      overtime: true,
      knife_round: true,
      coaches: false,
      map_veto: true,
      number_of_substitutes: 0,
      game_mode: null,
      map_pool: { id: "demo-pool", type: "Competitive", maps: POOL },
    },
    picks: DRAFT_PICKS.slice(0, picked).map(([lineup, slot], index) => ({
      id: `demo-draft-pick-${index}`,
      lineup,
      auto_picked: false,
      created_at: created,
      captain: player(lineup, 0, viewer),
      picked: player(lineup, slot, viewer),
    })),
  };
}

function vetoPick(index: number) {
  const step = ORDER[index];
  const map = step.type === "Decider" ? DECIDER : BANS[index];
  return {
    id: `demo-draft-veto-${index}`,
    type: step.type,
    side: null,
    auto_picked: false,
    match_lineup_id: step.lineup ? LINEUP_IDS[step.lineup] : null,
    map: demoMap(map),
  };
}

// The veto's moves once `bans` maps are banned; the last ban closes it with
// the decider.
export function demoDraftPicks(bans: number) {
  const picks = Array.from({ length: bans }, (_, index) => vetoPick(index));
  return bans === BANS.length ? [...picks, vetoPick(BANS.length)] : picks;
}

// The match at one moment of the handoff: waiting on the last check-in, mid
// veto (`bans` landed, the current turn opened at `turnAt`), or after it with
// the server booting or ready.
export function demoDraftMatch(state: {
  step: DemoDraftStep;
  everyoneIn: boolean;
  // How many have checked in, in turn; unset, everyone but the last.
  checkIns?: number | null;
  bans: number;
  turnAt: number;
  // When the demo started, so its clocks don't move as it changes.
  startedAt: number;
  viewer: DemoViewer;
}) {
  const { step, viewer } = state;
  const vetoDone =
    step === "booting" || step === "ready" || state.bans === BANS.length;
  const status =
    step === "check_in"
      ? e_match_status_enum.WaitingForCheckIn
      : vetoDone
        ? e_match_status_enum.Live
        : e_match_status_enum.Veto;
  const ready = step === "ready";
  const turn = status === e_match_status_enum.Veto ? ORDER[state.bans] : null;
  const picking = turn?.lineup ?? null;
  const description: Record<string, string> = {
    [e_match_status_enum.WaitingForCheckIn]: "Waiting for Players to Check In",
    [e_match_status_enum.Veto]: "Veto",
    [e_match_status_enum.Live]: "Live",
  };

  const checkedIn = (lineup: 1 | 2, slot: number) => {
    if (step !== "check_in" || state.everyoneIn) {
      return true;
    }
    if (state.checkIns != null) {
      return (
        CHECK_IN_ORDER.findIndex(
          ([side, seat]) => side === lineup && seat === slot,
        ) < state.checkIns
      );
    }
    return lineup !== LAST_CHECK_IN.lineup || slot !== LAST_CHECK_IN.slot;
  };

  const lineup = (slot: 1 | 2) => ({
    id: LINEUP_IDS[slot],
    name: slot === 1 ? "Team 1" : "Team 2",
    team_id: null,
    team: null,
    coach: null,
    is_on_lineup: !!viewer && slot === VIEWER_SEAT.lineup,
    can_update_lineup: false,
    can_pick_map_veto: false,
    is_picking_map_veto: picking === slot,
    can_pick_region_veto: false,
    is_picking_region_veto: false,
    lineup_players: SLOTS.map((index) => {
      const member = player(slot, index, viewer);
      return {
        steam_id: member.steam_id,
        checked_in: checkedIn(slot, index),
        captain: index === 0,
        player: member,
      };
    }),
  });

  const decider = vetoPick(BANS.length);

  return {
    id: DEMO_DRAFT_MATCH_ID,
    source: "5stack",
    status,
    e_match_status: { description: description[status] },
    created_at: new Date(state.startedAt - 40 * 1000).toISOString(),
    cancels_at:
      step === "check_in"
        ? new Date(state.startedAt + 14 * 60 * 1000).toISOString()
        : null,
    region: REGION.value,
    e_region: { description: REGION.description },
    draft_games: [{ id: DEMO_DRAFT_ID }],
    is_captain: false,
    is_organizer: false,
    is_in_lineup: !!viewer,
    is_coach: false,
    can_cancel: false,
    can_start: false,
    can_check_in: !!viewer && step === "check_in",
    can_schedule: false,
    can_assign_server: false,
    can_stream_live: false,
    requested_organizer: false,
    server_id: vetoDone ? "demo-server" : null,
    server_type: vetoDone ? "On Demand" : null,
    server_error: null,
    is_server_online: ready,
    is_match_server_available: ready,
    connection_string: ready ? "connect 203.0.113.10:27015" : null,
    // Players get a link that launches the game; spectators only the string.
    // 203.0.113.0/24 is reserved for examples, so it reaches no server.
    connection_link:
      ready && viewer ? "steam://connect/203.0.113.10:27015" : null,
    tv_connection_string: null,
    min_players_per_lineup: 5,
    max_players_per_lineup: 5,
    lineup_1_id: LINEUP_IDS[1],
    lineup_2_id: LINEUP_IDS[2],
    winning_lineup_id: null,
    map_veto_type: turn?.type ?? null,
    map_veto_picking_lineup_id: picking ? LINEUP_IDS[picking] : null,
    region_veto_picking_lineup_id: null,
    veto_pick_expires_at: turn
      ? new Date(state.turnAt + VETO_CLOCK_SECONDS * 1000).toISOString()
      : null,
    region_veto_picks: [],
    options: {
      mr: 12,
      best_of: 1,
      overtime: true,
      knife_round: true,
      region_veto: false,
      map_veto: true,
      regions: [REGION.value],
      coaches: false,
      check_in_setting: "Players",
      veto_pick_timeout: VETO_CLOCK_SECONDS,
      camera_required: false,
      camera_allow_teammates: false,
      type: "Competitive",
      tv_delay: 115,
      map_pool: { id: "demo-pool", type: "Competitive", maps: POOL },
    },
    match_maps: vetoDone
      ? [
          {
            id: "00000000-0000-0000-0003-000000000101",
            order: 1,
            lineup_1_side: e_sides_enum.CT,
            lineup_2_side: e_sides_enum.TERRORIST,
            lineup_1_score: 0,
            lineup_2_score: 0,
            map: decider.map,
            status: ready
              ? e_match_map_status_enum.Warmup
              : e_match_map_status_enum.Scheduled,
            is_current_map: ready,
            winning_lineup_id: null,
            vetos: [{ type: decider.type, match_lineup_id: null }],
            rounds: [],
            demos: [],
          },
        ]
      : [],
    lineup_1: lineup(1),
    lineup_2: lineup(2),
    streams: [],
  };
}
