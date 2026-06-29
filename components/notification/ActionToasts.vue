<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import ToastCard from "~/components/notification/ToastCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation } from "~/graphql/graphqlGen";
import { useNotificationStore } from "~/stores/NotificationStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useInvites } from "~/composables/useInvites";
import { useAuthStore } from "~/stores/AuthStore";
import { useRightSidebar } from "~/composables/useRightSidebar";

const { rightSidebarOpen } = useRightSidebar();

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

const hoveredGroup = ref<string | null>(null);

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

const displayList = computed(() =>
  groups.value
    .map((group) => {
      const rep = group[group.length - 1];
      return { key: rep.id, item: rep, group, count: group.length };
    })
    .sort(
      (a, b) =>
        visibleItems.value.indexOf(a.item) - visibleItems.value.indexOf(b.item),
    ),
);

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

const dismissItem = (item: ToastItem) => {
  dismissed.value.add(item.id);
};
</script>

<template>
  <ClientOnly>
    <div
      v-if="displayList.length > 0"
      class="pointer-events-none fixed bottom-4 left-2 right-2 z-[60] hidden flex-col transition-[right] duration-200 ease-linear md:left-auto md:flex md:w-[340px]"
      :class="
        rightSidebarOpen ? 'md:right-[30.75rem]' : 'md:right-[4.75rem]'
      "
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="pointer-events-auto flex flex-col gap-3"
      >
        <div
          v-for="entry in displayList"
          :key="entry.key"
          class="relative origin-bottom transition-all duration-200"
          :class="[
            { 'pb-2.5': entry.count > 1 },
            hoveredGroup === entry.key ? 'z-50 scale-[1.04]' : 'z-0',
            hoveredGroup && hoveredGroup !== entry.key
              ? 'scale-[0.92] opacity-30 blur-[2px]'
              : '',
          ]"
          @mouseenter="hoveredGroup = entry.key"
          @mouseleave="hoveredGroup = null"
        >
          <Transition name="fan">
            <div
              v-if="hoveredGroup === entry.key && entry.count > 1"
              class="absolute inset-x-0 bottom-full flex max-h-[60vh] origin-bottom flex-col gap-3 overflow-y-auto pb-3 pr-1 [scrollbar-width:thin]"
            >
              <ToastCard
                v-for="extra in entry.group.slice(0, -1)"
                :key="extra.id"
                :item="extra"
                :pending="pending[extra.id] || null"
                elevated
                @accept="run(extra, true)"
                @decline="run(extra, false)"
                @dismiss="dismissItem(extra)"
              />
            </div>
          </Transition>

          <template v-if="hoveredGroup !== entry.key && entry.count > 1">
            <div
              v-if="entry.count >= 3"
              class="toast-peek toast-peek-2"
              aria-hidden="true"
            />
            <div class="toast-peek toast-peek-1" aria-hidden="true" />
          </template>

          <ToastCard
            :item="entry.item"
            :count="hoveredGroup === entry.key ? 1 : entry.count"
            :pending="pending[entry.item.id] || null"
            :elevated="hoveredGroup === entry.key"
            @accept="run(entry.item, true)"
            @decline="run(entry.item, false)"
            @dismiss="
              hoveredGroup === entry.key
                ? dismissItem(entry.item)
                : dismissGroup(entry.group)
            "
          />
        </div>
      </TransitionGroup>
    </div>
  </ClientOnly>
</template>

<style scoped>
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
.fan-enter-active {
  transition:
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s ease;
}
.fan-leave-active {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}
.fan-enter-from,
.fan-leave-to {
  transform: translateY(14px) scale(0.94);
  opacity: 0;
}
</style>
