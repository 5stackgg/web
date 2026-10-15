import type { ChatTab } from "~/composables/useChatTabs";

// A team the signed-in player reads the room of: one of `me.teams`, which is
// the api's rule exactly -- the roster (an invite once accepted) and the owner.
// `role` is the player's own role on that roster.
export interface ChatTeam {
  id: string;
  name?: string | null;
  short_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  owner_steam_id?: string | number | null;
}

export function teamChatTabId(teamId: string) {
  return `team:${teamId}`;
}

// Pinned like a tournament's room: it is there for as long as the player is
// on the team, and leaves with them.
export function teamChatTab(team: Pick<ChatTeam, "id" | "name">): ChatTab {
  return {
    id: teamChatTabId(team.id),
    label: team.name ?? "",
    instance: "team",
    type: "team",
    lobbyId: team.id,
    pinned: true,
  };
}

export function chatTeam(
  teams: ChatTeam[] | null | undefined,
  teamId: string | null | undefined,
): ChatTeam | null {
  if (!teamId) {
    return null;
  }

  return (teams ?? []).find(({ id }) => String(id) === String(teamId)) ?? null;
}

// Mirrors the api's ChatService.deleteRefusal for a team's room: its admins
// and its owner remove anyone's line there. A site role counts for nothing.
export function canModerateTeamChat(
  team: ChatTeam | null | undefined,
  steamId: string | number | null | undefined,
) {
  if (!team || steamId == null) {
    return false;
  }

  return (
    team.role === "Admin" || String(team.owner_steam_id) === String(steamId)
  );
}
