<script setup lang="ts">
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import {
  Bell,
  Clock,
  Users,
  MessageSquare,
  Tent,
  Pin,
  X,
} from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useHubState } from "@/composables/useHubState";
import { useChatTabs } from "~/composables/useChatTabs";
import { useNotificationBadge } from "~/composables/useNotificationBadge";
import { useInvites } from "@/composables/useInvites";
import { useMediaQuery } from "@vueuse/core";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import SocialPanel from "~/components/hub/SocialPanel.vue";
import RecentGamesPanel from "~/components/hub/RecentGamesPanel.vue";
import SidebarChatTab from "~/components/hub/ChatPanel.vue";
import NotificationsPanel from "~/components/hub/NotificationsPanel.vue";
import LobbyPanel from "~/components/hub/LobbyPanel.vue";

const {
  setRightSidebarOpen,
  rightSidebarOpen,
  startHoverPeek,
  endHoverPeek,
  hoverCloseSuspended,
  isPinned,
  togglePin,
} = useRightSidebar();
const { activeHub, selectHub } = useHubState();
const { unreadCounts } = useChatTabs();
const { hasNotifications, unreadNotificationCount } = useNotificationBadge();
const { hasSocialInvites, hasLobbyInvites, lobbyInvites, pendingFriends } =
  useInvites();
const isMobile = useMediaQuery("(max-width: 768px)");
const isMedium = useMediaQuery("(max-width: 1400px)");
const showHoverBehavior = computed(() => isMedium.value && !isMobile.value);

let closeTimer: ReturnType<typeof setTimeout> | null = null;

// Ensure pinned sidebar stays expanded on mobile as well, even after refresh
watch(
  [isMobile, isPinned, rightSidebarOpen],
  ([mobile, pinned, open]) => {
    if (mobile && pinned && !open) {
      setRightSidebarOpen(true);
    }
  },
  { immediate: true },
);

// Animated indicator
const iconStripRef = ref<HTMLElement | null>(null);
const hubButtonRefs = ref<Record<string, HTMLElement | null>>({});
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const hasAnimated = ref(false);

function setHubButtonRef(hub: string) {
  return (el: any) => {
    hubButtonRefs.value[hub] = el as HTMLElement | null;
  };
}

function updateIndicator() {
  const strip = iconStripRef.value;
  if (!strip || !activeHub.value || !rightSidebarOpen.value) return;
  const btn = hubButtonRefs.value[activeHub.value];
  if (!btn) return;
  const stripRect = strip.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  indicatorY.value = btnRect.top - stripRect.top;
  indicatorHeight.value = btnRect.height;
  nextTick(() => {
    hasAnimated.value = true;
  });
}

watch([activeHub, rightSidebarOpen], () => {
  if (!activeHub.value || !rightSidebarOpen.value) {
    hasAnimated.value = false;
  }
  nextTick(updateIndicator);
});

onMounted(() => nextTick(updateIndicator));

const showIndicator = computed(
  () => activeHub.value && rightSidebarOpen.value && indicatorHeight.value > 0,
);

const isPointerInsideHub = ref(false);

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function queueHoverClose() {
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    if (!hoverCloseSuspended.value) {
      endHoverPeek();
    }
    closeTimer = null;
  }, 150);
}

function onMouseEnter() {
  isPointerInsideHub.value = true;
  clearCloseTimer();
  if (showHoverBehavior.value) startHoverPeek();
}

function onMouseLeave(event: MouseEvent) {
  isPointerInsideHub.value = false;
  if (!showHoverBehavior.value) return;

  const nextTarget = event.relatedTarget;
  if (
    hoverCloseSuspended.value ||
    (nextTarget instanceof Element &&
      nextTarget.closest("[data-right-hub-interactive]"))
  ) {
    clearCloseTimer();
    return;
  }

  queueHoverClose();
}

watch(hoverCloseSuspended, (suspended) => {
  if (suspended) {
    clearCloseTimer();
    return;
  }

  if (!isPointerInsideHub.value && showHoverBehavior.value) {
    queueHoverClose();
  }
});

const totalUnread = computed(() =>
  Object.values(unreadCounts.value).reduce((sum, n) => sum + (n || 0), 0),
);
const lobbyInviteCount = computed(() => lobbyInvites.value?.length ?? 0);
const socialInviteCount = computed(() => pendingFriends.value?.length ?? 0);
const formatBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));
const notificationBadgeLabel = computed(() =>
  formatBadgeCount(unreadNotificationCount.value),
);
const lobbyBadgeLabel = computed(() => formatBadgeCount(lobbyInviteCount.value));
const lobbyMemberCount = computed(() => {
  const lobby = useMatchmakingStore().currentLobby as any;
  if (!lobby) return 0;
  return (lobby.players ?? []).filter((p: any) => p.status !== "Invited")
    .length;
});
const hasLobby = computed(() => lobbyMemberCount.value > 0);
const lobbyMemberLabel = computed(() =>
  formatBadgeCount(lobbyMemberCount.value),
);
const chatBadgeLabel = computed(() => formatBadgeCount(totalUnread.value));

