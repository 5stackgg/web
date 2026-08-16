// The thread key, which has to match the server's chatThreadKey exactly -- see
// api/src/notifications/push/notification-delivery.ts.
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
