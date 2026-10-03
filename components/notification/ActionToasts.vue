<script setup lang="ts">
import { ref, computed, watch, type Component } from "vue";
import { useEventListener } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { ArrowRight } from "lucide-vue-next";
import ToastCard from "~/components/notification/ToastCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation } from "~/graphql/graphqlGen";
import { useNotificationStore } from "~/stores/NotificationStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useInvites } from "~/composables/useInvites";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useMobileToastYield } from "~/composables/useMobileToastYield";
import { trackActionToastsMounted } from "~/composables/useOffPageToasts";
import { useCallInvites } from "~/composables/useVoiceAnnouncements";
import { useVoiceSession } from "~/composables/useVoiceSession";
import VoiceRosterPreview from "~/components/voice/VoiceRosterPreview.vue";
import {
  isOnMatchActionPage,
  matchActions,
} from "~/utilities/matchActionToasts";

const { rightSidebarOpen } = useRightSidebar();
const { yielding, reservedHeight } = useMobileToastYield();
trackActionToastsMounted();
const route = useRoute();

type ToastItem = {
  id: string;
  kind: string;
  who: string;
  action: string;
  detail: string;
  accept: () => Promise<unknown> | void;
  decline: () => Promise<unknown> | void;
  // Voice channels ask to be joined, not accepted, and want their roster shown
  // above the buttons -- the decision is made on who is in there.
  acceptLabel?: string;
  declineLabel?: string;
  acceptIcon?: Component;
  hideDecline?: boolean;
  channelId?: string;
  // Match actions are the only toasts phones get, and they step aside while
  // the player is already on that match.
  mobile?: boolean;
  onPage?: boolean;
};

const { t } = useI18n();
const { pendingFriends, lobbyInvites } = useInvites();
const notificationStore = useNotificationStore();
const callInvites = useCallInvites();
const voiceSession = useVoiceSession();
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

const matchLobbyStore = useMatchLobbyStore();

const items = computed<ToastItem[]>(() => {
  const list: ToastItem[] = [];

  for (const action of matchActions(
    matchLobbyStore.myMatches,
    useAuthStore().me?.steam_id,
  )) {
    const team1 = action.match.lineup_1?.name || t("common.tbd");
    const team2 = action.match.lineup_2?.name || t("common.tbd");
    list.push({
      id: action.id,
      kind: t(`layouts.notifications.toast.match_${action.kind}`),
      who: `${team1} vs ${team2}`,
      action: t(`layouts.notifications.toast.match_${action.kind}_action`),
      detail: "",
      acceptLabel: t("layouts.notifications.toast.open_match"),
      acceptIcon: ArrowRight,
      hideDecline: true,
      mobile: true,
      onPage: isOnMatchActionPage(action, route.path),
      accept: () => navigateTo(action.path),
      decline: () => {},
    });
  }

  // Somebody started talking. The same shape as an invite, because it is the
  // same sort of thing: a decision someone is asking you to make now.
  for (const invite of callInvites.invites.value) {
    list.push({
      id: invite.id,
      kind: t("voice.call.toast_kind"),
      who: invite.who,
      action: invite.video
        ? t("voice.call.toast_started_video")
        : t("voice.call.toast_joined"),
      detail: invite.channelLabel,
      acceptLabel: t("voice.call.join_action"),
      declineLabel: t("voice.call.dismiss_action"),
      channelId: invite.channelId,
      accept: async () => {
        await voiceSession.join(
          invite.channelId,
          invite.channelLabel,
          invite.channelKind,
        );
        callInvites.dismiss(invite.id);
      },
      decline: () => callInvites.dismiss(invite.id),
    });
  }

  for (const invite of notificationStore.draft_invites) {
    const id = `draft:${invite.draft_game_id}`;
    list.push({
      id,
      kind: t("layouts.notifications.toast.draft_invite"),
      who:
        invite.draft_game?.host?.name ||
        t("layouts.notifications.toast.actor_host"),
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
      who:
        invite.invited_by?.name ||
        t("layouts.notifications.toast.actor_teammate"),
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
      who:
        invite.invited_by?.name ||
        t("layouts.notifications.toast.actor_organizer"),
      action: t("layouts.notifications.toast.invited_you"),
      detail: invite.team?.tournament?.name ?? invite.team?.name ?? "",
      accept: () => inviteAction("tournament", invite.id, true),
      decline: () => inviteAction("tournament", invite.id, false),
    });
  }

  // Invites to REGISTER for a tournament, not to join a team already in one.
  // The type string is deliberately not "tournament": that key already means
  // the tournament-team invite directly above and is what every deployed client
  // sends, so repointing it would break accept/deny mid-upgrade.
  for (const invite of notificationStore.tournament_invites) {
    list.push({
      id: `tournament-registration:${invite.id}`,
      kind: t("layouts.notifications.toast.tournament_registration_invite"),
      who:
        invite.invited_by?.name ||
        t("layouts.notifications.toast.actor_organizer"),
      action: t("layouts.notifications.toast.invited_you_register"),
      // A team-addressed row is the same invite pointed at a roster rather than
      // a person; naming the team is the only thing that tells the two apart in
      // a one-line toast.
      detail: invite.team?.name
        ? `${invite.team.name} · ${invite.tournament?.name ?? ""}`
        : (invite.tournament?.name ?? ""),
      accept: async () => {
        await inviteAction("tournament-registration", invite.id, true);
        navigateTo(`/tournaments/${invite.tournament?.id}`);
      },
      decline: () => inviteAction("tournament-registration", invite.id, false),
    });
  }

  for (const lobby of lobbyInvites.value ?? []) {
    const captain = (lobby.players || []).find((p: any) => p.captain);
    list.push({
      id: `lobby:${lobby.id}`,
      kind: t("layouts.notifications.toast.lobby_invite"),
      who:
        captain?.player?.name || t("layouts.notifications.toast.actor_player"),
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
      who: friend.name || t("layouts.notifications.toast.actor_player"),
      action: t("layouts.notifications.toast.wants_to_be_friends"),
      detail: "",
      accept: () => friendMutation(friend.steam_id, true),
      decline: () => friendMutation(friend.steam_id, false),
    });
  }

  return list;
});

