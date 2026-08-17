<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import {
  Megaphone,
  Merge,
  Sword,
  MessageSquare,
  ExternalLink,
  X,
} from "lucide-vue-next";
import { useRouter } from "#app";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";
import { cancelChatTabRestore } from "~/composables/useChatTabPersistence";
import { useDirectConversationBar } from "~/composables/useDirectConversationBar";
import { directTabId } from "~/composables/useDirectMessages";
import { hapticTap } from "~/utilities/haptics";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import TooltipProvider from "~/components/ui/tooltip/TooltipProvider.vue";
import TooltipTrigger from "~/components/ui/tooltip/TooltipTrigger.vue";
import TooltipContent from "~/components/ui/tooltip/TooltipContent.vue";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { matchTeamLobbyId } from "~/utilities/matchTeamLobby";
import socket from "~/web-sockets/Socket";

const props = defineProps<{
  isSidebarOpen: boolean;
  isTabActive: boolean;
}>();

const { t } = useI18n();
const router = useRouter();

const { tabs, unreadCounts, activeTabId, setActiveTab, resetUnread, closeTab } =
  useChatTabs();
const { remove, reorder, directRoomIds } = useDirectConversationBar();

const matchLobbyStore = useMatchLobbyStore();
const isMobile = useMediaQuery("(max-width: 768px)");

// A match tab is a room, and one side of that match is a second room the tab
// never offered -- so team chat used to exist on the match page and vanish the
// moment you read the same match here. Derived rather than stored on the tab so
// it follows a lineup change without the tab being rebuilt.
function teamLobbyIdFor(tab: ChatTab) {
  if (tab.type !== "match") {
    return undefined;
  }

  const match = (matchLobbyStore.myMatches as unknown as any[])?.find(
    (candidate) => candidate.id === tab.lobbyId,
  );

  return matchTeamLobbyId(match, useAuthStore().me?.steam_id);
}

const activeChatId = ref<string | null>(null);

const orderedTabs = computed<ChatTab[]>(() => {
  // Your own rooms first. Organizer and tournament rooms are broadcast
  // channels, so landing on one by default put the least personal room in
  // front of the lobby you are actually in. Conversations are not channels at
  // all, so they sit below every channel behind a divider.
  const weight = (tab: ChatTab) => {
    if (tab.id.startsWith("matchmaking:")) return 0;
    if (tab.type === "match") return 1;
    if (tab.type === "direct") return 3;
    return 2;
  };
  return [...tabs.value].sort((a, b) => {
    const wa = weight(a);
    const wb = weight(b);
    if (wa !== wb) return wa - wb;
    // Conversations sit in the order the player dragged them into; channels
    // are not arrangeable and stay alphabetical.
    if (a.type === "direct" && b.type === "direct") {
      return (a.position ?? 0) - (b.position ?? 0);
    }
    return a.label.localeCompare(b.label);
  });
});

// The divider only earns its place when there are channels above it.
const firstDirectTabId = computed(() => {
  const index = orderedTabs.value.findIndex((tab) => tab.type === "direct");
  return index > 0 ? orderedTabs.value[index].id : null;
});

const activeTab = computed<ChatTab | null>(() => {
  if (!activeChatId.value) return null;
  return orderedTabs.value.find((t) => t.id === activeChatId.value) || null;
});

const activeParticipantsCount = computed(() => {
  const tab = activeTab.value;
  if (!tab) return 0;
  const key = `${tab.type}:${tab.lobbyId}`;
  const map = matchLobbyStore.lobbyChat[key] as
    | Map<string, { steam_id: string; name: string; avatar_url?: string }>
    | undefined;
  if (!map) return 0;
  return map.size;
});

const activeParticipants = computed<
  { steam_id: string; name: string; avatar_url?: string }[]
>(() => {
  const tab = activeTab.value;
  if (!tab) return [];
  const key = `${tab.type}:${tab.lobbyId}`;
  const map = matchLobbyStore.lobbyChat[key] as
    | Map<string, { steam_id: string; name: string; avatar_url?: string }>
    | undefined;
  if (!map) return [];
  return Array.from(map.values());
});

