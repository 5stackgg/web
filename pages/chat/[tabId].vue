<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "#app";
import { useI18n } from "vue-i18n";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";
import {
  setPageChatFocus,
  useChatPresence,
} from "~/composables/useChatPresence";
import { chatThreadKey } from "~/utilities/chatThread";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { matchTeamLobbyId } from "~/utilities/matchTeamLobby";
import socket, { type ChatType } from "~/web-sockets/Socket";

definePageMeta({
  layout: "chat",
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { tabs } = useChatTabs();

const tabId = computed(() => route.params.tabId as string);

const tabFromSession = computed<ChatTab | null>(() => {
  return (
    (tabs.value.find((t) => t.id === tabId.value) as ChatTab | undefined) ||
    null
  );
});

const tabFromQuery = computed<ChatTab | null>(() => {
  const q = route.query;
  const type = q.type as string;
  const lobbyId = q.lobbyId as string;
  const instance = q.instance as string;
  const label = q.label as string;
  if (!type || !lobbyId || !instance) return null;
  return {
    id: tabId.value,
    label: label || t("chat_page.fallback_title"),
    instance,
    type: type as ChatType,
    lobbyId,
    pinned: false,
  };
});

// A tapped notification lands here with nothing but the tab id, which is
// `${type}:${lobbyId}` and so carries everything the room needs. Split on the
// first colon only: a direct room's id is itself a colon-joined pair.
const tabFromId = computed<ChatTab | null>(() => {
  const separator = tabId.value.indexOf(":");

  if (separator === -1) {
    return null;
  }

  const type = tabId.value.slice(0, separator) as ChatType;
  const lobbyId = tabId.value.slice(separator + 1);

  if (!type || !lobbyId) {
    return null;
  }

  return {
    id: tabId.value,
    label: t("chat_page.fallback_title"),
    instance: type,
    type,
    lobbyId,
    pinned: false,
  };
});

const currentTab = computed<ChatTab | null>(() => {
  return tabFromSession.value ?? tabFromQuery.value ?? tabFromId.value;
});

const hasTab = computed(() => currentTab.value !== null);

// Same second room the sidebar and the match page offer. This window can be
// opened cold from a bare URL, so the match is looked up in the store rather
// than expected in the query string.
const teamLobbyId = computed(() => {
  const tab = currentTab.value;

  if (tab?.type !== "match") {
    return undefined;
  }

  const match = (useMatchLobbyStore().myMatches as unknown as any[])?.find(
    (candidate) => candidate.id === tab.lobbyId,
  );

  return matchTeamLobbyId(match, useAuthStore().me?.steam_id);
});

const windowTitle = computed(
  () => currentTab.value?.label ?? t("chat_page.fallback_title"),
);

const tabTypeLabel = computed(() => {
  if (!currentTab.value) return "";
  return t(`chat_tab_labels.${currentTab.value.type}`);
});

useHead({
  title: windowTitle,
});

function handleBackToHub() {
  if (import.meta.client && window.opener) {
    window.opener.focus();
    window.close();
  } else {
    router.push("/");
  }
}

// This window runs the `chat` layout, so the default layout's presence
// reporter never mounts here. Without its own the server would keep pushing
// notifications for the very conversation this window exists to display.
const thread = computed(() =>
  currentTab.value
    ? chatThreadKey(currentTab.value.type, currentTab.value.lobbyId)
    : null,
);

useChatPresence();

watch(
  thread,
  (value, previous) => {
    setPageChatFocus(value);

    if (value && value !== previous && currentTab.value) {
      socket.markLobbyRead(currentTab.value.type, currentTab.value.lobbyId);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  setPageChatFocus(null);
});
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div
      class="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30"
    >
      <div class="min-w-0">
        <h1 class="text-sm font-semibold truncate">
          {{ currentTab?.label || $t("chat_page.fallback_title") }}
        </h1>
        <p class="text-[11px] text-muted-foreground truncate">
          <span v-if="currentTab">{{ tabTypeLabel }}</span>
          <span v-else>{{ $t("chat_page.not_found") }}</span>
        </p>
      </div>
      <a
        :href="'/'"
        class="inline-flex items-center justify-center h-7 px-2 rounded-md border border-border bg-background text-xs hover:bg-accent shrink-0"
        @click.prevent="handleBackToHub"
      >
        {{ $t("chat_page.back_to_hub") }}
      </a>
    </div>

    <div class="flex-1 min-h-0 flex flex-col p-2">
      <div
        v-if="!hasTab"
        class="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-4"
      >
        <div class="space-y-1.5">
          <p>{{ $t("chat_page.not_open_title") }}</p>
          <p class="text-xs">
            {{ $t("chat_page.not_open_description") }}
          </p>
        </div>
      </div>
      <div
        v-else
        class="flex-1 min-h-0 flex flex-col rounded-lg bg-muted/30 overflow-hidden"
      >
        <ChatLobby
          :instance="currentTab!.instance"
          :type="currentTab!.type"
          :lobby-id="currentTab!.lobbyId"
          :team-lobby-id="teamLobbyId"
          :tab-id="currentTab!.id"
          :frameless="true"
          :is-global-context="true"
          :is-active-tab="true"
        />
      </div>
    </div>
  </div>
</template>
