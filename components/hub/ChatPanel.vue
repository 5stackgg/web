<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import {
  Megaphone,
  Merge,
  Sword,
  Shield,
  MessageSquare,
  ExternalLink,
} from "lucide-vue-next";
import { useRouter } from "#app";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";
import TooltipProvider from "~/components/ui/tooltip/TooltipProvider.vue";
import TooltipTrigger from "~/components/ui/tooltip/TooltipTrigger.vue";
import TooltipContent from "~/components/ui/tooltip/TooltipContent.vue";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const props = defineProps<{
  isSidebarOpen: boolean;
  isTabActive: boolean;
}>();

const { t } = useI18n();
const router = useRouter();

const { tabs, unreadCounts, setActiveTab, resetUnread, incrementUnread } =
  useChatTabs();

const matchLobbyStore = useMatchLobbyStore();
const isMobile = useMediaQuery("(max-width: 768px)");

const activeChatId = ref<string | null>(null);

const orderedTabs = computed<ChatTab[]>(() => {
  const weight = (tab: ChatTab) => {
    if (tab.type === "organizers" || tab.type === "tournament") return 0;
    if (tab.id.startsWith("matchmaking:")) return 1;
    if (tab.type === "match") return 2;
    return 3;
  };
  return [...tabs.value].sort((a, b) => {
    const wa = weight(a);
    const wb = weight(b);
    if (wa !== wb) return wa - wb;
    return a.label.localeCompare(b.label);
  });
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

const activeMatch = computed<any | null>(() => {
  const tab = activeTab.value;
  if (!tab || tab.type !== "match") return null;
  const matches = (matchLobbyStore.myMatches as any[]) || [];
  return matches.find((m: any) => m.id === tab.lobbyId) || null;
});

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

function handleSelectRoom(tab: ChatTab) {
  activeChatId.value = tab.id;
  setActiveTab(tab.id);
  resetUnread(tab.id);
}

function handleMessageReceived(payload: {
  tabId?: string;
  direction: "inbound" | "outbound";
  message: any;
}) {
  if (payload.direction !== "inbound") return;
  const tabId = payload.tabId ?? activeChatId.value;
  if (!tabId) return;
  const isCurrentRoom = tabId === activeChatId.value;
  const isVisible = props.isSidebarOpen && props.isTabActive && isCurrentRoom;
  if (!isVisible) {
    incrementUnread(tabId);
  } else {
    resetUnread(tabId);
  }
}

function getRoomIcon(tab: ChatTab) {
  if (tab.type === "organizers" || tab.type === "tournament") return Megaphone;
  if (tab.id.startsWith("matchmaking:")) return Merge;
  if (tab.type === "match") return Sword;
  if (tab.type === "team") return Shield;
  return MessageSquare;
}

function getRoomSubtitle(tab: ChatTab) {
  if (tab.type === "organizers") return t("chat_room_subtitles.organizers");
  if (tab.type === "tournament") return t("chat_room_subtitles.tournament");
  if (tab.id.startsWith("matchmaking:")) return t("chat_room_subtitles.matchmaking");
  if (tab.type === "match") return t("chat_room_subtitles.match");
  if (tab.type === "team") return t("chat_room_subtitles.team");
  return "";
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
        class="relative flex-1 overflow-y-auto space-y-1 w-full flex flex-col items-center"
      >
        <!-- Sliding left accent bar -->
        <div
          v-show="showChatIndicator"
          class="absolute top-0 left-0 w-0.5 rounded-r-full z-10 pointer-events-none bg-[hsl(var(--tac-amber))]"
          :class="chatHasAnimated ? 'chat-indicator-animated' : ''"
          :style="{
            transform: `translateY(${chatIndicatorY + 4}px)`,
            height: `${chatIndicatorHeight - 8}px`,
          }"
        />

        <TooltipProvider :delay-duration="150">
          <template v-for="tab in orderedTabs" :key="tab.id">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  :ref="setChatButtonRef(tab.id)"
                  class="relative z-[1] flex items-center justify-center w-11 h-11 rounded-md transition-colors duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :class="
                    activeChatId === tab.id
                      ? 'text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  "
                  type="button"
                  @click="handleSelectRoom(tab)"
                >
                  <div
                    class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-inherit transition-colors"
                    :class="
                      activeChatId === tab.id
                        ? 'bg-zinc-700'
                        : 'bg-zinc-900/80 group-hover:bg-zinc-700/70'
                    "
                  >
                    <component :is="getRoomIcon(tab)" class="w-3.5 h-3.5" />
                  </div>
                  <span
                    v-if="unreadCounts[tab.id]"
                    class="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] px-1 min-w-[1.05rem] h-4 leading-none"
                  >
                    {{ unreadCounts[tab.id] }}
                  </span>
                </button>
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
          </template>
        </TooltipProvider>
      </div>

      <div v-else class="flex-1" />
    </div>

    <!-- Right chat area -->
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="orderedTabs.length">
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
            <TooltipProvider :delay-duration="150">
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
            </TooltipProvider>
          </div>
        </div>

        <div
          v-if="isParticipantsOpen && activeParticipants.length"
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

        <div class="flex-1 min-h-0 flex flex-col">
          <div
            v-if="activeTab?.type === 'match' && activeMatch"
            class="px-3 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-950/70"
          >
            <MatchTableRow
              :match="activeMatch"
              :player="null"
              :compact="true"
              :always-show="true"
            />
          </div>

          <ChatLobby
            v-for="tab in tabs"
            :key="tab.id"
            v-show="tab.id === activeChatId"
            :instance="tab.instance"
            :type="tab.type"
            :lobby-id="tab.lobbyId"
            :tab-id="tab.id"
            :frameless="true"
            :is-global-context="true"
            :hide-participants-summary="true"
            :disable-auto-focus-on-activate="isMobile"
            :is-active-tab="
              tab.id === activeChatId && isSidebarOpen && isTabActive
            "
            @message-received="handleMessageReceived"
          />
        </div>
      </template>
      <div v-else class="flex-1 flex flex-col">
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
    </div>
  </div>
</template>

<style scoped>
.chat-indicator-animated {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0s;
}
</style>