const isParticipantsOpen = ref(false);

// Animated indicator for channel rail
const chatRailRef = ref<HTMLElement | null>(null);
const chatButtonRefs = ref<Record<string, HTMLElement | null>>({});
const chatIndicatorY = ref(0);
const chatIndicatorHeight = ref(0);
const chatHasAnimated = ref(false);

function setChatButtonRef(id: string) {
  return (el: any) => {
    chatButtonRefs.value[id] = el as HTMLElement | null;
  };
}

function updateChatIndicator() {
  const rail = chatRailRef.value;
  if (!rail || !activeChatId.value) return;
  const btn = chatButtonRefs.value[activeChatId.value];
  if (!btn) {
    chatIndicatorHeight.value = 0;
    chatHasAnimated.value = false;
    return;
  }
  const railRect = rail.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  chatIndicatorY.value = btnRect.top - railRect.top;
  chatIndicatorHeight.value = btnRect.height;
  nextTick(() => {
    chatHasAnimated.value = true;
  });
}

watch(activeChatId, () => nextTick(updateChatIndicator));
watch(orderedTabs, () => nextTick(updateChatIndicator), { flush: "post" });
onMounted(() => nextTick(updateChatIndicator));

watch(activeChatId, () => {
  isParticipantsOpen.value = false;
});

const showChatIndicator = computed(
  () => activeChatId.value && chatIndicatorHeight.value > 0,
);

// Default to first room when panel becomes active with no selection
watch(
  () => props.isTabActive,
  (active) => {
    if (active && !activeChatId.value && orderedTabs.value.length > 0) {
      handleSelectRoom(orderedTabs.value[0]);
    }
  },
);

// Auto-select first room; handle removed active room
watch(
  orderedTabs,
  (tabs) => {
    if (activeChatId.value && !tabs.find((t) => t.id === activeChatId.value)) {
      const next = tabs[0] ?? null;
      activeChatId.value = next?.id ?? null;
    }
    if (!activeChatId.value && tabs.length > 0) {
      handleSelectRoom(tabs[0]);
    }
  },
  { immediate: true },
);

// Anything else that opens a room -- a Message button, "join match chat" --
// goes through useChatTabs, so the panel has to follow it. It used to render
// purely from its own local ref, which is why those buttons opened the hub on
// whatever room happened to be showing.
watch(
  activeTabId,
  (id) => {
    if (id && orderedTabs.value.some((tab) => tab.id === id)) {
      activeChatId.value = id;
    }
  },
  { immediate: true },
);

// Clears the badge for a room that is genuinely on screen. The auto-select
// watch above only fires when nothing is selected yet, so a room that was
// already open kept its badge no matter how long you looked at it.
watch(
  [() => props.isTabActive, () => props.isSidebarOpen, activeChatId],
  ([tabActive, sidebarOpen, id]) => {
    if (!tabActive || !sidebarOpen || !id) {
      return;
    }

    resetUnread(id);

    // Every room carries server-side read state, not just conversations, so
    // the badge doesn't come back on the next device or reload -- and so a
    // push isn't sent for a message that has already been read here.
    const tab = orderedTabs.value.find((entry) => entry.id === id);
    if (tab) {
      socket.markLobbyRead(tab.type, tab.lobbyId);
    }
  },
  { immediate: true },
);

// Dragging a conversation around the rail.
//
// Pointer events rather than HTML5 drag-and-drop, and rather than a sortable
// library. HTML5 drag never fires on touch at all, and its drop target is
// whatever element happens to be under the cursor -- which left dead zones
// between the buttons where a drop did nothing and, worse, a drag that came
// back onto the rail through one of those gaps still counted as "dropped
// outside" and removed the conversation.
//
// Here the rail itself is the drop target and the slot is worked out from the
// pointer's position, so there is nowhere on it that does not resolve to a
// slot.
const draggingRoomId = ref<string | null>(null);
// Where the dragged conversation would land, as an index into the rail's
// conversations. Null while the pointer is off the rail.
const dropIndex = ref<number | null>(null);
const dropOutside = ref(false);
// iOS's editing mode: long-press, everything wiggles, and each conversation
// grows a badge to remove it. Touch only -- a mouse has a right button.
const wiggling = ref(false);

