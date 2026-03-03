import { ref, computed } from "vue";

type ChatType = "match" | "team" | "matchmaking" | "organizers" | "tournament";

export interface ChatTab {
  id: string;
  label: string;
  instance: string;
  type: ChatType;
  lobbyId: string;
  pinned: boolean;
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

  function openTab(payload: Omit<ChatTab, "pinned"> & { pinned?: boolean }) {
    const id = payload.id;
    const existingIndex = findTabIndex(id);

    if (existingIndex !== -1) {
      activeTabIdRef.value = id;
      return tabsRef.value[existingIndex];
    }

    const tab: ChatTab = {
      ...payload,
      pinned: payload.pinned ?? false,
    };

    tabsRef.value.push(tab);
    activeTabIdRef.value = id;

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
    incrementUnread,
    resetUnread,
    setUnread,
    clearAll,
  };
}
