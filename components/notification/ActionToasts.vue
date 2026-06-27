<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { Check, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation } from "~/graphql/graphqlGen";
import { useNotificationStore } from "~/stores/NotificationStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useInvites } from "~/composables/useInvites";
import { useAuthStore } from "~/stores/AuthStore";

type ToastItem = {
  id: string;
  kind: string;
  who: string;
  action: string;
  detail: string;
  accept: () => Promise<unknown> | void;
  decline: () => Promise<unknown> | void;
};

const { t } = useI18n();
const { pendingFriends, lobbyInvites } = useInvites();
const notificationStore = useNotificationStore();
const draftStore = useDraftGamesStore();
const MIN_ACTION_LOADING_MS = 2000;

const lobbyMutation = (lobbyId: string, accept: boolean) => {
  const steamId = useAuthStore().me?.steam_id;
  return getGraphqlClient().mutate({
    mutation: accept
      ? generateMutation({
          update_lobby_players_by_pk: [
            {
              pk_columns: { lobby_id: lobbyId, steam_id: steamId },
              _set: { status: "Accepted" },
            },
            { __typename: true },
          ],
        })
      : generateMutation({
          delete_lobby_players_by_pk: [
            { lobby_id: lobbyId, steam_id: steamId },
            { __typename: true },
          ],
        }),
  });
};

const pending = ref<Record<string, "accept" | "decline">>({});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inviteAction = (type: string, inviteId: string, accept: boolean) =>
  getGraphqlClient().mutate({
    mutation: generateMutation({
      [accept ? "acceptInvite" : "denyInvite"]: [
        { type, invite_id: inviteId },
        { success: true },
      ],
    }),
  });

const friendMutation = (steamId: string, accept: boolean) =>
  getGraphqlClient().mutate({
    mutation: generateMutation({
      [accept ? "update_my_friends" : "delete_my_friends"]: [
        { where: { steam_id: { _eq: steamId } } },
        { __typename: true },
      ],
    }),
  });

const items = computed<ToastItem[]>(() => {
  const list: ToastItem[] = [];

  for (const invite of notificationStore.draft_invites) {
    const id = `draft:${invite.draft_game_id}`;
    list.push({
      id,
      kind: t("layouts.notifications.toast.draft_invite"),
      who: invite.draft_game?.host?.name || "The host",
      action: t("layouts.notifications.toast.invited_you"),
      detail:
        `${invite.draft_game?.type ?? ""} ${invite.draft_game?.mode ?? ""}`.trim(),
      accept: async () => {
        await draftStore.respondInvite(invite.draft_game_id, true);
        navigateTo(`/draft-room/${invite.draft_game_id}`);
      },
      decline: () => draftStore.respondInvite(invite.draft_game_id, false),
    });
  }

  for (const invite of notificationStore.team_invites) {
    list.push({
      id: `team:${invite.id}`,
      kind: t("layouts.notifications.toast.team_invite"),
      who: invite.invited_by?.name || "A teammate",
      action: t("layouts.notifications.toast.invited_you"),
      detail: invite.team?.name ?? "",
      accept: async () => {
        await inviteAction("team", invite.id, true);
        navigateTo(`/teams/${invite.team?.id}`);
      },
      decline: () => inviteAction("team", invite.id, false),
    });
  }

  for (const invite of notificationStore.tournament_team_invites) {
    list.push({
      id: `tournament:${invite.id}`,
      kind: t("layouts.notifications.toast.tournament_invite"),
      who: invite.invited_by?.name || "An organizer",
      action: t("layouts.notifications.toast.invited_you"),
      detail: invite.team?.tournament?.name ?? invite.team?.name ?? "",
      accept: () => inviteAction("tournament", invite.id, true),
      decline: () => inviteAction("tournament", invite.id, false),
    });
  }

  for (const lobby of lobbyInvites.value ?? []) {
    const captain = (lobby.players || []).find((p: any) => p.captain);
    list.push({
      id: `lobby:${lobby.id}`,
      kind: t("layouts.notifications.toast.lobby_invite"),
      who: captain?.player?.name || "A player",
      action: t("layouts.notifications.toast.invited_party"),
      detail: "",
      accept: () => lobbyMutation(lobby.id, true),
      decline: () => lobbyMutation(lobby.id, false),
    });
  }

  for (const friend of pendingFriends.value ?? []) {
    list.push({
      id: `friend:${friend.steam_id}`,
      kind: t("layouts.notifications.toast.friend_request"),
      who: friend.name || "A player",
      action: t("layouts.notifications.toast.wants_to_be_friends"),
      detail: "",
      accept: () => friendMutation(friend.steam_id, true),
      decline: () => friendMutation(friend.steam_id, false),
    });
  }

  return list;
});

const dismissed = ref<Set<string>>(new Set());

const expanded = ref(false);
const listEl = ref<any>(null);

const visibleItems = computed(() =>
  items.value.filter((item) => !dismissed.value.has(item.id)),
);

const groups = computed(() => {
  const byKind = new Map<string, ToastItem[]>();
  for (const item of visibleItems.value) {
    const arr = byKind.get(item.kind);
    if (arr) {
      arr.push(item);
    } else {
      byKind.set(item.kind, [item]);
    }
  }
  return Array.from(byKind.values());
});

const displayList = computed(() => {
  if (expanded.value) {
    return visibleItems.value.map((item) => ({
      key: item.id,
      item,
      group: [item],
      count: 1,
    }));
  }
  return groups.value
    .map((group) => {
      const rep = group[group.length - 1];
      return { key: rep.id, item: rep, group, count: group.length };
    })
    .sort(
      (a, b) =>
        visibleItems.value.indexOf(a.item) - visibleItems.value.indexOf(b.item),
    );
});

