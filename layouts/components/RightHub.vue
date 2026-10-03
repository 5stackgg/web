<script setup lang="ts">
import { Sidebar } from "~/components/ui/sidebar";
import {
  Bell,
  History,
  Users,
  Mic,
  MessageSquare,
  Tent,
  Pin,
  Swords,
  Merge,
  Megaphone,
} from "lucide-vue-next";
import { useMediaQuery } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { useHubState, setActiveHub } from "@/composables/useHubState";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";
import { useNotificationBadge } from "~/composables/useNotificationBadge";
import { useInvites } from "@/composables/useInvites";
import { useQuickQueue } from "~/composables/useQuickQueue";
import {
  useDockIntent,
  DOCK_CLOSE_DELAY_MS,
} from "~/composables/useDockIntent";
import { useFriendArrivals } from "~/composables/useFriendArrivals";
import {
  useDockShortcutPrefs,
  DOCK_SHORTCUT_LIMIT_OPTIONS,
} from "~/composables/useDockShortcutPrefs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { SIDEBAR_MOBILE_QUERY } from "~/components/ui/sidebar/utils";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";
import HubDockItem from "~/components/hub/HubDockItem.vue";
import HubVoiceBar from "~/components/hub/HubVoiceBar.vue";
import { formatBadgeCount } from "~/utilities/badgeCount";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import SocialPanel from "~/components/hub/SocialPanel.vue";
import RecentGamesPanel from "~/components/hub/RecentGamesPanel.vue";
import SidebarChatTab from "~/components/hub/ChatPanel.vue";
import NotificationsPanel from "~/components/hub/NotificationsPanel.vue";
import LobbyPanel from "~/components/hub/LobbyPanel.vue";
import VoicePanel from "~/components/hub/VoicePanel.vue";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoiceChannels } from "~/composables/useVoiceChannels";

const { t } = useI18n();

const {
  setRightSidebarOpen,
  rightSidebarOpen,
  dismissRightSidebar,
  hoverCloseSuspended,
  isPinned,
  togglePin,
} = useRightSidebar();
const { activeHub, openLastOrDefaultHub } = useHubState();

const dockIntent = useDockIntent(() =>
  hubCardRef.value?.getBoundingClientRect(),
);
const {
  tabs: chatTabs,
  unreadCounts,
  activityAt,
  totalUnread,
  activeTabId: activeChatTabId,
  setActiveTab,
} = useChatTabs();
const { hasNotifications, unreadNotificationCount } = useNotificationBadge();
const { lobbyInvites, pendingFriends } = useInvites();
const isMobile = useMediaQuery(SIDEBAR_MOBILE_QUERY);

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

const isPointerInsideHub = ref(false);

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

// Menus and dialogs the hub opens are portaled outside its box, so reaching
// one -- or a modal menu taking the pointer as it opens -- reads as leaving.
// The close waits them out, then goes by where the pointer really is: no
// mouseenter fires when a menu closes over the hub until the pointer moves.
const HUB_OVERLAY =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function overlayOpen() {
  return Array.from(document.querySelectorAll(HUB_OVERLAY)).some(
    (overlay) => overlay.getAttribute("data-state") === "open",
  );
}

function pointerOverHub() {
  const at = dockIntent.pointer();
  const box = hubLayerRef.value?.getBoundingClientRect();
  return (
    !!at &&
    !!box &&
    at.x >= box.left &&
    at.x <= box.right &&
    at.y >= box.top &&
    at.y <= box.bottom
  );
}

function queueHoverClose() {
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (!canDismiss()) return;
    if (overlayOpen()) {
      queueHoverClose();
      return;
    }
    if (!hoverCloseSuspended.value && !composerBusy() && !pointerOverHub()) {
      dismissRightSidebar();
    }
  }, DOCK_CLOSE_DELAY_MS);
}

// Opening starts from an icon the pointer settles on (hoverOpen below), not
// from touching the dock, so brushing past it on the way to a scrollbar opens
// nothing. Leaving closes it unless it is pinned or holds a half-typed message.
function onMouseEnter() {
  isPointerInsideHub.value = true;
  clearCloseTimer();
}

