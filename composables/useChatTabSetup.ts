import { watch, computed } from "vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

export function useChatTabSetup() {
  const { tabs, activeTabId, openTab, closeTab, setActiveTab, setPinned } =
    useChatTabs();

  const matchLobbyStore = useMatchLobbyStore();
  const authStore = useAuthStore();

  const isOrganizer = computed(() =>
    authStore.isRoleAbove(e_player_roles_enum.match_organizer),
  );

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
          label: "Lobby",
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
            `${currentMatch.lineup_1?.name ?? "TBD"} vs ${currentMatch.lineup_2?.name ?? "TBD"}`,
          instance: "match",
          type: "match",
          lobbyId: currentMatch.id,
          pinned: true,
        });
      }
    }

    if (isOrganizer.value) {
      const organizerId = "organizers";
      const existing = tabs.value.find((t) => t.id === organizerId);
      if (!existing) {
        openTab({
          id: organizerId,
          label: "Organizers",
          instance: "organizers",
          type: "organizers",
          lobbyId: organizerId,
          pinned: true,
        });
      } else if (!existing.pinned) {
        setPinned(organizerId, true);
      }
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
            `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`,
          instance: "match",
          type: "match",
          lobbyId: match.id,
        });
      }
    },
  );
}
