import { ref, computed } from "vue";
import type { ChatType } from "~/web-sockets/Socket";

export interface ChatTab {
  id: string;
  label: string;
  instance: string;
  type: ChatType;
  lobbyId: string;
  pinned: boolean;
  // Direct-message tabs are a person, not a room, so the rail shows their
  // avatar instead of a channel icon.
  avatarUrl?: string;
  steamId?: string;
  // Where this conversation sits on the rail, lowest first. Server-owned and
  // rewritten by a drag; channels have no position and sort by their own
  // rules. See useDirectConversationBar.
  position?: number;
}

const tabsRef = ref<ChatTab[]>([]);
const unreadCountsRef = ref<Record<string, number>>({});
const activeTabIdRef = ref<string | null>(null);

export function useChatTabs() {
  const tabs = computed(() => tabsRef.value);
  const unreadCounts = computed(() => unreadCountsRef.value);
  const activeTabId = computed(() => activeTabIdRef.value);

  function findTabIndex(id: string) {
    return tabsRef.value.findIndex((t) => t.id === id);
  }

  // `activate` exists for incoming direct messages: a tab opened because
  // someone messaged you must not yank you out of the room you are reading.
  function openTab(
    payload: Omit<ChatTab, "pinned"> & {
      pinned?: boolean;
      activate?: boolean;
    },
  ) {
    const id = payload.id;
    const activate = payload.activate ?? true;
    const existingIndex = findTabIndex(id);

    if (existingIndex !== -1) {
      if (activate) {
        activeTabIdRef.value = id;
      }
      return tabsRef.value[existingIndex];
    }

    const tab: ChatTab = {
      ...payload,
      pinned: payload.pinned ?? false,
    };

    tabsRef.value.push(tab);

    if (activate) {
      activeTabIdRef.value = id;
    }

    return tab;
  }

  function closeTab(id: string) {
    const idx = findTabIndex(id);
    if (idx === -1) {
      return;
    }

    const [removed] = tabsRef.value.splice(idx, 1);
    delete unreadCountsRef.value[removed.id];

    if (activeTabIdRef.value === removed.id) {
      const next =
        tabsRef.value[idx] ||
        tabsRef.value[idx - 1] ||
        tabsRef.value[0] ||
        null;
      activeTabIdRef.value = next ? next.id : null;
    }
  }

  function setActiveTab(id: string | null) {
    activeTabIdRef.value = id;
  }

  function setTabPosition(id: string, position: number) {
    const idx = findTabIndex(id);
    if (idx === -1) {
      return;
    }
    tabsRef.value[idx] = {
      ...tabsRef.value[idx],
      position,
    };
  }

  function setPinned(id: string, pinned: boolean) {
    const idx = findTabIndex(id);
    if (idx === -1) {
      return;
    }
    tabsRef.value[idx] = {
      ...tabsRef.value[idx],
      pinned,
    };
  }

  function incrementUnread(id: string) {
    unreadCountsRef.value[id] = (unreadCountsRef.value[id] || 0) + 1;
  }

  function resetUnread(id: string) {
    if (unreadCountsRef.value[id]) {
      unreadCountsRef.value[id] = 0;
    }
  }

  function setUnread(id: string, value: number) {
    unreadCountsRef.value[id] = value;
  }

  function clearAll() {
    tabsRef.value = [];
    unreadCountsRef.value = {};
    activeTabIdRef.value = null;
  }

  return {
    tabs,
    unreadCounts,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    setPinned,
    setTabPosition,
    incrementUnread,
    resetUnread,
    setUnread,
    clearAll,
  };
}
