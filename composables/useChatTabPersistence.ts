import { ref, watch } from "vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { directTabId } from "~/composables/useDirectMessages";

// Channels rebuild themselves from server state on every load -- conversations
// do not. There is no "my open DMs" list on the server, and deliberately so:
// closing a conversation is a local preference, not something the other party
// should be told about. So the open set, and the room you were last reading,
// live in localStorage scoped per account.

type StoredDirect = {
  roomId: string;
  label: string;
  avatarUrl?: string;
  steamId?: string;
};

type StoredChatTabs = {
  direct: StoredDirect[];
  activeTabId: string | null;
};

const EMPTY: StoredChatTabs = { direct: [], activeTabId: null };

function storageKey(steamId: string | number) {
  return `5stack:chat-tabs:${steamId}`;
}

export function readStoredChatTabs(
  steamId: string | number | undefined | null,
): StoredChatTabs {
  if (!import.meta.client || !steamId) {
    return EMPTY;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(steamId));

    if (!raw) {
      return EMPTY;
    }

    const parsed = JSON.parse(raw);

    return {
      direct: Array.isArray(parsed?.direct)
        ? parsed.direct.filter(
            (entry: any) => typeof entry?.roomId === "string",
          )
        : [],
      activeTabId:
        typeof parsed?.activeTabId === "string" ? parsed.activeTabId : null,
    };
  } catch {
    return EMPTY;
  }
}

function writeStoredChatTabs(steamId: string | number, state: StoredChatTabs) {
  if (!import.meta.client) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(steamId), JSON.stringify(state));
  } catch {
    // A blocked or full localStorage costs the user their tab layout on the
    // next reload and nothing else.
  }
}

// The room to reselect once it exists. Channel tabs are opened by
// subscriptions that resolve well after login, so this stays pending until its
// tab shows up rather than being applied against an empty list.
const pendingActiveId = ref<string | null>(null);

// The stored room may never come back -- a match that ended, a tournament that
// closed. Picking a room by hand is the user saying they are done waiting for
// it, so the restore is abandoned and their choice starts being recorded.
export function cancelChatTabRestore() {
  pendingActiveId.value = null;
}

// Mounted once, from the default layout, before useIncomingDirectMessages so
// the stored conversations exist by the time the server's unread counts land.
export function useChatTabPersistence() {
  const authStore = useAuthStore();
  const { tabs, activeTabId, openTab, setActiveTab } = useChatTabs();

  watch(
    () => authStore.me?.steam_id,
    (steamId) => {
      if (!steamId) {
        pendingActiveId.value = null;
        return;
      }

      const stored = readStoredChatTabs(steamId);

      for (const conversation of stored.direct) {
        openTab({
          id: directTabId(conversation.roomId),
          label: conversation.label || conversation.roomId,
          instance: "direct",
          type: "direct",
          lobbyId: conversation.roomId,
          pinned: false,
          avatarUrl: conversation.avatarUrl,
          steamId: conversation.steamId,
          // Restoring the layout must not decide what you are looking at --
          // that is what the stored active room is for.
          activate: false,
        });
      }

      pendingActiveId.value = stored.activeTabId;
    },
    { immediate: true },
  );

  watch(
    [tabs, pendingActiveId],
    () => {
      const wanted = pendingActiveId.value;

      if (!wanted) {
        return;
      }

      if (tabs.value.some((tab) => tab.id === wanted)) {
        setActiveTab(wanted);
        pendingActiveId.value = null;
      }
    },
    { immediate: true, deep: true },
  );

  watch(
    [tabs, activeTabId],
    () => {
      const steamId = authStore.me?.steam_id;

      if (!steamId) {
        return;
      }

      writeStoredChatTabs(steamId, {
        direct: tabs.value
          .filter((tab) => tab.type === "direct")
          .map((tab) => ({
            roomId: tab.lobbyId,
            label: tab.label,
            avatarUrl: tab.avatarUrl,
            steamId: tab.steamId,
          })),
        // Hold the stored room until the restore actually lands, otherwise the
        // first auto-selected channel overwrites it before it can be applied.
        activeTabId: pendingActiveId.value ?? activeTabId.value,
      });
    },
    { deep: true },
  );
}
