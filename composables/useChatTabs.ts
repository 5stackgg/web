import { ref, computed } from "vue";
import type { ChatType } from "~/web-sockets/Socket";
import { orderChatTabs } from "~/utilities/chatTabOrder";

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
// A message can reach a badge twice, from direct:incoming and from its room's
// lobby:chat, so a badge remembers which ids it has already counted.
const unreadMessageIds = new Map<string, Set<string>>();
const MAX_UNREAD_MESSAGE_IDS = 200;
const activeTabIdRef = ref<string | null>(null);

export function useChatTabs() {
  const tabs = computed(() => tabsRef.value);
  const unreadCounts = computed(() => unreadCountsRef.value);
  const activeTabId = computed(() => activeTabIdRef.value);

  function findTabIndex(id: string) {
    return tabsRef.value.findIndex((t) => t.id === id);
  }

  // `activate: false` opens a tab in the background -- an incoming direct
  // message, or a room the session adds on its own -- so it does not yank you
  // out of the room you are reading.
  function openTab(
    payload: Omit<ChatTab, "pinned"> & {
      pinned?: boolean;
      activate?: boolean;
    },
  ) {
    const { activate = true, ...fields } = payload;
    const id = fields.id;
    const existingIndex = findTabIndex(id);

    if (existingIndex !== -1) {
      if (activate) {
        activeTabIdRef.value = id;
      }
      return tabsRef.value[existingIndex];
    }

    const tab: ChatTab = {
      ...fields,
      pinned: fields.pinned ?? false,
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

    const ordered = orderChatTabs(tabsRef.value);
    const [removed] = tabsRef.value.splice(idx, 1);
    delete unreadCountsRef.value[removed.id];
    unreadMessageIds.delete(removed.id);

    if (activeTabIdRef.value === removed.id) {
      const position = ordered.findIndex((tab) => tab.id === removed.id);
      const next = ordered[position + 1] ?? ordered[position - 1] ?? null;
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

  function incrementUnread(id: string, messageId?: string) {
    if (messageId) {
      let counted = unreadMessageIds.get(id);
      if (!counted) {
        counted = new Set();
        unreadMessageIds.set(id, counted);
      }

      if (counted.has(messageId)) {
        return false;
      }

      counted.add(messageId);
      if (counted.size > MAX_UNREAD_MESSAGE_IDS) {
        const [oldest] = counted;
        counted.delete(oldest);
      }
    }

    unreadCountsRef.value[id] = (unreadCountsRef.value[id] || 0) + 1;
    return true;
  }

  function resetUnread(id: string) {
    unreadMessageIds.delete(id);

    if (unreadCountsRef.value[id]) {
      unreadCountsRef.value[id] = 0;
    }
  }

  // A non-zero recount keeps the ids already counted, taking them to be part of
  // the new number, so a late second delivery of one still isn't counted again.
  function setUnread(id: string, value: number) {
    unreadCountsRef.value[id] = value;

    if (!value) {
      unreadMessageIds.delete(id);
    }
  }

  function clearAll() {
    tabsRef.value = [];
    unreadCountsRef.value = {};
    unreadMessageIds.clear();
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