function onMouseLeave(event: MouseEvent) {
  isPointerInsideHub.value = false;
  if (isMobile.value) return;
  dockIntent.clearClick();

  const nextTarget = event.relatedTarget;
  if (
    hoverCloseSuspended.value ||
    (nextTarget instanceof Element &&
      nextTarget.closest("[data-right-hub-interactive]") &&
      !nextTarget.closest(HUB_OVERLAY))
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

  queueHoverClose();
});

// Clicking anywhere else puts the hub away, the way a popover goes. Menus and
// dialogs it opened count as part of it, and so do the outside controls that
// toggle it (marked data-right-hub-interactive), which close it themselves.
function isPartOfHub(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return (
    !!hubLayerRef.value?.contains(target) ||
    !!target.closest(`[data-right-hub-interactive], ${HUB_OVERLAY}`)
  );
}

function canDismiss() {
  return rightSidebarOpen.value && !isPinned.value && !isMobile.value;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!canDismiss() || hoverCloseSuspended.value) return;
  if (isPartOfHub(event.target)) return;
  clearCloseTimer();
  dismissRightSidebar();
}

// Escape from inside the hub (or from nowhere in particular) closes it and
// hands focus back to the open app's icon, so the keyboard isn't left on a
// hidden panel.
function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || !canDismiss()) {
    return;
  }
  const target = event.target;
  const inCard =
    target instanceof Node && !!hubCardRef.value?.contains(target);
  const inLayer =
    target instanceof Node && !!hubLayerRef.value?.contains(target);
  if (!inLayer && target !== document.body) return;
  dismissRightSidebar();
  if (inCard) {
    hubLayerRef.value
      ?.querySelector<HTMLElement>("nav button[aria-current]")
      ?.focus();
  }
}

// Tabbing out of the hub is the keyboard's version of the pointer leaving.
function onFocusOut(event: FocusEvent) {
  if (!canDismiss() || isPointerInsideHub.value) return;
  if (!(event.relatedTarget instanceof Element)) return;
  if (isPartOfHub(event.relatedTarget)) return;
  dismissRightSidebar();
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onDocumentKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  document.removeEventListener("keydown", onDocumentKeydown);
});

// Pinning a closed hub opens it on the app you used last.
function onPinClick() {
  togglePin();
  if (isPinned.value && !activeHub.value) openLastOrDefaultHub();
}

function isHubActive(hub: string) {
  return activeHub.value === hub && rightSidebarOpen.value;
}

type HubName = Parameters<typeof setActiveHub>[0];

// Resting on an icon opens that app, or switches to it when the hub is open.
// A click does the same without waiting for the pointer to settle -- it never
// holds the hub open or closes it; the pin does the holding.
const hubLayerRef = ref<HTMLElement | null>(null);
const hubCardRef = ref<HTMLElement | null>(null);

// A message half-typed in the open panel holds the hub where it is: hover
// never switches away from it and leaving never closes it. A click, a click
// outside or Escape still do.
function composerBusy() {
  const el = document.activeElement;
  if (
    !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) ||
    !hubCardRef.value?.contains(el)
  ) {
    return false;
  }
  return el.value.trim().length > 0;
}

function showHub(hub: HubName) {
  setActiveHub(hub);
  if (!rightSidebarOpen.value) setRightSidebarOpen(true);
}

function hoverOpen(hub: HubName) {
  if (dockIntent.shouldHold(hub, () => hoverOpen(hub))) return;
  if (hub === "voice" && !voiceAvailable.value) return;
  if (rightSidebarOpen.value && (activeHub.value === hub || composerBusy())) {
    return;
  }
  showHub(hub);
}

function clickHub(hub: HubName) {
  dockIntent.noteClick();
  if (hub === "voice" && !voiceAvailable.value) return;
  showHub(hub);
}

// Inbox: anything waiting on an answer.
const inboxBadge = computed(() =>
  hasNotifications.value
    ? formatBadgeCount(unreadNotificationCount.value)
    : null,
);

