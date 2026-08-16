import { ref, watch } from "vue";
import { useChatTabs } from "~/composables/useChatTabs";

// Which room you were last reading, and only that.
//
// The set of conversations on the rail used to live here too, in localStorage,
// on the reasoning that closing one is a local preference the other party
// should not be told about. That reasoning still holds -- but the row it now
// lives in is already per (room, participant), so the server can hold it
// without telling anyone anything, and two devices finally agree about what is
// on the bar. See useDirectConversationBar.
//
// The last active room stays local on purpose: which conversation you had open
// on your phone is not the one you want restored on your desktop.

const ACTIVE_TAB_KEY = "5stack:chat-active-tab";

function storageKey(steamId: string | number) {
  return `${ACTIVE_TAB_KEY}:${steamId}`;
}

function readStoredActiveTab(
  steamId: string | number | undefined | null,
): string | null {
  if (!import.meta.client || !steamId) {
    return null;
  }

  try {
    return window.localStorage.getItem(storageKey(steamId));
  } catch {
    return null;
  }
}

// The open set used to live under `5stack:chat-tabs:<steamId>`. It is the
// server's now, so every browser that ever ran the old build is holding a blob
// nothing will read again.
function dropLegacyChatTabs(steamId: string | number) {
  if (!import.meta.client) {
    return;
  }

  try {
    window.localStorage.removeItem(`5stack:chat-tabs:${steamId}`);
  } catch {
    // Nothing to do about a blocked localStorage, and nothing lost either.
  }
}

function writeStoredActiveTab(steamId: string | number, tabId: string | null) {
  if (!import.meta.client) {
    return;
  }

  try {
    if (tabId) {
      window.localStorage.setItem(storageKey(steamId), tabId);
    } else {
      window.localStorage.removeItem(storageKey(steamId));
    }
  } catch {
    // A blocked or full localStorage costs the user their last room on the
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

// Mounted once, from the default layout.
export function useChatTabPersistence() {
  const authStore = useAuthStore();
  const { tabs, activeTabId, setActiveTab } = useChatTabs();

  watch(
    () => authStore.me?.steam_id,
    (steamId) => {
      if (!steamId) {
        pendingActiveId.value = null;
        return;
      }

      dropLegacyChatTabs(steamId);
      pendingActiveId.value = readStoredActiveTab(steamId);
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

  watch([tabs, activeTabId], () => {
    const steamId = authStore.me?.steam_id;

    if (!steamId) {
      return;
    }

    writeStoredActiveTab(
      steamId,
      // Hold the stored room until the restore actually lands, otherwise the
      // first auto-selected channel overwrites it before it can be applied.
      pendingActiveId.value ?? activeTabId.value,
    );
  });
}
