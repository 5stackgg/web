<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { CornerDownLeft, Search, X } from "lucide-vue-next";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import HubEmptyState from "~/components/hub/HubEmptyState.vue";
import { useDirectMessages } from "~/composables/useDirectMessages";
import { useChatTabs } from "~/composables/useChatTabs";
import { setActiveHub } from "~/composables/useHubState";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

// Starting a conversation, inside Chat itself: the thread area becomes a
// "To:" field over your friends, online first. Direct messages are between
// accepted friends only (the server enforces the same), so this lists friends
// rather than searching every player and refusing most of them.
const emit = defineEmits<{ (e: "close"): void }>();

const matchmakingStore = useMatchmakingStore();
const { openConversation } = useDirectMessages();
const { tabs } = useChatTabs();
const apiDomain = useRuntimeConfig().public.apiDomain as string;

const query = ref("");
const highlighted = ref(0);
const input = ref<HTMLInputElement | null>(null);
const list = ref<HTMLElement | null>(null);

const onlineIds = computed(
  () =>
    new Set(
      (matchmakingStore.onlineFriends ?? []).map((friend: any) =>
        String(friend.steam_id),
      ),
    ),
);

const talkingWith = computed(
  () =>
    new Set(
      tabs.value
        .filter((tab) => tab.type === "direct" && tab.steamId)
        .map((tab) => String(tab.steamId)),
    ),
);

const allFriends = computed(() =>
  ((matchmakingStore.friends ?? []) as any[]).filter(
    (friend) =>
      friend.status !== "Pending" && friend.player?.is_registered !== false,
  ),
);

const matching = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return allFriends.value
    .filter((friend) => (friend.name ?? "").toLowerCase().includes(needle))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
});

const online = computed(() =>
  matching.value.filter((friend) => onlineIds.value.has(String(friend.steam_id))),
);
const offline = computed(() =>
  matching.value.filter(
    (friend) => !onlineIds.value.has(String(friend.steam_id)),
  ),
);
// Keyboard order is reading order: online, then everyone else.
const ordered = computed(() => [...online.value, ...offline.value]);

watch(query, () => {
  highlighted.value = 0;
});

function avatar(friend: any) {
  return resolveAvatarUrl(friend.avatar_url, apiDomain);
}

function start(friend: any) {
  openConversation({
    steam_id: String(friend.steam_id),
    name: friend.name,
    avatar_url: friend.avatar_url,
  });
  emit("close");
}

function move(step: number) {
  const count = ordered.value.length;
  if (!count) return;
  highlighted.value = (highlighted.value + step + count) % count;
  nextTick(() => {
    list.value
      ?.querySelector<HTMLElement>(`[data-index="${highlighted.value}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    move(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    move(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const friend = ordered.value[highlighted.value];
    if (friend) start(friend);
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
}

function findFriends() {
  emit("close");
  setActiveHub("social");
}

onMounted(() => nextTick(() => input.value?.focus()));
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex items-center justify-between gap-3 border-b border-border bg-card/30 px-3 py-3"
    >
      <div class="min-w-0">
        <div class="truncate text-xs font-semibold text-foreground">
          {{ $t("layouts.chat_panel.new_message") }}
        </div>
        <div class="truncate text-[10px] text-muted-foreground">
          {{ $t("layouts.chat_panel.compose_hint") }}
        </div>
      </div>
      <button
        type="button"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="$t('layouts.chat_panel.cancel_compose')"
        @click="emit('close')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <label
      class="mx-3 mt-3 flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-[hsl(var(--tac-amber)/0.5)]"
    >
      <span class="text-xs font-medium text-muted-foreground">
        {{ $t("layouts.chat_panel.to") }}
      </span>
      <input
        ref="input"
        v-model="query"
        type="text"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="new-conversation-friends"
        :aria-activedescendant="
          ordered[highlighted]
            ? `new-conversation-${ordered[highlighted].steam_id}`
            : undefined
        "
        class="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
        :placeholder="$t('layouts.chat_panel.search_friends')"
        @keydown="onKeydown"
      />
      <Search class="size-3.5 shrink-0 text-muted-foreground" />
    </label>

    <div
      id="new-conversation-friends"
      ref="list"
      role="listbox"
      class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1"
    >
      <template
        v-for="group in [
          { key: 'online', label: $t('layouts.chat_panel.online'), friends: online, offset: 0 },
          { key: 'friends', label: $t('layouts.chat_panel.friends'), friends: offline, offset: online.length },
        ]"
        :key="group.key"
      >
        <template v-if="group.friends.length">
          <div
            class="flex items-center gap-2 px-2 pb-1 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
            {{ group.label }}
            <span class="ml-auto tabular-nums tracking-normal opacity-70">
              {{ group.friends.length }}
            </span>
          </div>
          <button
            v-for="(friend, index) in group.friends"
            :id="`new-conversation-${friend.steam_id}`"
            :key="friend.steam_id"
            type="button"
            role="option"
            :data-index="group.offset + index"
            :aria-selected="highlighted === group.offset + index"
            class="group/row flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
            :class="
              highlighted === group.offset + index
                ? 'bg-white/[0.06]'
                : 'hover:bg-white/[0.04]'
            "
            @mouseenter="highlighted = group.offset + index"
            @click="start(friend)"
          >
            <span class="relative shrink-0">
              <Avatar shape="square" class="h-8 w-8 text-[0.6rem]">
                <AvatarImage
                  v-if="avatar(friend)"
                  :src="avatar(friend)!"
                  :alt="friend.name"
                />
                <AvatarFallback>
                  {{ (friend.name ?? "?").slice(0, 2).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <span
                class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full shadow-[0_0_0_2px_hsl(var(--sidebar-background))]"
                :class="
                  group.key === 'online'
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/40'
                "
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-foreground">
                {{ friend.name }}
              </span>
              <span
                v-if="talkingWith.has(String(friend.steam_id))"
                class="block truncate text-[0.7rem] text-muted-foreground"
              >
                {{ $t("layouts.chat_panel.existing_conversation") }}
              </span>
            </span>
            <CornerDownLeft
              class="size-3.5 shrink-0 text-muted-foreground transition-opacity"
              :class="
                highlighted === group.offset + index ? 'opacity-100' : 'opacity-0'
              "
            />
          </button>
        </template>
      </template>

      <HubEmptyState
        v-if="!ordered.length"
        :title="
          query
            ? $t('layouts.hub.empty.no_match', { query })
            : $t('layouts.hub.empty.friends_title')
        "
        :description="
          query ? null : $t('layouts.chat_panel.no_friends')
        "
      >
        <button
          v-if="!query && !allFriends.length"
          type="button"
          class="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-accent"
          @click="findFriends"
        >
          {{ $t("layouts.chat_panel.find_friends") }}
        </button>
      </HubEmptyState>
    </div>
  </div>
</template>
