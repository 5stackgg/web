type MatchLike = {
  id?: string;
  status?: string;
  is_in_lineup?: boolean;
};

type LobbyPresence = {
  inGame?: boolean;
};

const LIVE_MATCH_STATUS = "Live";

export function shouldAutoMuteChatSound(
  steamId: string | null | undefined,
  myMatches: MatchLike[],
  lobbyChat: Record<string, Map<string, LobbyPresence> | undefined>,
) {
  if (!steamId) {
    return false;
  }

  const normalizedSteamId = String(steamId);

  return myMatches.some((match) => {
    if (
      !match?.id ||
      !match.is_in_lineup ||
      match.status !== LIVE_MATCH_STATUS
    ) {
      return false;
    }

    return (
      lobbyChat[`match:${match.id}`]?.get(normalizedSteamId)?.inGame === true
    );
  });
}
