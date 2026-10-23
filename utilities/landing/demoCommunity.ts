import type { VoiceParticipant } from "~/composables/useVoiceApi";
import { DEMO_PLAYERS, type DemoPlayer } from "~/utilities/landing/demoStats";

// Seen from vexa's side: the party's chat and voice, and the friends list.

export const DEMO_VIEWER = DEMO_PLAYERS.vexa;

const MINUTE = 60 * 1000;

const { vexa, kuro, Pip, Moritz, deadlock, Saffron, tomek } = DEMO_PLAYERS;

const sender = ({ steam_id, name, role }: DemoPlayer) => ({
  steam_id,
  name,
  role,
});

export function demoChat(now = Date.now()) {
  const line = (
    id: number,
    from: DemoPlayer,
    minutesAgo: number,
    message: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id: `demo-chat-${id}`,
    message,
    timestamp: new Date(now - minutesAgo * MINUTE).toISOString(),
    from: sender(from),
    ...extra,
  });

  return [
    line(1, Pip, 14, "scrim vs Ironside at 9, who's in?"),
    line(2, kuro, 12, "in"),
    line(3, kuro, 12, "@vexa bring the new banana smokes", {
      mentions: [{ steam_id: vexa.steam_id, name: vexa.name }],
    }),
    line(4, vexa, 9, "already on the board. coffins + CT, both one jump", {
      reactions: { fire: [kuro.steam_id, Pip.steam_id, Moritz.steam_id] },
    }),
    line(5, Moritz, 3, "two rounds left here, queue without me"),
  ];
}

export const DEMO_VOICE: VoiceParticipant[] = [vexa, kuro, Pip].map(
  (player) => ({
    steamId: player.steam_id,
    name: player.name,
    avatarUrl: null,
    connected: true,
    speaking: player === kuro,
    coach: false,
    video: false,
  }),
);

// A row of my_friends, as the friends subscription selects it.
function friendRow(
  player: DemoPlayer,
  extra: {
    is_in_lobby?: boolean;
    live_lineup?: unknown[];
    last_presence_state?: unknown;
  } = {},
) {
  return {
    ...player,
    status: "Accepted",
    invited_by_steam_id: vexa.steam_id,
    last_presence_state: extra.last_presence_state ?? null,
    presence_updated_at: null,
    player: {
      steam_id: player.steam_id,
      is_registered: true,
      is_in_lobby: extra.is_in_lobby ?? false,
      is_in_another_match: !!extra.live_lineup,
      is_in_draft: false,
      live_lineup: extra.live_lineup ?? [],
      draft_game_players: [],
      lobby_players: [],
      hosted_practice_sessions: [],
    },
  };
}

function liveLineup(now: number) {
  const match = "00000000-0000-0000-0011-000000000000";
  const lineup1 = "00000000-0000-0000-0011-000000000001";
  const lineup2 = "00000000-0000-0000-0011-000000000002";

  return [
    {
      lineup: {
        id: lineup1,
        match: {
          id: match,
          status: "Live",
          started_at: new Date(now - 31 * MINUTE).toISOString(),
          lineup_1_id: lineup1,
          lineup_2_id: lineup2,
          options: { type: "Competitive", best_of: 1 },
          lineup_1: { id: lineup1, name: "Team Moritz" },
          lineup_2: { id: lineup2, name: "Team brisk" },
          streams: [],
          match_maps: [
            {
              id: "00000000-0000-0000-0011-000000000003",
              order: 1,
              status: "Live",
              is_current_map: true,
              map: { name: "de_inferno", label: null },
              lineup_1_score: 11,
              lineup_2_score: 8,
              winning_lineup_id: null,
            },
          ],
        },
      },
    },
  ];
}

// One of each: in a match, in your party, in CS2 elsewhere, online, offline.
export function demoFriends(now = Date.now()) {
  return [
    { row: friendRow(Moritz, { live_lineup: liveLineup(now) }), online: true },
    { row: friendRow(kuro, { is_in_lobby: true }), online: true },
    {
      row: friendRow(deadlock, {
        last_presence_state: {
          inCs2: true,
          inGame: true,
          mode: "premier",
          map: "Ancient",
          score: "7:5",
        },
      }),
      online: false,
    },
    { row: friendRow(Saffron), online: true },
    { row: friendRow(tomek), online: false, muted: true },
  ];
}