// Pop-in/out for the count circles (bouncy enter, quick fade-shrink leave)
const badgePopTransition = {
  enterActiveClass:
    "[transition:transform_0.3s_cubic-bezier(0.34,1.56,0.64,1),opacity_0.2s_ease]",
  enterFromClass: "scale-0 opacity-0",
  leaveActiveClass: "[transition:transform_0.15s_ease-in,opacity_0.15s_ease-in]",
  leaveToClass: "scale-0 opacity-0",
};
const socialBadgeLabel = computed(() =>
  formatBadgeCount(socialInviteCount.value),
);

// Track which hubs have been mounted so panels stay in DOM after first visit
const mountedHubs = ref<Record<string, boolean>>({});
watch(
  activeHub,
  (hub) => {
    if (hub) mountedHubs.value[hub] = true;
  },
  { immediate: true },
);

function isHubActive(hub: string) {
  return activeHub.value === hub && rightSidebarOpen.value;
}

const hubPanels = [
  { name: "notifications", component: NotificationsPanel },
  { name: "lobby", component: LobbyPanel },
  {
    name: "chat",
    component: SidebarChatTab,
    props: () => ({
      isSidebarOpen: rightSidebarOpen.value,
      isTabActive: activeHub.value === "chat",
    }),
  },
  { name: "social", component: SocialPanel },
  { name: "recent-games", component: RecentGamesPanel },
] as const;

function hubBtnClass(hub: string) {
  return [
    "relative flex items-center justify-center w-10 h-10 rounded-md transition-colors duration-200",
    isHubActive(hub)
      ? "text-[hsl(var(--tac-amber))]"
      : "text-sidebar-foreground/50 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-sidebar-foreground",
  ];
}

// Mobile: swipe right to close
const swipeStartX = ref(0);
const swipeStartY = ref(0);
function onHubTouchStart(e: TouchEvent) {
  if (!e.touches[0]) return;
  swipeStartX.value = e.touches[0].clientX;
  swipeStartY.value = e.touches[0].clientY;
}
function onHubTouchEnd(e: TouchEvent) {
  if (!e.changedTouches[0] || !isMobile.value) return;
  const deltaX = e.changedTouches[0].clientX - swipeStartX.value;
  const deltaY = e.changedTouches[0].clientY - swipeStartY.value;
  if (deltaX < 50) return; // need swipe right (positive deltaX)
  if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) return; // prefer horizontal
  setRightSidebarOpen(false);
}
</script>