const DISMISSED_STORAGE_LIMIT = 200;

// A call invite is keyed by its channel, so a stored dismissal would silence
// every later call in that channel. It is only remembered for the current call.
const EPHEMERAL_ID_PREFIX = "voice:";

// These ids name the thing rather than the invite (a channel, a player, a
// lobby, a draft), so the same id comes back when that thing asks again. Once
// its source has loaded, a dismissal whose toast is gone is dropped so a fresh
// invite still shows; pruning earlier would treat "not loaded yet" as "gone".
const matchmakingStore = useMatchmakingStore();
const REUSABLE_ID_SOURCES = [
  { prefix: EPHEMERAL_ID_PREFIX, loaded: () => true },
  { prefix: "friend:", loaded: () => matchmakingStore.friendsLoaded },
  { prefix: "lobby:", loaded: () => matchmakingStore.lobbiesLoaded },
  { prefix: "draft:", loaded: () => notificationStore.draftInvitesLoaded },
  { prefix: "match-", loaded: () => matchLobbyStore.myMatchesLoaded },
];

const dismissed = ref<Set<string>>(new Set());

const dismissedStorageKey = computed(() => {
  const steamId = useAuthStore().me?.steam_id;
  return steamId ? `5stack:dismissed-action-toasts:${steamId}` : null;
});

const isPersistable = (id: string) => !id.startsWith(EPHEMERAL_ID_PREFIX);

const readDismissed = (key: string): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.filter(
      (id): id is string => typeof id === "string" && isPersistable(id),
    );
  } catch {
    return [];
  }
};

// Applied as a delta over what is stored now, so another tab's dismissals
// written since this one loaded are kept rather than overwritten.
const writeDismissed = (added: string[], removed: string[]) => {
  const key = dismissedStorageKey.value;
  if (!key) {
    return;
  }
  const changed = new Set([...added, ...removed]);
  const ids = [
    ...readDismissed(key).filter((id) => !changed.has(id)),
    ...added.filter(isPersistable),
  ].slice(-DISMISSED_STORAGE_LIMIT);
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
};

const rememberDismissed = (ids: string[]) => {
  for (const id of ids) {
    dismissed.value.delete(id);
    dismissed.value.add(id);
  }
  writeDismissed(ids, []);
};

watch(
  dismissedStorageKey,
  (key) => {
    dismissed.value = new Set(key ? readDismissed(key) : []);
  },
  { immediate: true },
);

useEventListener("storage", (event: StorageEvent) => {
  const key = dismissedStorageKey.value;
  if (!key || event.key !== key) {
    return;
  }
  const ephemeral = [...dismissed.value].filter((id) => !isPersistable(id));
  dismissed.value = new Set([...readDismissed(key), ...ephemeral]);
});

const pruneDismissed = () => {
  const loadedPrefixes = REUSABLE_ID_SOURCES.filter((source) =>
    source.loaded(),
  ).map((source) => source.prefix);
  const live = new Set(items.value.map((item) => item.id));
  const gone = [...dismissed.value].filter(
    (id) =>
      !live.has(id) && loadedPrefixes.some((prefix) => id.startsWith(prefix)),
  );
  if (gone.length === 0) {
    return;
  }
  for (const id of gone) {
    dismissed.value.delete(id);
  }
  writeDismissed([], gone);
};

watch(
  [
    dismissedStorageKey,
    () => items.value.map((item) => item.id).join("\n"),
    () => REUSABLE_ID_SOURCES.map((source) => source.loaded()).join(),
  ],
  pruneDismissed,
  { immediate: true },
);

const hoveredGroup = ref<string | null>(null);