// Party: invites need an answer (red); being in a party is a state (amber dot);
// queueing puts the search clock under the icon so it reads from anywhere.
const matchmakingStore = useMatchmakingStore();
const lobbyInviteCount = computed(() => lobbyInvites.value?.length ?? 0);
const lobbyMemberCount = computed(() => {
  const lobby = matchmakingStore.currentLobby as any;
  if (!lobby) return 0;
  return (lobby.players ?? []).filter((p: any) => p.status !== "Invited")
    .length;
});
const { queue: queueDetails, clock: queueClock } = useQuickQueue();
const partyDetail = computed(() => {
  if (queueDetails.value) {
    return queueClock.value
      ? t("layouts.hub.dock.searching_for", { time: queueClock.value })
      : t("layouts.hub.dock.searching");
  }
  if (lobbyInviteCount.value > 0) {
    return t("layouts.hub.dock.party_invites", {
      count: lobbyInviteCount.value,
    });
  }
  if (lobbyMemberCount.value > 0) {
    return t("layouts.hub.dock.in_party", { count: lobbyMemberCount.value });
  }
  return t("layouts.hub.dock.start_party");
});

// Voice: green while you are in a call. With no call running and nothing to
// join, the icon disables itself -- and if the hub is sitting on it when the
// last channel disappears, it moves to the party.
const { session: voiceSession } = useActiveVoiceChannel();
const voiceMemberCount = computed(
  () =>
    (voiceSession.value?.participants ?? []).filter(
      (participant) => participant.connected,
    ).length,
);
const inVoice = computed(() => !!voiceSession.value);
const voiceSpeaking = computed(() =>
  (voiceSession.value?.participants ?? []).some(
    (participant) => participant.speaking,
  ),
);
const { channels: voiceChannels } = useVoiceChannels();
const voiceAvailable = computed(
  () => inVoice.value || voiceChannels.value.length > 0,
);
watch(
  [voiceAvailable, activeHub],
  ([available, hub]) => {
    if (!available && hub === "voice") {
      setActiveHub("lobby");
    }
  },
  { immediate: true },
);
const voiceDetail = computed(() => {
  if (voiceSession.value) {
    return t("layouts.hub.dock.in_call", {
      channel: voiceSession.value.label,
      count: voiceMemberCount.value,
    });
  }
  return voiceAvailable.value
    ? t("layouts.hub.dock.channels_open", {
        count: voiceChannels.value.length,
      })
    : t("layouts.hub.dock.voice_unavailable");
});

// Chat, plus the most recently active conversations tucked under it: up to
// three people and two rooms by default, per browser. Pinned ones always stay;
// read ones stay while recently active; a dismissed one returns only when it
// has something newer. The party and match rooms are left out: the Party icon
// and the match page are their homes.
const RECENT_ACTIVITY_MS = 24 * 60 * 60 * 1000;
const {
  prefs: dockPrefs,
  setLimit: setShortcutLimit,
  isPinned: isShortcutPinned,
  togglePin: toggleShortcutPin,
  dismiss: dismissShortcut,
  hide: hideShortcut,
  showHidden: showHiddenShortcuts,
} = useDockShortcutPrefs();

const chatShortcuts = computed(() => {
  const cutoff = Date.now() - RECENT_ACTIVITY_MS;
  const { pinned, dismissed, hidden, maxPeople, maxRooms } = dockPrefs.value;
  const activity = (tab: ChatTab) => activityAt.value[tab.id] ?? 0;
  const isPinnedTab = (tab: ChatTab) => pinned.includes(tab.id);

  const candidates = chatTabs.value.filter(
    (tab) =>
      tab.type !== "match" &&
      tab.type !== "match_team" &&
      !tab.id.startsWith("matchmaking:") &&
      !hidden.includes(tab.id) &&
      (isPinnedTab(tab) ||
        (((unreadCounts.value[tab.id] ?? 0) > 0 || activity(tab) > cutoff) &&
          activity(tab) > (dismissed[tab.id] ?? 0))),
  );

  // Pins first and always; the rest fill whatever room the limit leaves.
  function pick(list: ChatTab[], max: number) {
    const sorted = [...list].sort(
      (a, b) =>
        Number(isPinnedTab(b)) - Number(isPinnedTab(a)) ||
        activity(b) - activity(a),
    );
    const pins = sorted.filter(isPinnedTab);
    const rest = sorted.filter((tab) => !isPinnedTab(tab));
    return [...pins, ...rest.slice(0, Math.max(0, max - pins.length))];
  }

  return [
    ...pick(
      candidates.filter((tab) => tab.type === "direct"),
      maxPeople,
    ),
    ...pick(
      candidates.filter((tab) => tab.type !== "direct"),
      maxRooms,
    ),
  ];
});