<template>
  <Sidebar
    collapsible="icon"
    side="right"
    variant="inset"
    :overlay="showHoverBehavior && !isPinned"
    class="shadow-[-16px_0_24px_-4px_rgba(0,0,0,0.5)]"
  >
    <div
      class="flex h-full"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- Content panel — hidden when sidebar collapses to icon strip -->
      <div
        class="relative flex-1 min-w-0 overflow-hidden group-data-[collapsible=icon]:hidden"
        @touchstart.passive="onHubTouchStart"
        @touchend="onHubTouchEnd"
      >
        <Transition
          v-for="hub in hubPanels"
          :key="hub.name"
          enter-active-class="[transition:opacity_0.2s_ease_0.05s]"
          leave-active-class="transition-opacity duration-150 ease-linear"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <div
            v-if="mountedHubs[hub.name]"
            v-show="activeHub === hub.name"
            :class="[
              'absolute inset-0',
              isMobile ? 'flex flex-col min-h-0' : '',
            ]"
          >
            <component
              :is="hub.component"
              v-bind="hub.props?.()"
              :class="isMobile ? 'flex-1 min-h-0' : 'h-full'"
            />
          </div>
        </Transition>
      </div>

      <!-- Icon strip — always visible (fits in 3rem icon-mode width) -->
      <div
        ref="iconStripRef"
        class="relative w-14 flex-shrink-0 ml-auto border-l border-sidebar-border flex flex-col items-center py-3 gap-0.5"
      >
        <!-- Sliding active indicator -->
        <div
          v-show="showIndicator"
          class="absolute top-0 left-0 w-0.5 rounded-r-full z-10 pointer-events-none bg-[hsl(var(--tac-amber))]"
          :class="
            hasAnimated
              ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),height_0s]'
              : ''
          "
          :style="{
            transform: `translateY(${indicatorY + 4}px)`,
            height: `${indicatorHeight - 8}px`,
          }"
        />

        <!-- Background highlight indicator -->
        <div
          v-show="showIndicator"
          class="absolute top-0 left-2 right-2 rounded-md z-0 pointer-events-none bg-[hsl(var(--tac-amber)/0.1)]"
          :class="
            hasAnimated
              ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),height_0s]'
              : ''
          "
          :style="{
            transform: `translateY(${indicatorY}px)`,
            height: `${indicatorHeight}px`,
          }"
        />

        <!-- Close/toggle at top (mobile only) -->
        <button
          v-if="isMobile"
          class="flex items-center justify-center"
          @click="setRightSidebarOpen(!rightSidebarOpen)"
        >
          <MiniDisplay />
        </button>

        <!-- Notifications -->
        <button
          :ref="setHubButtonRef('notifications')"
          :class="[hubBtnClass('notifications'), 'relative z-[1]']"
          @click="selectHub('notifications')"
        >
          <span class="relative inline-flex">
            <Bell
              class="w-5 h-5"
              :class="{ 'animate-bell origin-top': hasNotifications }"
            />
            <Transition v-bind="badgePopTransition">
              <span
                v-if="hasNotifications"
                class="absolute -top-1.5 -right-2 flex origin-center"
              >
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
                />
                <span
                  class="relative inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.55rem] font-bold leading-none text-white shadow-sm ring-1 ring-background"
                >
                  <AnimatedStat :value="notificationBadgeLabel" />
                </span>
              </span>
            </Transition>
          </span>
        </button>

        <!-- Lobby -->
        <button
          :ref="setHubButtonRef('lobby')"
          :class="[hubBtnClass('lobby'), 'z-[1]']"
          @click="selectHub('lobby')"
        >
          <span class="relative inline-flex">
            <Tent class="w-5 h-5" />
            <Transition v-bind="badgePopTransition">
              <!-- Current lobby member count -->
              <span
                v-if="hasLobby"
                class="absolute -top-1.5 -right-2 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.55rem] font-bold leading-none text-black tabular-nums shadow-sm ring-1 ring-background origin-center"
              >
                <AnimatedStat :value="lobbyMemberLabel" />
              </span>
              <!-- Pending lobby invites (amber — never red) -->
              <span
                v-else-if="hasLobbyInvites"
                class="absolute -top-1.5 -right-2 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.55rem] font-bold leading-none text-black tabular-nums shadow-sm ring-1 ring-background origin-center"
              >
                <AnimatedStat :value="lobbyBadgeLabel" />
              </span>
            </Transition>
          </span>
        </button>

        <!-- Chat (with unread indicator) -->
        <button
          :ref="setHubButtonRef('chat')"
          :class="[hubBtnClass('chat'), 'relative z-[1]']"
          @click="selectHub('chat')"
        >
          <span class="relative inline-flex">
            <MessageSquare class="w-5 h-5" />
            <Transition v-bind="badgePopTransition">
              <span
                v-if="totalUnread > 0"
                class="absolute -top-1.5 -right-2 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.55rem] font-bold leading-none text-white shadow-sm ring-1 ring-background origin-center"
              >
                <AnimatedStat :value="chatBadgeLabel" />
              </span>
            </Transition>
          </span>
        </button>

        <!-- Social (friends / invites) -->
        <button
          :ref="setHubButtonRef('social')"
          :class="[hubBtnClass('social'), 'z-[1]']"
          @click="selectHub('social')"
        >
          <span class="relative inline-flex">
            <Users class="w-5 h-5" />
            <Transition v-bind="badgePopTransition">
              <span
                v-if="hasSocialInvites"
                class="absolute -top-1.5 -right-2 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.55rem] font-bold leading-none text-white shadow-sm ring-1 ring-background origin-center"
              >
                <AnimatedStat :value="socialBadgeLabel" />
              </span>
            </Transition>
          </span>
        </button>

        <!-- Recent Games -->
        <button
          :ref="setHubButtonRef('recent-games')"
          :class="[hubBtnClass('recent-games'), 'z-[1]']"
          @click="selectHub('recent-games')"
        >
          <Clock class="w-5 h-5" />
        </button>

        <div class="flex-1" />

        <!-- Close/toggle at bottom (desktop only) -->
        <SidebarMenu v-if="!isMobile">
          <SidebarMenuItem>
            <SidebarMenuButton
              :tooltip="$t('ui.tooltips.toggle_right_sidebar')"
              @click="setRightSidebarOpen(!rightSidebarOpen)"
              class="w-full h-auto group-data-[collapsible=icon]:!h-auto group-data-[collapsible=icon]:!w-full"
            >
              <MiniDisplay />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <!-- Pin button — only on medium/smaller screens where auto-hide is active -->
        <button
          v-if="showHoverBehavior"
          class="flex items-center justify-center w-10 h-10 rounded-md transition-all"
          :class="
            isPinned
              ? 'bg-primary/15 text-primary'
              : 'text-sidebar-foreground/30 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/60'
          "
          @click="togglePin"
        >
          <Pin
            class="w-4 h-4 transition-transform"
            :class="isPinned ? 'rotate-0' : 'rotate-45'"
          />
        </button>
      </div>
    </div>
  </Sidebar>
</template>