// On phones the hub opens as a sheet under this stack, so it yields like the
// other bottom surfaces do. Desktop places the stack beside the hub instead.
const phoneYield = computed(() => rightSidebarOpen.value || yielding.value);
const phoneReserve = computed(() =>
  reservedHeight.value > 0
    ? { "--toast-phone-reserve": `${reservedHeight.value}px` }
    : {},
);

const visibleItems = computed(() =>
  items.value.filter((item) => !dismissed.value.has(item.id) && !item.onPage),
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
  rememberDismissed(group.map((item) => item.id));
};

const dismissItem = (item: ToastItem) => {
  rememberDismissed([item.id]);
};
</script>

<template>
  <ClientOnly>
    <!-- No v-if on this container: it is invisible and pointer-events-none
         when empty, and gating it on the list emptying in the same tick as the
         last toast's dismissal used to unmount the group mid-leave -- the
         single-toast case (the common one) never played its exit. -->
    <!-- Part of the hub for dismissal: they slide over when it closes, so a
         click that closed it first would land where the toast used to be. -->
    <div
      data-right-hub-interactive
      class="pointer-events-none fixed bottom-4 left-2 right-2 z-[60] flex flex-col transition-[right,bottom,opacity,transform,visibility] duration-200 ease-linear max-md:motion-reduce:transition-none md:left-auto md:w-[340px]"
      :class="[
        rightSidebarOpen ? 'md:right-[30.75rem]' : 'md:right-[4.75rem]',
        phoneYield
          ? 'max-md:invisible max-md:translate-y-4 max-md:opacity-0'
          : '',
        reservedHeight > 0
          ? 'max-md:bottom-[calc(var(--toast-phone-reserve)_+_1.5rem_+_env(safe-area-inset-bottom))]'
          : '',
      ]"
      :style="phoneReserve"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="pointer-events-auto flex flex-col gap-3"
      >
        <!-- Each toast is a grid wrapper so a leaver collapses its height in
             place -- position:absolute put a dismissed toast at the column's
             origin (a flex child's static position), fading it out on top of
             the stack. -->
        <div
          v-for="entry in displayList"
          :key="entry.key"
          class="grid-rows-[1fr]"
          :class="[
            entry.item.mobile ? 'grid' : 'hidden md:grid',
            hoveredGroup === entry.key ? 'z-50' : 'z-0',
          ]"
        >
        <div class="min-h-0">
        <div
          class="relative origin-bottom transition-all duration-200"
          :class="[
            { 'pb-2.5': entry.count > 1 },
            hoveredGroup === entry.key ? 'scale-[1.04]' : '',
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
                :accept-label="extra.acceptLabel"
                :decline-label="extra.declineLabel"
                :accept-icon="extra.acceptIcon"
                :hide-decline="extra.hideDecline"
                elevated
                @accept="run(extra, true)"
                @decline="run(extra, false)"
                @dismiss="dismissItem(extra)"
              >
                <template v-if="extra.channelId" #body>
                  <VoiceRosterPreview variant="stack" :channel-id="extra.channelId" />
                </template>
              </ToastCard>
            </div>
          </Transition>

          <!-- The stacked-card peeks fade with the fan instead of vanishing
               the instant the cursor arrives. -->
          <Transition
            enter-active-class="transition-opacity duration-200"
            leave-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <div
              v-if="hoveredGroup !== entry.key && entry.count > 1"
              class="absolute inset-0"
              aria-hidden="true"
            >
              <div v-if="entry.count >= 3" class="toast-peek toast-peek-2" />
              <div class="toast-peek toast-peek-1" />
            </div>
          </Transition>

          <ToastCard
            :item="entry.item"
            :count="hoveredGroup === entry.key ? 1 : entry.count"
            :pending="pending[entry.item.id] || null"
            :accept-label="entry.item.acceptLabel"
            :decline-label="entry.item.declineLabel"
            :accept-icon="entry.item.acceptIcon"
            :hide-decline="entry.item.hideDecline"
            :elevated="hoveredGroup === entry.key"
            @accept="run(entry.item, true)"
            @decline="run(entry.item, false)"
            @dismiss="
              hoveredGroup === entry.key
                ? dismissItem(entry.item)
                : dismissGroup(entry.group)
            "
          >
            <template v-if="entry.item.channelId" #body>
              <VoiceRosterPreview variant="stack" :channel-id="entry.item.channelId" />
            </template>
          </ToastCard>
        </div>
        </div>
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
/* Toasts fold their row open and shut in place; the stack above rides normal
   flow instead of snapping when the leaver is finally removed. */
.toast-enter-active {
  transition:
    grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.32s ease;
}
.toast-leave-active {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s ease,
    opacity 0.22s ease;
}
.toast-enter-active > *,
.toast-leave-active > * {
  overflow: hidden;
}
.toast-enter-from,
.toast-leave-to {
  grid-template-rows: 0fr;
  transform: translateY(16px) scale(0.92);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move,
  .fan-enter-active,
  .fan-leave-active {
    transition-duration: 1ms;
  }
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