const LONG_PRESS_MS = 450;
// Enough that a tap or a scroll is never mistaken for the start of a drag.
const DRAG_SLOP_PX = 8;
// How far past the rail counts as taking the conversation off it. The rail is
// 64px wide around a 44px button, so the bare edge leaves about ten pixels of
// slack -- far too little between "reordering" and "removing".
const REMOVE_MARGIN_PX = 32;

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressOrigin: { x: number; y: number } | null = null;
let pressRoomId: string | null = null;
let pressIsTouch = false;
// Set once a drag actually starts, so the click that follows the release does
// not also select the room.
let suppressClick = false;

function directTabsInOrder(): ChatTab[] {
  return orderedTabs.value.filter((tab) => tab.type === "direct");
}

// Drawn absolutely rather than as an element between the buttons: an inline
// indicator adds its own height to the rail, which moves every button below it
// and so moves the midpoints this is measured against -- the slot flickers
// between two values as the pointer sits still.
const dropIndicatorY = ref(0);

// Which slot the pointer is over, by comparing against each conversation's
// midpoint. Returns null when the pointer is off the rail entirely, which is
// what removal is judged on.
function slotAt(clientX: number, clientY: number): number | null {
  const rail = chatRailRef.value;

  if (!rail) {
    return null;
  }

  const bounds = rail.getBoundingClientRect();

  if (
    clientX < bounds.left - REMOVE_MARGIN_PX ||
    clientX > bounds.right + REMOVE_MARGIN_PX ||
    clientY < bounds.top - REMOVE_MARGIN_PX ||
    clientY > bounds.bottom + REMOVE_MARGIN_PX
  ) {
    return null;
  }

  const tabs = directTabsInOrder();
  // Absolutely positioned children of a scrolling container are placed against
  // the content box, so a viewport delta has to have the scroll added back.
  const toContentY = (viewportY: number) =>
    viewportY - bounds.top + rail.scrollTop;

  let lastBottom = 0;

  for (const [index, tab] of tabs.entries()) {
    const button = chatButtonRefs.value[tab.id];

    if (!button) {
      continue;
    }

    const rect = button.getBoundingClientRect();
    lastBottom = rect.bottom;

    if (clientY < rect.top + rect.height / 2) {
      dropIndicatorY.value = toContentY(rect.top) - 3;
      return index;
    }
  }

  // Below the last conversation. The channels above resolve through the loop
  // instead -- the first conversation's midpoint is beneath them, so a pointer
  // up there lands in the top slot rather than nowhere.
  dropIndicatorY.value = lastBottom ? toContentY(lastBottom) + 1 : 0;

  return tabs.length;
}

function beginDrag(roomId: string) {
  draggingRoomId.value = roomId;
  suppressClick = true;
}

function handlePointerDown(tab: ChatTab, event: PointerEvent) {
  if (tab.type !== "direct" || event.button !== 0) {
    return;
  }

  pressRoomId = tab.lobbyId;
  pressOrigin = { x: event.clientX, y: event.clientY };
  pressIsTouch = event.pointerType !== "mouse";

  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);

  // Already in editing mode, so the press has been paid for once and every
  // conversation is grabbable straight away -- the same as a mouse.
  if (!pressIsTouch || wiggling.value) {
    return;
  }

  // Touch waits for the press. Grabbing on the first move instead would mean
  // the rail could never be scrolled.
  pressTimer = setTimeout(() => {
    pressTimer = null;

    // The press may have been released or cancelled while this was pending.
    if (!pressRoomId || draggingRoomId.value) {
      return;
    }

    wiggling.value = true;
    // The press is what enters editing mode, and nothing on screen has moved
    // yet -- the tap back is the only thing telling the player it worked.
    hapticTap();
    beginDrag(pressRoomId);
  }, LONG_PRESS_MS);
}

