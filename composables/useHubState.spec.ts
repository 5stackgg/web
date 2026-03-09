import { ref, computed } from "vue";

vi.mock("@vueuse/core", () => ({
  useMediaQuery: () => ref(false),
}));

const sidebarOpen = ref(true);
vi.mock("@/composables/useRightSidebar", () => ({
  useRightSidebar: () => ({
    rightSidebarOpen: sidebarOpen,
    setRightSidebarOpen: (v: boolean) => {
      sidebarOpen.value = v;
    },
  }),
}));

vi.mock("~/composables/useNotificationBadge", () => ({
  useNotificationBadge: () => ({
    hasNotifications: ref(false),
  }),
}));

vi.mock("@/composables/useInvites", () => ({
  useInvites: () => ({
    hasLobbyInvites: ref(false),
    hasSocialInvites: ref(false),
  }),
}));

vi.mock("~/composables/useChatTabs", () => ({
  useChatTabs: () => ({
    unreadCounts: computed(() => ({})),
  }),
}));

import { useHubState } from "./useHubState";

describe("useHubState", () => {
  beforeEach(() => {
    sidebarOpen.value = true;
  });

  it("selects a hub", () => {
    const { selectHub, activeHub } = useHubState();
    selectHub("chat");
    expect(activeHub.value).toBe("chat");
  });

  it("toggles hub off when selecting same hub while sidebar is open", () => {
    const { selectHub, activeHub } = useHubState();
    // Ensure we start with a known hub active and sidebar open
    selectHub("notifications");
    sidebarOpen.value = true;
    // Now toggle same hub - should close
    selectHub("notifications");
    expect(activeHub.value).toBeNull();
  });

  it("switches between different hubs", () => {
    const { selectHub, activeHub } = useHubState();
    selectHub("chat");
    selectHub("social");
    expect(activeHub.value).toBe("social");
  });

  it("openLastOrDefaultHub sets a hub", () => {
    const { openLastOrDefaultHub, activeHub } = useHubState();
    openLastOrDefaultHub();
    expect(activeHub.value).not.toBeNull();
  });
});