watch(expanded, async (value) => {
  if (!value) {
    return;
  }
  await nextTick();
  const el = listEl.value?.$el;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
});

const run = async (item: ToastItem, accept: boolean) => {
  if (pending.value[item.id]) {
    return;
  }
  const startedAt = Date.now();
  pending.value[item.id] = accept ? "accept" : "decline";
  try {
    await (accept ? item.accept() : item.decline());
  } finally {
    const remaining = MIN_ACTION_LOADING_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      await sleep(remaining);
    }
    delete pending.value[item.id];
  }
};

const dismissGroup = (group: ToastItem[]) => {
  group.forEach((item) => dismissed.value.add(item.id));
};
</script>

<template>
  <ClientOnly>
    <div
      v-if="displayList.length > 0"
      class="pointer-events-none fixed bottom-4 left-2 right-2 z-[60] flex flex-col md:left-auto md:right-[4.75rem] md:w-[340px]"
    >
      <TransitionGroup
        ref="listEl"
        name="toast"
        tag="div"
        class="pointer-events-auto flex flex-col gap-3 [scrollbar-width:thin]"
        :class="
          expanded ? 'max-h-[70vh] overflow-y-auto overflow-x-hidden pr-1' : ''
        "
        @mouseenter="expanded = true"
        @mouseleave="expanded = false"
      >
        <div
          v-for="entry in displayList"
          :key="entry.key"
          class="relative"
          :class="{ 'pb-2.5': entry.count > 1 }"
        >
          <div
            v-if="entry.count >= 3"
            class="toast-peek toast-peek-2"
            aria-hidden="true"
          />
          <div
            v-if="entry.count >= 2"
            class="toast-peek toast-peek-1"
            aria-hidden="true"
          />

          <div class="toast-card">
            <span class="toast-accent" aria-hidden="true" />
            <div class="flex items-start justify-between gap-2">
              <span class="toast-kind">
                {{ entry.item.kind }}
                <span v-if="entry.count > 1" class="toast-count">{{
                  entry.count
                }}</span>
              </span>
              <button
                type="button"
                class="toast-dismiss"
                :title="$t('layouts.notifications.dismiss')"
                @click="dismissGroup(entry.group)"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              class="mt-1 text-sm font-semibold leading-snug text-[hsl(var(--tac-amber))]"
            >
              {{ entry.item.who }}
            </div>
            <div class="mt-0.5 text-xs leading-snug text-muted-foreground">
              {{ entry.item.action
              }}{{ entry.item.detail ? " " + entry.item.detail : "" }}
            </div>
            <div class="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant="tactical"
                class="h-7 flex-1 rounded-[0.4rem] px-2 text-[0.7rem] font-semibold normal-case tracking-normal"
                :loading="pending[entry.item.id] === 'accept'"
                :disabled="pending[entry.item.id] === 'decline'"
                @click="run(entry.item, true)"
              >
                <Check class="h-3.5 w-3.5" />
                {{ $t("draft_games.room.accept_invite") }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-7 flex-1 rounded-[0.4rem] border-border bg-transparent px-2 text-[0.7rem] font-semibold text-muted-foreground hover:border-[hsl(var(--destructive)/0.5)] hover:text-[hsl(var(--destructive))]"
                :loading="pending[entry.item.id] === 'decline'"
                :disabled="pending[entry.item.id] === 'accept'"
                @click="run(entry.item, false)"
              >
                <X class="h-3.5 w-3.5" />
                {{ $t("draft_games.room.decline_invite") }}
              </Button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </ClientOnly>
</template>

<style scoped>
.toast-card {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  border-radius: 0.55rem;
  border: 1px solid hsl(var(--tac-amber) / 0.32);
  background: hsl(var(--card) / 0.96);
  backdrop-filter: blur(10px);
  padding: 0.7rem 0.85rem 0.7rem 1rem;
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.12),
    0 14px 34px -10px rgba(0, 0, 0, 0.75);
}
.toast-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 10px hsl(var(--tac-amber) / 0.7);
}
.toast-peek {
  position: absolute;
  inset: 0;
  border-radius: 0.55rem;
  border: 1px solid hsl(var(--tac-amber) / 0.22);
  background: hsl(var(--card) / 0.85);
}
.toast-peek-1 {
  transform: translateY(6px) scale(0.97);
  opacity: 0.7;
}
.toast-peek-2 {
  transform: translateY(12px) scale(0.94);
  opacity: 0.45;
}
.toast-count {
  margin-left: 0.35rem;
  display: inline-flex;
  min-width: 1.05rem;
  justify-content: center;
  border-radius: 999px;
  background: hsl(var(--tac-amber) / 0.18);
  padding: 0 0.3rem;
  font-size: 0.56rem;
  color: hsl(var(--tac-amber));
}
.toast-dismiss {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  transition: color 0.15s ease;
}
.toast-dismiss:hover {
  color: hsl(var(--foreground));
}
.toast-kind {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--tac-amber));
}
.toast-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.32s ease;
}
.toast-leave-active {
  transition:
    transform 0.22s ease,
    opacity 0.22s ease;
  position: absolute;
  width: 100%;
}
.toast-enter-from,
.toast-leave-to {
  transform: translateY(16px) scale(0.92);
  opacity: 0;
}
.toast-move {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
