import { ref, watch, computed } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useNotificationBadge } from "~/composables/useNotificationBadge";
import { useInvites } from "@/composables/useInvites";
import { useChatTabs } from "~/composables/useChatTabs";

type Hub = "recent-games" | "social" | "chat" | "notifications" | "lobby";

const HUB_STORAGE_KEY = "right-hub-active-tab";

function readSavedHub(): Hub | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(HUB_STORAGE_KEY) as Hub | null;
  return saved ?? null;
}

const activeHub = ref<Hub | null>("social");

// Initialize from localStorage (client-side only)
const initialSavedHub = readSavedHub();
if (initialSavedHub) {
  activeHub.value = initialSavedHub;
}

export function useHubState() {
  const { rightSidebarOpen, setRightSidebarOpen } = useRightSidebar();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { hasNotifications } = useNotificationBadge();
  const { hasLobbyInvites, hasSocialInvites } = useInvites();
  const { unreadCounts } = useChatTabs();

  const totalUnread = computed(() =>
    Object.values(unreadCounts.value).reduce((sum, n) => sum + (n || 0), 0),
  );

  function defaultHub(): Hub {
    if (hasNotifications.value) return "notifications";
    if (hasLobbyInvites.value) return "lobby";
    if (totalUnread.value > 0) return "chat";
    if (hasSocialInvites.value) return "social";
    return "social";
  }

  function selectHub(hub: Hub) {
    if (activeHub.value === hub && rightSidebarOpen.value) {
      setRightSidebarOpen(false);
      activeHub.value = null;
    } else {
      activeHub.value = hub;
      setRightSidebarOpen(true);
    }
  }

  function openLastOrDefaultHub() {
    const restored = readSavedHub();
    const target = restored ?? defaultHub();
    activeHub.value = target;
    setRightSidebarOpen(true);
  }

  // Persist active hub selection to localStorage (but keep last non-null when closed)
  watch(
    activeHub,
    (hub) => {
      if (typeof window === "undefined") return;
      if (!hub) return;
      window.localStorage.setItem(HUB_STORAGE_KEY, hub);
    },
    { immediate: true },
  );

  // Sync: open with no hub → prefer saved hub, then fall back to default; close → clear current hub
  watch(
    rightSidebarOpen,
    (open) => {
      if (open && !activeHub.value) {
        const restored = readSavedHub();
        activeHub.value = restored ?? defaultHub();
      }
      if (!open && !isMobile.value) activeHub.value = null;
    },
    { immediate: true },
  );

  return { activeHub, selectHub, openLastOrDefaultHub };
}
