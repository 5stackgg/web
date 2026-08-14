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

  function ensureTab(
    roomId: string,
    peer: DirectMessagePeer,
    unread = 0,
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
      // Never steal focus. Someone messaging you must not yank you out of
      // whatever you were reading.
      activate: false,
    });

    if (unread > 0) {
      setUnread(directTabId(roomId), unread);
    }
  }

  // The server is the source of truth for which conversations exist and what is
  // unread in them -- useChatTabs keeps no storage of its own, so this doubles
  // as tab persistence across reloads.
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
          peer: DirectMessagePeer;
        }>;
      }>(
        `https://${useRuntimeConfig().public.apiDomain}/chat/direct/conversations`,
        { credentials: "include" },
      );

      for (const conversation of conversations) {
        ensureTab(conversation.roomId, conversation.peer, conversation.unread);
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
