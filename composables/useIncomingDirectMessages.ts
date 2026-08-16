import { watch } from "vue";
import socket from "~/web-sockets/Socket";
import {
  directTabId,
  peerSteamId,
  type DirectMessagePeer,
} from "~/composables/useDirectMessages";

// A conversation you haven't opened has no tab, so nothing is listening to its
// room -- which is exactly the case for a first message from someone. The
// server addresses the recipient directly with `direct:incoming` regardless of
// room membership, and this turns that into a background tab.
//
// Mounted once, from the default layout.
export function useIncomingDirectMessages() {
  const authStore = useAuthStore();
  const { openTab, closeTab, setUnread, tabs } = useChatTabs();
  const { topPosition } = useDirectConversationBar();

  function ensureTab(
    roomId: string,
    peer: DirectMessagePeer,
    unread = 0,
    position?: number,
  ) {
    openTab({
      id: directTabId(roomId),
      label: peer?.name ?? peer?.steam_id ?? roomId,
      instance: "direct",
      type: "direct",
      lobbyId: roomId,
      pinned: false,
      avatarUrl: peer?.avatar_url,
      steamId: peer?.steam_id ? String(peer.steam_id) : undefined,
      // A conversation the server has no place for yet goes above everything
      // the player has arranged, which is where the server will put it too.
      position: position ?? topPosition(),
      // Never steal focus. Someone messaging you must not yank you out of
      // whatever you were reading.
      activate: false,
    });

    if (unread > 0) {
      setUnread(directTabId(roomId), unread);
    }
  }


  // The server owns both what is unread and what is on the rail, so this is
  // the whole of it. Both used to be split -- unread from here, the open set
  // from localStorage -- which is why two devices showed different bars.
  //
  // Something unread but off the rail is still surfaced: a conversation only
  // leaves the bar by being removed or pushed off it, and either way a message
  // waiting in it is worth seeing.
  async function hydrate() {
    const steamId = authStore.me?.steam_id;

    if (!steamId) {
      return;
    }

    try {
      const { conversations } = await $fetch<{
        conversations: Array<{
          roomId: string;
          unread: number;
          isOpen: boolean;
          position: number;
          peer: DirectMessagePeer;
        }>;
      }>(
        `https://${useRuntimeConfig().public.apiDomain}/chat/direct/conversations`,
        { credentials: "include" },
      );

      for (const conversation of conversations) {
        if (!conversation.isOpen && conversation.unread <= 0) {
          continue;
        }

        ensureTab(
          conversation.roomId,
          conversation.peer,
          conversation.unread,
          conversation.position,
        );
      }
    } catch {
      // A conversation list that fails to load is not worth breaking the app
      // over; tabs appear as messages arrive instead.
    }
  }

  socket.listen(
    "direct:incoming",
    (data: { roomId: string; from: DirectMessagePeer }) => {
      const steamId = authStore.me?.steam_id;

      if (!steamId || !data?.roomId) {
        return;
      }

      // Deliberately does not inject the message: opening the tab makes
      // useChatTabSetup join the room, and the join's history snapshot delivers
      // it (deduped by chatMessageKey either way).
      ensureTab(data.roomId, {
        steam_id:
          data.from?.steam_id ?? peerSteamId(data.roomId, steamId) ?? "",
        name: data.from?.name,
        avatar_url: data.from?.avatar_url,
      });
    },
  );

  watch(
    () => authStore.me?.steam_id,
    (steamId) => {
      if (steamId) {
        void hydrate();
        return;
      }

      for (const tab of [...tabs.value]) {
        if (tab.type === "direct") {
          closeTab(tab.id);
        }
      }
    },
    { immediate: true },
  );
}