// Every unread message is counted once: on its shortcut when it has one, and
// only what is left over -- conversations not on the dock -- on Chat itself.
const shortcutUnread = computed(() =>
  chatShortcuts.value.reduce(
    (sum, tab) => sum + (unreadCounts.value[tab.id] ?? 0),
    0,
  ),
);
const chatLeftoverUnread = computed(() =>
  Math.max(0, totalUnread.value - shortcutUnread.value),
);

function shortcutIcon(tab: ChatTab) {
  if (tab.type === "organizers" || tab.type === "tournament") return Megaphone;
  if (tab.id.startsWith("matchmaking:")) return Merge;
  if (tab.type === "match") return Swords;
  return null;
}

function shortcutDetail(tab: ChatTab) {
  const unread = unreadCounts.value[tab.id] ?? 0;
  if (unread > 0) {
    return t("layouts.hub.dock.unread", { count: unread });
  }
  if (tab.type === "direct") return t("chat_room_subtitles.direct");
  if (tab.type === "organizers") return t("chat_room_subtitles.organizers");
  if (tab.type === "tournament") return t("chat_room_subtitles.tournament");
  if (tab.type === "team") return t("chat_room_subtitles.team");
  return null;
}

function shortcutInitials(tab: ChatTab) {
  return tab.label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function openChatTab(tab: ChatTab) {
  dockIntent.noteClick();
  setActiveTab(tab.id);
  showHub("chat");
}

function hoverOpenChat(tab: ChatTab) {
  if (dockIntent.shouldHold(undefined, () => hoverOpenChat(tab))) return;
  if (rightSidebarOpen.value && composerBusy()) return;
  setActiveTab(tab.id);
  showHub("chat");
}

// Friends: a request needs an answer and replaces the online count until it
// is answered -- one signal per icon.
const onlineFriendsCount = computed(
  () => (matchmakingStore.onlineFriends ?? []).length,
);
const friendRequestCount = computed(() => pendingFriends.value?.length ?? 0);
// Friends who came online since you last looked: bright rather than red --
// worth a glance, not an answer. One arrival shows their face; more show the
// online count in white.
const { newlyOnline } = useFriendArrivals();
const apiDomain = useRuntimeConfig().public.apiDomain as string;
const arrivalFace = computed(() => {
  if (friendRequestCount.value > 0 || newlyOnline.value.length !== 1) {
    return null;
  }
  const friend = (matchmakingStore.onlineFriends ?? []).find(
    (candidate: any) => String(candidate.steam_id) === newlyOnline.value[0],
  );
  if (!friend) return null;
  return {
    key: String(friend.steam_id),
    name: friend.name as string,
    src: resolveAvatarUrl(friend.avatar_url, apiDomain),
    initials: (friend.name ?? "?").slice(0, 2).toUpperCase(),
  };
});
// Rings the Friends badge once each time someone new arrives.
const arrivalPulse = ref(0);
watch(
  () => newlyOnline.value.length,
  (count, previous) => {
    if (count > (previous ?? 0)) arrivalPulse.value += 1;
  },
);
const friendsDetail = computed(() => {
  if (friendRequestCount.value > 0) {
    return t("layouts.hub.dock.friend_requests", {
      count: friendRequestCount.value,
    });
  }
  if (arrivalFace.value) {
    return t("layouts.hub.dock.friend_just_online", {
      name: arrivalFace.value.name,
    });
  }
  if (newlyOnline.value.length > 0) {
    return t("layouts.hub.dock.just_online", {
      count: newlyOnline.value.length,
    });
  }
  return t("layouts.hub.dock.online", { count: onlineFriendsCount.value });
});

// The panel the card shows. Closing the hub clears activeHub, but the card is
// still fading out at that moment -- keep showing what it held until it is gone
// instead of blanking it mid-transition.
const shownHub = ref(activeHub.value);
watch(activeHub, (hub) => {
  if (hub) shownHub.value = hub;
});

// Desktop layout. The dock never moves; the card slides and fades beside it on
// transform and opacity alone, floating over the page -- opening the hub never
// changes the content's width. The one exception is pinning: a pinned hub
// makes room for itself, in one step when it opens, and gives it back only
// once the card has finished leaving.
const DOCK_SPACE = 84;
const OPEN_SPACE = 448;
const pushesContent = computed(() => !isMobile.value && isPinned.value);
const cardShown = ref(rightSidebarOpen.value);
const reservedWidth = computed(
  () => `${pushesContent.value && cardShown.value ? OPEN_SPACE : DOCK_SPACE}px`,
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

const hubPanels = [
  { name: "notifications", component: NotificationsPanel },
  { name: "lobby", component: LobbyPanel },
  { name: "voice", component: VoicePanel },
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

const dockButtonClass =
  "grid size-8 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";

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
  <!-- Phones get the sheet; desktop gets its own fixed layer so nothing about
       opening the hub animates layout. -->
  <component
    :is="isMobile ? Sidebar : 'div'"
    v-bind="
      isMobile
        ? { collapsible: 'icon', side: 'right', variant: 'inset' }
        : { class: 'relative shrink-0', style: { width: reservedWidth } }
    "
  >
    <div
      :class="
        isMobile
          ? 'flex h-full gap-2 p-2'
          : 'fixed bottom-0 right-0 z-20 flex gap-3 p-3'
      "
      ref="hubLayerRef"
      :style="isMobile ? undefined : { top: 'var(--header-height)' }"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @focusout="onFocusOut"
    >
      <!-- The open app, as a card floating beside the dock. -->
      <Transition
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-[opacity,transform] [transition-duration:160ms] ease-in will-change-transform motion-reduce:![transition-duration:1ms]"
        enter-from-class="translate-x-3 opacity-0"
        leave-to-class="translate-x-3 opacity-0"
        @before-enter="cardShown = true"
        @after-leave="cardShown = false"
      >
        <div
          v-show="rightSidebarOpen"
          ref="hubCardRef"
          class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-sidebar shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)]"
          :class="isMobile ? 'flex-1' : 'w-[352px]'"
          @touchstart.passive="onHubTouchStart"
          @touchend="onHubTouchEnd"
        >
          <div class="relative min-h-0 flex-1">
            <!-- Switching apps is instant: with hover switching it happens
                 constantly, and a fade between panels reads as lag. The card's
                 own open/close keeps its motion. -->
            <template v-for="hub in hubPanels" :key="hub.name">
              <div
                v-if="mountedHubs[hub.name]"
                v-show="shownHub === hub.name"
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
            </template>
          </div>

          <!-- The call, under every tab but Voice itself. -->
          <HubVoiceBar
            v-if="shownHub !== 'voice'"
            @open="showHub('voice')"
          />
        </div>
      </Transition>

      <!-- The dock: every hub is an app, icons only. Resting on one opens it
           and a click opens it at once; neither keeps it -- the pin does. -->
      <nav
        :aria-label="$t('layouts.hub.dock.label')"
        class="relative flex w-[60px] shrink-0 flex-col items-center gap-2.5 rounded-[22px] border border-white/[0.08] bg-[rgba(30,30,34,0.82)] py-3.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl backdrop-saturate-150"
      >
        <button
          v-if="isMobile"
          type="button"
          class="flex items-center justify-center"
          @click="setRightSidebarOpen(!rightSidebarOpen)"
        >
          <MiniDisplay />
        </button>

        <HubDockItem
          :label="$t('layouts.hub.dock.inbox')"
          :detail="
            hasNotifications
              ? $t('layouts.hub.dock.waiting', {
                  count: unreadNotificationCount,
                })
              : $t('layouts.hub.dock.nothing_new')
          "
          :active="isHubActive('notifications')"
          :preview="!isPinned"
          :unread="hasNotifications"
          :badge="inboxBadge"
          @select="clickHub('notifications')"
          @intent="hoverOpen('notifications')"
        >
          <Bell
            class="size-[18px]"
            :class="{ 'animate-bell origin-top': hasNotifications }"
          />
        </HubDockItem>

        <HubDockItem
          :label="$t('layouts.hub.dock.party')"
          :detail="partyDetail"
          :active="isHubActive('lobby')"
          :preview="!isPinned"
          :unread="lobbyInviteCount > 0"
          :badge="
            lobbyInviteCount > 0 ? formatBadgeCount(lobbyInviteCount) : null
          "
          :pip="lobbyMemberCount > 0 || !!queueDetails"
          :caption="queueClock"
          @select="clickHub('lobby')"
          @intent="hoverOpen('lobby')"
        >
          <Tent class="size-[18px]" />
        </HubDockItem>

        <HubDockItem
          :label="$t('layouts.hub.dock.voice')"
          :detail="voiceDetail"
          :active="isHubActive('voice')"
          :preview="!isPinned"
          :disabled="!voiceAvailable"
          :tone="inVoice ? 'voice' : 'default'"
          :ring="voiceSpeaking"
          :badge="inVoice ? formatBadgeCount(voiceMemberCount) : null"
          badge-tone="neutral"
          @select="clickHub('voice')"
          @intent="hoverOpen('voice')"
        >
          <Mic class="size-[18px]" />
        </HubDockItem>

        <div
          class="relative flex w-full flex-col items-center gap-2.5"
          :class="
            chatShortcuts.length
              ? 'py-1 before:pointer-events-none before:absolute before:inset-x-1.5 before:inset-y-0 before:rounded-[20px] before:bg-white/[0.04] before:ring-1 before:ring-inset before:ring-white/[0.05]'
              : ''
          "
        >
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <HubDockItem
                :nested="chatShortcuts.length > 0"
                :label="$t('layouts.hub.dock.chat')"
                :detail="
                  totalUnread > 0
                    ? $t('layouts.hub.dock.unread', { count: totalUnread })
                    : $t('layouts.hub.dock.nothing_new')
                "
                :active="isHubActive('chat')"
                :preview="!isPinned"
                :unread="chatLeftoverUnread > 0"
                :badge="
                  chatLeftoverUnread > 0
                    ? formatBadgeCount(chatLeftoverUnread)
                    : null
                "
                @select="clickHub('chat')"
                @intent="hoverOpen('chat')"
              >
                <MessageSquare class="size-[18px]" />
              </HubDockItem>
            </ContextMenuTrigger>
            <ContextMenuContent class="w-56" data-right-hub-interactive>
              <ContextMenuLabel class="text-xs font-medium text-muted-foreground">
                {{ $t("layouts.hub.dock.on_the_dock") }}
              </ContextMenuLabel>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {{ $t("layouts.hub.dock.people") }}
                  <span class="ml-auto pl-3 text-xs text-muted-foreground">
                    {{ dockPrefs.maxPeople }}
                  </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent data-right-hub-interactive>
                  <ContextMenuRadioGroup
                    :model-value="String(dockPrefs.maxPeople)"
                    @update:model-value="
                      (value: any) => setShortcutLimit('people', Number(value))
                    "
                  >
                    <ContextMenuRadioItem
                      v-for="count in DOCK_SHORTCUT_LIMIT_OPTIONS"
                      :key="count"
                      :value="String(count)"
                    >
                      {{ count }}
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {{ $t("layouts.hub.dock.rooms") }}
                  <span class="ml-auto pl-3 text-xs text-muted-foreground">
                    {{ dockPrefs.maxRooms }}
                  </span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent data-right-hub-interactive>
                  <ContextMenuRadioGroup
                    :model-value="String(dockPrefs.maxRooms)"
                    @update:model-value="
                      (value: any) => setShortcutLimit('rooms', Number(value))
                    "
                  >
                    <ContextMenuRadioItem
                      v-for="count in DOCK_SHORTCUT_LIMIT_OPTIONS"
                      :key="count"
                      :value="String(count)"
                    >
                      {{ count }}
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <template v-if="dockPrefs.hidden.length">
                <ContextMenuSeparator />
                <ContextMenuItem @select="showHiddenShortcuts()">
                  {{
                    $t("layouts.hub.dock.show_hidden", {
                      count: dockPrefs.hidden.length,
                    })
                  }}
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
          </ContextMenu>

          <TransitionGroup
            tag="div"
            class="flex w-full flex-col items-center gap-2.5"
            enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
            leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
            enter-from-class="opacity-0 -translate-y-1"
            leave-to-class="opacity-0"
          >
            <div v-for="tab in chatShortcuts" :key="tab.id" class="w-full">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <HubDockItem
                    avatar
                    nested
                    :label="tab.label"
                    :detail="shortcutDetail(tab)"
                    :current="isHubActive('chat') && activeChatTabId === tab.id"
                    :unread="(unreadCounts[tab.id] ?? 0) > 0"
                    :badge="
                      (unreadCounts[tab.id] ?? 0) > 0
                        ? formatBadgeCount(unreadCounts[tab.id])
                        : null
                    "
                    @select="openChatTab(tab)"
                    @intent="hoverOpenChat(tab)"
                  >
                    <img
                      v-if="tab.type === 'direct' && tab.avatarUrl"
                      :src="tab.avatarUrl"
                      :alt="tab.label"
                      draggable="false"
                      class="size-full select-none object-cover"
                    />
                    <span
                      v-else
                      class="grid size-full place-items-center bg-[linear-gradient(140deg,#3f3f46,#1f1f23)] text-[0.65rem] font-semibold text-zinc-200"
                    >
                      <component
                        :is="shortcutIcon(tab)"
                        v-if="shortcutIcon(tab)"
                        class="size-3.5"
                      />
                      <template v-else>{{ shortcutInitials(tab) }}</template>
                    </span>
                  </HubDockItem>
                </ContextMenuTrigger>
                <ContextMenuContent class="w-52" data-right-hub-interactive>
                  <ContextMenuItem @select="toggleShortcutPin(tab.id)">
                    {{
                      isShortcutPinned(tab.id)
                        ? $t("layouts.hub.dock.unpin_shortcut")
                        : $t("layouts.hub.dock.pin_shortcut")
                    }}
                  </ContextMenuItem>
                  <ContextMenuItem @select="dismissShortcut(tab.id)">
                    {{ $t("layouts.hub.dock.remove_shortcut") }}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem @select="hideShortcut(tab.id)">
                    {{ $t("layouts.hub.dock.hide_shortcut") }}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </TransitionGroup>
        </div>

        <HubDockItem
          :label="$t('layouts.hub.dock.friends')"
          :detail="friendsDetail"
          :active="isHubActive('social')"
          :preview="!isPinned"
          :unread="friendRequestCount > 0 || newlyOnline.length > 0"
          :face="arrivalFace"
          :announce="arrivalPulse"
          :badge="
            friendRequestCount > 0
              ? formatBadgeCount(friendRequestCount)
              : onlineFriendsCount > 0
                ? formatBadgeCount(onlineFriendsCount)
                : null
          "
          :badge-tone="
            friendRequestCount > 0
              ? 'red'
              : newlyOnline.length > 0
                ? 'fresh'
                : 'neutral'
          "
          @select="clickHub('social')"
          @intent="hoverOpen('social')"
        >
          <Users class="size-[18px]" />
        </HubDockItem>

        <HubDockItem
          :label="$t('layouts.hub.dock.matches')"
          :active="isHubActive('recent-games')"
          :preview="!isPinned"
          @select="clickHub('recent-games')"
          @intent="hoverOpen('recent-games')"
        >
          <History class="size-[18px]" />
        </HubDockItem>

        <div class="flex-1" />

        <!-- Pin: the only way to keep the hub open. -->
        <button
          v-if="!isMobile"
          type="button"
          :aria-label="$t('layouts.hub.dock.pin')"
          :aria-pressed="isPinned"
          :class="[
            dockButtonClass,
            isPinned ? 'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]' : '',
          ]"
          @click="onPinClick"
        >
          <Pin
            class="size-3.5 transition-transform"
            :class="isPinned ? 'rotate-0' : 'rotate-45'"
          />
        </button>

      </nav>
    </div>
  </component>
</template>
