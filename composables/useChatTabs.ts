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
// When each room last saw a message, from either side. The hub dock keeps the
// most recently active conversations on it, read or not, freshest first.
const activityAtRef = ref<Record<string, number>>({});
// Which messages each badge has counted. A message can reach a badge twice,
// from direct:incoming and from its room's lobby:chat, and a deleted one only
// comes off the count if it was ever in it -- a line read on screen is newer
// than the read cursor too, but no badge counted it.
const unreadMessageIds = new Map<string, Set<string>>();
const MAX_UNREAD_MESSAGE_IDS = 200;
// Unread lines that tag this player, per room, kept apart from the unread
// count: a match room's chatter is never counted, but a tag in it is.
const mentionCountsRef = ref<Record<string, number>>({});
const mentionMessageIds = new Map<string, Set<string>>();
const activeTabIdRef = ref<string | null>(null);

export function useChatTabs() {
  const tabs = computed(() => tabsRef.value);
  const unreadCounts = computed(() => unreadCountsRef.value);
  const activityAt = computed(() => activityAtRef.value);
  const activeTabId = computed(() => activeTabIdRef.value);
  const totalUnread = computed(() =>
    Object.values(unreadCountsRef.value).reduce((sum, n) => sum + (n || 0), 0),
  );
  const mentionCounts = computed(() => mentionCountsRef.value);
  const totalMentions = computed(() =>
    Object.values(mentionCountsRef.value).reduce(
      (sum, n) => sum + (n || 0),
      0,
    ),
  );

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
    delete mentionCountsRef.value[removed.id];
    delete activityAtRef.value[removed.id];
    unreadMessageIds.delete(removed.id);
    mentionMessageIds.delete(removed.id);

    if (activeTabIdRef.value === removed.id) {
      const position = ordered.findIndex((tab) => tab.id === removed.id);
      const next = ordered[position + 1] ?? ordered[position - 1] ?? null;
      activeTabIdRef.value = next ? next.id : null;
    }
  }

  function setActiveTab(id: string | null) {
    activeTabIdRef.value = id;
  }

  // Only ever moves forward: a room's history arriving after a live message
  // must not make it look older than it is.
  function noteActivity(id: string, at: number = Date.now()) {
    if (!Number.isFinite(at)) {
      return;
    }
    if ((activityAtRef.value[id] ?? 0) < at) {
      activityAtRef.value[id] = at;
    }
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
    noteActivity(id);
    return true;
  }

  function decrementUnread(id: string, messageId: string) {
    if (!unreadMessageIds.get(id)?.delete(messageId)) {
      return;
    }

    if (unreadCountsRef.value[id]) {
      unreadCountsRef.value[id] -= 1;
    }
  }

  function resetUnread(id: string) {
    unreadMessageIds.delete(id);

    if (unreadCountsRef.value[id]) {
      unreadCountsRef.value[id] = 0;
    }

    setMentions(id, []);
  }

  function incrementMention(id: string, messageId: string) {
    let counted = mentionMessageIds.get(id);
    if (!counted) {
      counted = new Set();
      mentionMessageIds.set(id, counted);
    }

    if (counted.has(messageId)) {
      return false;
    }

    counted.add(messageId);
    if (counted.size > MAX_UNREAD_MESSAGE_IDS) {
      const [oldest] = counted;
      counted.delete(oldest);
    }

    mentionCountsRef.value[id] = counted.size;
    return true;
  }

  function decrementMention(id: string, messageId: string) {
    if (!mentionMessageIds.get(id)?.delete(messageId)) {
      return;
    }

    mentionCountsRef.value[id] = mentionMessageIds.get(id)?.size ?? 0;
  }

  // A recount from the room's history replaces what was counted live.
  function setMentions(id: string, messageIds: string[]) {
    const counted = new Set(messageIds.slice(-MAX_UNREAD_MESSAGE_IDS));

    if (counted.size === 0) {
      mentionMessageIds.delete(id);
      if (mentionCountsRef.value[id]) {
        mentionCountsRef.value[id] = 0;
      }
      return;
    }

    mentionMessageIds.set(id, counted);
    mentionCountsRef.value[id] = counted.size;
  }

  // A recount that names its messages replaces what the badge counted. Without
  // them a non-zero recount keeps the ids already counted, taking them to be
  // part of the new number, so a late second delivery of one still isn't
  // counted again.
  function setUnread(id: string, value: number, messageIds?: string[]) {
    unreadCountsRef.value[id] = value;

    if (messageIds) {
      unreadMessageIds.set(
        id,
        new Set(messageIds.slice(-MAX_UNREAD_MESSAGE_IDS)),
      );
    } else if (!value) {
      unreadMessageIds.delete(id);
    }
  }

  function clearAll() {
    tabsRef.value = [];
    unreadCountsRef.value = {};
    mentionCountsRef.value = {};
    activityAtRef.value = {};
    unreadMessageIds.clear();
    mentionMessageIds.clear();
    activeTabIdRef.value = null;
  }

  return {
    tabs,
    unreadCounts,
    mentionCounts,
    activityAt,
    totalUnread,
    totalMentions,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    setPinned,
    setTabPosition,
    incrementUnread,
    decrementUnread,
    resetUnread,
    setUnread,
    incrementMention,
    decrementMention,
    setMentions,
    noteActivity,
    clearAll,
  };
}
