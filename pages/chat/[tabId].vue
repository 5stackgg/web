<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "#app";
import { useI18n } from "vue-i18n";
import { Bell, BellOff } from "lucide-vue-next";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import ChatRoomNotifyMenu from "~/components/chat/ChatRoomNotifyMenu.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  chatRoomQuiet,
  resetChatRoomSettings,
  syncChatRoomSettings,
  useChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import { useChatTabs, type ChatTab } from "~/composables/useChatTabs";
import {
  setPageChatFocus,
  useChatPresence,
} from "~/composables/useChatPresence";
import { useChatBlocks } from "~/composables/useChatBlocks";
import { peerSteamId } from "~/composables/useDirectMessages";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import { chatThreadKey } from "~/utilities/chatThread";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import {
  matchTeamLobbyId,
  type MatchLike,
} from "~/utilities/matchTeamLobby";
import { chatTeam } from "~/utilities/teamChat";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
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

const { isBlocked } = usePlayerBlocks();

// The sidebar closes its tab for a blocked player, but this window has no tab
// to close.
const blockedPeer = computed(() => {
  const tab = currentTab.value;
  const mySteamId = useAuthStore().me?.steam_id;

  if (tab?.type !== "direct" || !mySteamId) {
    return false;
  }

  return isBlocked(peerSteamId(tab.lobbyId, String(mySteamId)));
});

// The api's rule, as `me.teams` carries it. Undefined until `me` has loaded,
// which is no answer yet either way.
const team = computed(() => {
  const tab = currentTab.value;

  return tab?.type === "team"
    ? chatTeam(useAuthStore().me?.teams, tab.lobbyId)
    : null;
});

const teamForbidden = computed(
  () =>
    currentTab.value?.type === "team" &&
    Array.isArray(useAuthStore().me?.teams) &&
    !team.value,
);

const forbiddenTeamName = ref<string | null>(null);

watch(
  () => (teamForbidden.value ? currentTab.value?.lobbyId : null),
  async (teamId) => {
    forbiddenTeamName.value = null;

    if (!teamId) {
      return;
    }

    try {
      const { data } = await getGraphqlClient().query({
        query: generateQuery({
          teams_by_pk: [{ id: teamId }, { id: true, name: true }],
        } as any),
      });

      forbiddenTeamName.value = (data as any)?.teams_by_pk?.name ?? null;
    } catch {
      // Says who can read it without the name.
    }
  },
  { immediate: true },
);

const hasTab = computed(
  () =>
    currentTab.value !== null && !blockedPeer.value && !teamForbidden.value,
);

// Same second room the sidebar and the match page offer. This window can be
// opened cold from a bare URL, so the match is asked for rather than expected
// in the query string -- and asked of the match itself, because the store only
// holds matches still being played, while a team room outlives its match.
const lineupsOf = ref<MatchLike | null>(null);

watch(
  () => (currentTab.value?.type === "match" ? currentTab.value.lobbyId : null),
  async (matchId) => {
    lineupsOf.value = null;

    if (!matchId) {
      return;
    }

    const lineup = { id: true, is_on_lineup: true, coach: { steam_id: true } };

    try {
      const { data } = await getGraphqlClient().query({
        query: generateQuery({
          matches_by_pk: [
            { id: matchId },
            { id: true, status: true, lineup_1: lineup, lineup_2: lineup },
          ],
        } as any),
        fetchPolicy: "network-only",
      });

      if (currentTab.value?.lobbyId === matchId) {
        lineupsOf.value = (data as any)?.matches_by_pk ?? null;
      }
    } catch {
      // The store's copy, while the match is still being played, is all
      // there is to go on.
    }
  },
  { immediate: true },
);

const teamLobbyId = computed(() => {
  const tab = currentTab.value;

  if (tab?.type !== "match") {
    return undefined;
  }

  const match =
    lineupsOf.value ??
    (useMatchLobbyStore().myMatches as unknown as any[])?.find(
      (candidate) => candidate.id === tab.lobbyId,
    );

  return matchTeamLobbyId(match, useAuthStore().me?.steam_id);
});

const tabLabel = computed(
  () =>
    team.value?.name ??
    currentTab.value?.label ??
    t("chat_page.fallback_title"),
);

const tabTypeLabel = computed(() => {
  if (!currentTab.value) return "";
  return t(`chat_tab_labels.${currentTab.value.type}`);
});

useHead({
  title: tabLabel,
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
  currentTab.value && !teamForbidden.value
    ? chatThreadKey(currentTab.value.type, currentTab.value.lobbyId)
    : null,
);

useChatPresence();
// Nor does its block watcher, so this window would keep showing the lines of
// a player blocked while it was open.
useChatBlocks();

// Nor the sign-in that follows the player's room settings, which keep a muted
// room's sound quiet here too.
watch(
  () => useAuthStore().me?.steam_id,
  (steamId) => {
    if (steamId) {
      void syncChatRoomSettings(String(steamId));
      return;
    }

    resetChatRoomSettings();
  },
  { immediate: true },
);

const { supported: roomSettingsSupported } = useChatRoomSettings();

const roomMuted = computed(() =>
  currentTab.value
    ? chatRoomQuiet(currentTab.value.type, currentTab.value.lobbyId).muted
    : false,
);

// The team room is known only once the match is, which can be after the
// thread.
watch(
  [thread, teamLobbyId],
  ([value, team], [previous, previousTeam] = []) => {
    setPageChatFocus(value);

    if (!value || !currentTab.value) {
      return;
    }

    if (value !== previous) {
      socket.markLobbyRead(currentTab.value.type, currentTab.value.lobbyId);
    }

    if (team && (team !== previousTeam || value !== previous)) {
      socket.markLobbyRead("match_team", team);
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
          {{ tabLabel }}
        </h1>
        <p class="text-[11px] text-muted-foreground truncate">
          <span v-if="currentTab">{{ tabTypeLabel }}</span>
          <span v-else>{{ $t("chat_page.not_found") }}</span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <DropdownMenu v-if="hasTab && roomSettingsSupported">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              data-chat-room-menu
              class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground motion-reduce:transition-none"
              :aria-label="$t('chat.room_settings.menu')"
            >
              <BellOff v-if="roomMuted" class="size-3.5" />
              <Bell v-else class="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <ChatRoomNotifyMenu
              :type="currentTab!.type"
              :lobby-id="currentTab!.lobbyId"
            />
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          :href="'/'"
          class="inline-flex items-center justify-center h-7 px-2 rounded-md border border-border bg-background text-xs hover:bg-accent shrink-0"
          @click.prevent="handleBackToHub"
        >
          {{ $t("chat_page.back_to_hub") }}
        </a>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex flex-col p-2">
      <div
        v-if="teamForbidden"
        class="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-4"
      >
        <div class="space-y-1.5">
          <p class="font-medium">{{ $t("chat.team_room.forbidden_title") }}</p>
          <p class="text-xs">
            {{
              forbiddenTeamName
                ? $t("chat.team_room.forbidden_description", {
                    team: forbiddenTeamName,
                  })
                : $t("chat.team_room.forbidden_description_unnamed")
            }}
          </p>
        </div>
      </div>
      <div
        v-else-if="!hasTab"
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
