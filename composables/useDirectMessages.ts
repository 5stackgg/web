import { setActiveHub } from "~/composables/useHubState";

// Everything about identifying a direct-message room lives here, and every call
// site derives ids through it.
//
// A DM room is identified by its two participants rather than by a stored row:
// sort the steam ids ascending, join with ":". Both sides compute the identical
// id from nothing but the pair.
//
// The tab id then follows the convention every other tab uses,
// `<type>:<lobbyId>` -- which matters, because the participants map and the
// server's room key are both built from `${type}:${lobbyId}`. Getting this
// wrong is silent: the socket joins a room nobody publishes to.

export type DirectMessagePeer = {
  steam_id: string;
  name?: string;
  avatar_url?: string;
};

export function directRoomId(
  a: string | number,
  b: string | number,
): string {
  // Sorted as BigInt, not as strings. Steam ids are all 17 digits today so a
  // string sort agrees by accident, and stops agreeing the moment one isn't.
  return [BigInt(a), BigInt(b)]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .join(":");
}

export function directTabId(roomId: string): string {
  return `direct:${roomId}`;
}

export function peerSteamId(roomId: string, mySteamId: string): string | null {
  const parties = roomId.split(":");

  if (parties.length !== 2) {
    return null;
  }

  return parties.find((party) => party !== String(mySteamId)) ?? null;
}

export function useDirectMessages() {
  const { openTab, setActiveTab } = useChatTabs();
  const { relationship } = useFriendActions();
  const authStore = useAuthStore();
  const { setRightSidebarOpen } = useRightSidebar();

  // Accepted friends only -- a pending request in either direction is not a
  // friendship, and the server enforces the same rule.
  function canMessage(steamId: string | number | undefined | null): boolean {
    if (!steamId || !authStore.me?.steam_id) {
      return false;
    }

    if (String(steamId) === String(authStore.me.steam_id)) {
      return false;
    }

    return relationship(steamId) === "friend";
  }

  function openConversation(
    peer: DirectMessagePeer,
    { activate = true } = {},
  ) {
    const mySteamId = authStore.me?.steam_id;

    if (!mySteamId || !peer?.steam_id) {
      return;
    }

    const roomId = directRoomId(mySteamId, peer.steam_id);
    const tabId = directTabId(roomId);

    openTab({
      id: tabId,
      label: peer.name ?? peer.steam_id,
      instance: "direct",
      type: "direct",
      lobbyId: roomId,
      pinned: false,
      avatarUrl: peer.avatar_url,
      steamId: String(peer.steam_id),
      activate,
    });

    if (activate) {
      setActiveTab(tabId);
      // setActiveHub, not selectHub: selectHub toggles the sidebar shut when
      // chat is already the active hub, which would close the conversation the
      // click just asked to open.
      setActiveHub("chat");
      setRightSidebarOpen(true);
    }
  }

  return {
    canMessage,
    openConversation,
  };
}
