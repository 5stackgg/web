import { watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatReadState } from "~/composables/useChatReadState";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import socket, { type Lobby } from "~/web-sockets/Socket";

export function useChatTabSetup() {
  const { t } = useI18n();
  const {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    setPinned,
    incrementUnread,
    setUnread,
  } = useChatTabs();
  const { rightSidebarOpen } = useRightSidebar();
  const { hydrate: hydrateReadState, unreadSince } = useChatReadState();

  const matchLobbyStore = useMatchLobbyStore();
  const authStore = useAuthStore();

  const isOrganizer = computed(() =>
    authStore.isRoleAbove(e_player_roles_enum.match_organizer),
  );
  const persistentLobbies = new Map<string, Lobby>();

  // Unread counting lives here rather than in ChatPanel because RightHub only
  // mounts a panel once its hub is first opened -- so counting inside the panel
  // meant no unread badge ever appeared until the user had already gone
  // looking. This runs from the default layout, so it covers every tab from
  // login onwards.
  function trackUnread(tab: (typeof tabs.value)[number], lobby: Lobby) {
    lobby.on("lobby:chat", (message: any) => {
      if (String(message?.from?.steam_id) === String(authStore.me?.steam_id)) {
        return;
      }

      const isOnScreen =
        activeTabId.value === tab.id &&
        rightSidebarOpen.value &&
        currentHub() === "chat";

      if (!isOnScreen) {
        incrementUnread(tab.id);
      }
    });

    // The room's history, which arrives on join and on every rejoin. Counting
    // it against the server's cursor is what makes a badge survive a reload
    // and agree with the other devices -- the live handler above only ever
    // knew about this session.
    //
    // Conversations are left alone: their count comes from
    // /chat/direct/conversations, which counts the whole thread rather than
    // the last 200 messages of it.
    lobby.on("lobby:messages", (messages: any[]) => {
      if (tab.type === "direct") {
        return;
      }

      setUnread(
        tab.id,
        unreadSince(tab.type, tab.lobbyId, messages ?? [], authStore.me?.steam_id),
      );
    });
  }

  function syncPersistentChatJoins() {
    const activeIds = new Set(tabs.value.map((tab) => tab.id));

    for (const tab of tabs.value) {
      if (persistentLobbies.has(tab.id)) {
        continue;
      }

      const lobby = socket.joinLobby(
        `chat-tab-setup:${tab.id}`,
        tab.type,
        tab.lobbyId,
      );

      trackUnread(tab, lobby);
      persistentLobbies.set(tab.id, lobby);
    }

    for (const [tabId, lobby] of persistentLobbies.entries()) {
      if (activeIds.has(tabId)) {
        continue;
      }

      lobby.leave();
      persistentLobbies.delete(tabId);
    }
  }

  function ensureTournamentChatTabs() {
    const tournaments = matchLobbyStore.chatTournaments as any[];

    // Ensure a pinned chat tab for every chat-eligible tournament.
    for (const t of tournaments) {
      const tabId = `tournament:${t.id}`;
      const existing = tabs.value.find((tab) => tab.id === tabId);
      if (!existing) {
        openTab({
          id: tabId,
          label: t.name,
          instance: "tournament",
          type: "tournament",
          lobbyId: t.id, // pass tournament ID as lobby id
          pinned: true,
        });
      } else if (!existing.pinned) {
        setPinned(tabId, true);
      }
    }

    // Remove tournament chat tabs that are no longer eligible.
    const activeIds = new Set(
      tournaments.map((t: any) => `tournament:${t.id}`),
    );
    for (const tab of [...tabs.value]) {
      if (tab.type === "tournament" && !activeIds.has(tab.id)) {
        closeTab(tab.id);
      }
    }
  }

  function ensureDefaultTabs() {
    const previousActiveId = activeTabId.value;

    const me = authStore.me;
    if (me?.current_lobby_id) {
      const lobbyTabId = `matchmaking:${me.current_lobby_id}`;
      const existingLobby = tabs.value.find((t) => t.id === lobbyTabId);
      if (!existingLobby) {
        openTab({
          id: lobbyTabId,
          label: t("chat_tab_labels.lobby_default"),
          instance: "matchmaking",
          type: "matchmaking",
          lobbyId: me.current_lobby_id,
          pinned: true,
        });
      }
    }

    const currentMatch = matchLobbyStore.currentMatch;
    if (currentMatch) {
      const matchTabId = `match:${currentMatch.id}`;
      const existingMatch = tabs.value.find((t) => t.id === matchTabId);
      if (!existingMatch) {
        openTab({
          id: matchTabId,
          label:
            currentMatch.label ||
            `${currentMatch.lineup_1?.name ?? t("common.tbd")} vs ${currentMatch.lineup_2?.name ?? t("common.tbd")}`,
          instance: "match",
          type: "match",
          lobbyId: currentMatch.id,
          pinned: true,
        });
      }
    }

    const organizerId = "organizers";
    const existingOrganizer = tabs.value.find((t) => t.id === organizerId);
    if (isOrganizer.value) {
      const existing = existingOrganizer;
      if (!existing) {
        openTab({
          id: organizerId,
          label: t("chat_tab_labels.organizers_default"),
          instance: "organizers",
          type: "organizers",
          lobbyId: organizerId,
          pinned: true,
        });
      } else if (!existing.pinned) {
        setPinned(organizerId, true);
      }
    } else if (existingOrganizer) {
      closeTab(organizerId);
    }

    // Restore previously active tab so adding defaults doesn't steal focus.
    if (previousActiveId) {
      const stillExists = tabs.value.find((t) => t.id === previousActiveId);
      if (stillExists) {
        setActiveTab(previousActiveId);
      }
    }
  }

  watch(
    () => authStore.me?.steam_id,
    (steamId) => {
      if (steamId) {
        // Before the rooms are joined, so the first history snapshot is
        // counted against a real cursor rather than against zero.
        void hydrateReadState();
      }
    },
    { immediate: true },
  );

  watch(
    () => authStore.me,
    (me) => {
      // Close stale matchmaking tabs
      const activeLobbyId = me?.current_lobby_id ?? null;
      for (const tab of tabs.value) {
        if (tab.type === "matchmaking" && tab.lobbyId !== activeLobbyId) {
          closeTab(tab.id);
        }
      }
      ensureDefaultTabs();
    },
    { immediate: true },
  );

  watch(
    () => matchLobbyStore.chatTournaments,
    () => {
      ensureTournamentChatTabs();
    },
    { immediate: true, deep: true },
  );

  watch(
    () => matchLobbyStore.currentMatch,
    (match) => {
      if (!match) {
        return;
      }
      const id = `match:${match.id}`;
      const existing = tabs.value.find((t) => t.id === id);
      if (!existing) {
        openTab({
          id,
          label:
            match.label ||
            `${match.lineup_1?.name ?? t("common.tbd")} vs ${match.lineup_2?.name ?? t("common.tbd")}`,
          instance: "match",
          type: "match",
          lobbyId: match.id,
        });
      }
    },
  );

  watch(
    () => matchLobbyStore.myMatches,
    () => {
      const matches = matchLobbyStore.myMatches as any[];
      const activeMatchTabIds = new Set(matches.map((m) => `match:${m.id}`));

      for (const tab of [...tabs.value]) {
        if (tab.type === "match" && !activeMatchTabIds.has(tab.id)) {
          closeTab(tab.id);
        }
      }
    },
    { deep: true },
  );

  watch(tabs, syncPersistentChatJoins, { immediate: true, deep: true });
}