function handlePointerMove(event: PointerEvent) {
  if (!pressRoomId) {
    return;
  }

  const moved =
    pressOrigin &&
    Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) >
      DRAG_SLOP_PX;

  if (!draggingRoomId.value) {
    if (!moved) {
      return;
    }

    // Moving before the press completed is a scroll, not a drag.
    if (pressIsTouch && !wiggling.value) {
      return cancelPress();
    }

    beginDrag(pressRoomId);
  }

  // Held once dragging: otherwise the rail scrolls out from under the drag on
  // touch, and the browser paints a text selection on desktop.
  event.preventDefault();

  dropIndex.value = slotAt(event.clientX, event.clientY);
  dropOutside.value = dropIndex.value === null;
}

function handlePointerUp() {
  const dragged = draggingRoomId.value;

  if (!dragged) {
    return cancelPress();
  }

  if (dropOutside.value) {
    removeConversation(dragged);
  } else if (dropIndex.value !== null) {
    moveConversation(dragged, dropIndex.value);
  }

  cancelPress();
}

function cancelPress() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  pressRoomId = null;
  pressOrigin = null;
  draggingRoomId.value = null;
  dropIndex.value = null;
  dropOutside.value = false;

  // Deferred, or the click that follows a release selects whichever room the
  // pointer ended up over. Cleared here rather than on release alone: a drag
  // the browser takes over ends in pointercancel, and a flag left standing
  // swallows every later click on the rail.
  setTimeout(() => {
    suppressClick = false;
  }, 0);
}

function moveConversation(roomId: string, index: number) {
  const order = directRoomIds();
  const from = order.indexOf(roomId);

  if (from === -1) {
    return;
  }

  const [moved] = order.splice(from, 1);
  // Removing the dragged entry shifts everything after it up by one, so a slot
  // below where it started means one less than the raw index.
  order.splice(index > from ? index - 1 : index, 0, moved);

  reorder(order);
}

// Leaving editing mode. A tap anywhere that is not a remove badge ends it, the
// way iOS does.
function stopWiggling() {
  wiggling.value = false;
}

// Anywhere off the rail counts, not just the rail itself -- the message list,
// the header, the page behind the panel. Without this the only way out was to
// tap a conversation, which is the one gesture someone in editing mode is
// trying not to make.
function handleDocumentPointerDown(event: PointerEvent) {
  const rail = chatRailRef.value;
  const target = event.target as Node | null;

  // The rail's own buttons and remove badges handle themselves.
  if (rail && target && rail.contains(target)) {
    return;
  }

  stopWiggling();
}

// Capture phase, so a tap that opens a menu or navigates still drops editing
// mode on the way past. The tap is deliberately not swallowed: eating it would
// cost a deliberate action to undo a mode the user already meant to leave.
watch(wiggling, (editing) => {
  if (!import.meta.client) {
    return;
  }

  if (editing) {
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return;
  }

  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
});

watch(
  () => props.isTabActive && props.isSidebarOpen,
  (open) => {
    if (!open) {
      stopWiggling();
    }
  },
);

function handleRemoveConversation(tab: ChatTab) {
  if (tab.type !== "direct") {
    return;
  }

  removeConversation(tab.lobbyId);
}

function removeConversation(roomId: string) {
  const tabId = directTabId(roomId);
  const wasActive = activeChatId.value === tabId;

  remove(roomId);

  if (wasActive) {
    activeChatId.value = activeTabId.value;
  }
}

function handleSelectRoom(tab: ChatTab) {
  activeChatId.value = tab.id;
  setActiveTab(tab.id);
  resetUnread(tab.id);
}

// Only a click counts as choosing a room -- the auto-select watchers above are
// filling a gap, and must not cancel a pending restore of the stored room.
function handleRoomClick(tab: ChatTab) {
  // The release that ends a drag also fires a click on whatever is underneath.
  if (suppressClick) {
    return;
  }

  // In editing mode a tap is "I am done", not "open this".
  if (wiggling.value) {
    return stopWiggling();
  }

  cancelChatTabRestore();
  handleSelectRoom(tab);
}

function getRoomIcon(tab: ChatTab) {
  if (tab.type === "organizers" || tab.type === "tournament") return Megaphone;
  if (tab.id.startsWith("matchmaking:")) return Merge;
  if (tab.type === "match") return Sword;
  return MessageSquare;
}

