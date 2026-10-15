// Thread keys, which have to match the server's chatThreadKey and threadKeyFor
// exactly -- see api/src/notifications/push/notification-delivery.ts.
//
// The same string is the read cursor, the device's notification tag and what a
// visible tab reports as focused. A mismatch does not fail loudly; it just
// quietly stops suppressing notifications for a conversation that is open on
// screen, which is the hardest kind of bug to notice.
//
// Deliberately a leaf with no imports: the socket, the presence reporter and
// the read-state store all need it, and any of them owning it would close an
// import cycle.
export function chatThreadKey(type: string, lobbyId: string) {
  return `chat:${type}:${lobbyId}`;
}

export function notificationThreadKey(
  type: string,
  entityId: string | null | undefined,
) {
  return `${type}:${entityId ?? ""}`;
}

// The thread a player's mute and "notify me about" for a room are kept under.
// A side's team room is shown inside its match room, whose setting covers it;
// the api's roomSettingsThreadFor agrees.
export function chatRoomSettingsThread(type: string, lobbyId: string) {
  if (type === "match_team") {
    return chatThreadKey("match", lobbyId.split(":")[0]);
  }

  return chatThreadKey(type, lobbyId);
}