function getRoomSubtitle(tab: ChatTab) {
  if (tab.type === "organizers") return t("chat_room_subtitles.organizers");
  if (tab.type === "tournament") return t("chat_room_subtitles.tournament");
  if (tab.id.startsWith("matchmaking:"))
    return t("chat_room_subtitles.matchmaking");
  if (tab.type === "match") return t("chat_room_subtitles.match");
  if (tab.type === "direct") return t("chat_room_subtitles.direct");
  return "";
}

function handleCloseRoom() {
  const tab = activeTab.value;

  if (!tab || tab.type !== "direct") {
    return;
  }

  // Read it server-side on the way out, otherwise hydrate() treats the leftover
  // unread as "something new" and reopens the conversation on the next load.
  socket.markLobbyRead(tab.type, tab.lobbyId);
  closeTab(tab.id);

  // closeTab already picks the neighbouring tab; follow it so the panel isn't
  // left rendering a room that no longer exists.
  activeChatId.value = activeTabId.value;
}

function handlePopOut() {
  const id = activeChatId.value;
  if (!id) return;

  const tab = orderedTabs.value.find((t) => t.id === id);
  if (!tab) return;

  const route = router.resolve({
    name: "chat-tabId",
    params: { tabId: id },
    query: {
      type: tab.type,
      lobbyId: tab.lobbyId,
      instance: tab.instance,
      label: tab.label,
    },
  });

  const w = 420;
  const h = 560;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=yes",
    "location=no",
    "menubar=no",
    "toolbar=no",
    "status=no",
  ].join(",");
  window.open(route.href, "_blank", features);
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left channel rail (compact) -->
    <div
      class="w-16 flex-shrink-0 border-r border-border flex flex-col items-center py-2 gap-1"
    >
      <div
        v-if="orderedTabs.length"
        ref="chatRailRef"
        class="relative flex-1 overflow-y-auto space-y-1 w-full flex flex-col items-center transition-colors"
        :class="[
          dropOutside ? 'bg-destructive/10' : '',
          draggingRoomId ? 'select-none' : '',
        ]"
      >
        <!-- Sliding left accent bar -->
        <div
          v-show="showChatIndicator"
          class="absolute top-0 left-0 w-0.5 rounded-r-full z-10 pointer-events-none bg-[hsl(var(--tac-amber))]"
          :class="
            chatHasAnimated
              ? 'transition-transform [transition-duration:350ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]'
              : ''
          "
          :style="{
            transform: `translateY(${chatIndicatorY + 4}px)`,
            height: `${chatIndicatorHeight - 8}px`,
          }"
        />

        <!-- Where the dragged conversation would land. -->
        <div
          v-if="dropIndex !== null"
          class="pointer-events-none absolute left-1/2 z-20 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[hsl(var(--tac-amber))]"
          :style="{ top: `${dropIndicatorY}px` }"
        />

        <TooltipProvider>
          <template v-for="tab in orderedTabs" :key="tab.id">
            <!-- Folds its 9px open instead of teleporting every button below
                 it while the accent bar is still springing to a position it
                 measured after the shift. -->
            <Transition
              enter-active-class="chat-fold"
              enter-from-class="chat-fold-collapsed"
              leave-active-class="chat-fold"
              leave-to-class="chat-fold-collapsed"
            >
              <div
                v-if="tab.id === firstDirectTabId"
                class="grid w-full shrink-0 grid-rows-[1fr]"
              >
                <div class="min-h-0 flex justify-center">
                  <div class="my-1 h-px w-8 bg-border" />
                </div>
              </div>
            </Transition>
            <!-- ContextMenu wraps the pair: its root renders no element, so
                 it cannot sit under TooltipTrigger's as-child. The two triggers
                 chain onto the one button instead. -->
            <ContextMenu>
              <Tooltip>
                <TooltipTrigger as-child>
                  <ContextMenuTrigger as-child>
                    <button
                      :ref="setChatButtonRef(tab.id)"
                      class="relative z-[1] flex items-center justify-center w-11 h-11 rounded-md transition-colors duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      :class="[
                        activeChatId === tab.id
                          ? 'text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
                        draggingRoomId === tab.lobbyId
                          ? 'opacity-40 scale-95'
                          : '',
                        wiggling && tab.type === 'direct' ? 'chat-wiggle' : '',
                        // Only while editing: the rail has to stay scrollable
                        // by touch the rest of the time.
                        wiggling && tab.type === 'direct' ? 'touch-none' : '',
                      ]"
                      type="button"
                      @click="handleRoomClick(tab)"
                      @pointerdown="handlePointerDown(tab, $event)"
                      @pointermove="handlePointerMove($event)"
                      @pointerup="handlePointerUp"
                      @pointercancel="cancelPress"
                    >
                      <div
                        class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-inherit transition-colors"
                        :class="
                          activeChatId === tab.id
                            ? 'bg-zinc-700'
                            : 'bg-zinc-900/80 group-hover:bg-zinc-700/70'
                        "
                      >
                        <!-- A conversation is a person, not a channel. -->
                        <img
                          v-if="tab.type === 'direct' && tab.avatarUrl"
                          :src="tab.avatarUrl"
                          :alt="tab.label"
                          draggable="false"
                          class="h-full w-full select-none rounded-md object-cover"
                        />
                        <component
                          v-else
                          :is="getRoomIcon(tab)"
                          class="w-3.5 h-3.5"
                        />
                      </div>
                      <span
                        v-if="unreadCounts[tab.id] && !wiggling"
                        class="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] px-1 min-w-[1.05rem] h-4 leading-none"
                      >
                        {{ unreadCounts[tab.id] }}
                      </span>
                      <!-- Editing mode's remove badge, in place of the unread
                           count. The only removal a touch device can reach
                           without a right button. -->
                      <span
                        v-if="wiggling && tab.type === 'direct'"
                        role="button"
                        :aria-label="$t('chat_rail.remove_conversation')"
                        class="absolute -top-1 -left-1 z-[2] inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 shadow"
                        @pointerdown.stop
                        @click.stop="handleRemoveConversation(tab)"
                      >
                        <X class="h-2.5 w-2.5" />
                      </span>
                    </button>
                  </ContextMenuTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  class="bg-zinc-900 text-zinc-50 border border-zinc-800 shadow-lg rounded-md px-3 py-2"
                >
                  <div class="flex flex-col">
                    <span class="text-xs font-medium">
                      {{ tab.label }}
                    </span>
                    <span
                      v-if="getRoomSubtitle(tab)"
                      class="text-[10px] text-zinc-200/80"
                    >
                      {{ getRoomSubtitle(tab) }}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
              <ContextMenuContent v-if="tab.type === 'direct'">
                <ContextMenuItem @select="handleRemoveConversation(tab)">
                  {{ $t("chat_rail.remove_conversation") }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </template>
        </TooltipProvider>
      </div>

      <div v-else class="flex-1" />
    </div>

    <!-- Right chat area. Closing the last conversation dissolves to the empty
         state instead of cutting; both branches fill the column, so a plain
         crossfade is the right tool. -->
    <FadeSwap class="flex-1 min-w-0">
      <div v-if="orderedTabs.length" key="chats" class="h-full flex flex-col">
        <!-- Header with channel title + participants + controls -->
        <div
          class="flex items-center justify-between px-3 py-3 border-b border-border bg-card/30"
        >
          <div class="min-w-0 flex items-center gap-3">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-foreground truncate">
                {{ activeTab?.label || $t("layouts.chat_panel.default_title") }}
              </div>
              <div
                class="flex items-center gap-2 text-[10px] text-muted-foreground truncate"
              >
                <span>
                  {{ activeTab ? getRoomSubtitle(activeTab) : "" }}
                </span>
                <button
                  type="button"
                  class="text-[10px] text-zinc-400 underline-offset-2"
                  :class="
                    activeParticipantsCount
                      ? 'hover:text-zinc-200 hover:underline cursor-pointer'
                      : 'cursor-default opacity-60'
                  "
                  @click="
                    activeParticipantsCount &&
                    (isParticipantsOpen = !isParticipantsOpen)
                  "
                >
                  {{
                    $t("layouts.chat_panel.participants_in_chat", {
                      count: activeParticipantsCount,
                    })
                  }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    v-if="!isMobile"
                    type="button"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    @click="handlePopOut"
                  >
                    <ExternalLink class="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  class="bg-zinc-900 text-zinc-50 border border-zinc-800 shadow-lg rounded-md px-3 py-1.5 text-[11px]"
                >
                  {{ $t("layouts.chat_panel.pop_out_tooltip") }}
                </TooltipContent>
              </Tooltip>

              <!-- Channels are derived from what you are in, so only a
                   conversation is yours to close. -->
              <Tooltip v-if="activeTab?.type === 'direct'">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 transition-colors"
                    @click="handleCloseRoom"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  class="bg-zinc-900 text-zinc-50 border border-zinc-800 shadow-lg rounded-md px-3 py-1.5 text-[11px]"
                >
                  {{ $t("layouts.chat_panel.close_tooltip") }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <!-- Folds open between the header and the scroller instead of
             snatching 33px from the chat body on a frame; the strip's own
             padding and border ride inside the clipped row. -->
        <Transition
          enter-active-class="chat-fold"
          enter-from-class="chat-fold-collapsed"
          leave-active-class="chat-fold"
          leave-to-class="chat-fold-collapsed"
        >
          <div
            v-if="isParticipantsOpen && activeParticipants.length"
            class="shrink-0 grid grid-rows-[1fr]"
          >
            <div class="min-h-0">
              <div
                class="px-3 py-2 border-b border-zinc-800/60 bg-zinc-950/80 text-[11px] text-zinc-200 flex gap-2 overflow-x-auto"
              >
                <div
                  v-for="p in activeParticipants"
                  :key="p.steam_id"
                  class="flex items-center gap-1.5 bg-zinc-900/70 rounded-full px-2 py-0.5"
                >
                  <img
                    v-if="p.avatar_url"
                    :src="p.avatar_url"
                    alt=""
                    class="w-4 h-4 rounded-full object-cover"
                  />
                  <span class="truncate max-w-[8rem]">
                    {{ p.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <div class="flex-1 min-h-0 flex flex-col">
          <ChatLobby
            v-for="tab in tabs"
            :key="tab.id"
            v-show="tab.id === activeChatId"
            :instance="tab.instance"
            :type="tab.type"
            :lobby-id="tab.lobbyId"
            :team-lobby-id="teamLobbyIdFor(tab)"
            :tab-id="tab.id"
            :frameless="true"
            :is-global-context="true"
            :hide-participants-summary="true"
            :disable-auto-focus-on-activate="isMobile"
            :is-active-tab="
              tab.id === activeChatId && isSidebarOpen && isTabActive
            "
          />
        </div>
      </div>
      <div v-else key="empty" class="h-full flex flex-col">
        <Empty>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">
              {{ $t("layouts.chat_panel.no_chats_title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("layouts.chat_panel.no_chats_description") }}
            </p>
          </div>
        </Empty>
      </div>
    </FadeSwap>
  </div>
</template>

<style scoped>
/* Small rail/header inserts fold their height in place; padding and borders
   ride the clipped cell so the collapsed state floors at zero. */
.chat-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.15s ease;
}
.chat-fold > * {
  overflow: hidden;
}
.chat-fold-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
/* Editing mode, the way iOS does it: a small out-of-phase rock, not a spin.
   The offsets keep the pivot from looking mechanical -- every icon rotating in
   lockstep reads as one sheet moving rather than a set of loose tiles. */
.chat-wiggle {
  animation: chat-wiggle 0.24s ease-in-out infinite;
  transform-origin: 50% 50%;
}
.chat-wiggle:nth-child(even) {
  animation-delay: -0.12s;
}
@keyframes chat-wiggle {
  0%,
  100% {
    transform: rotate(-1.4deg);
  }
  50% {
    transform: rotate(1.4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-fold {
    transition-duration: 1ms;
  }
  /* The badge is what says "you can remove this"; the motion is decoration. */
  .chat-wiggle {
    animation: none;
  }
}
</style>
