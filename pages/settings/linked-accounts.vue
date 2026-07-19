<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerLiveStatus from "~/components/matchmaking-lobby/PlayerLiveStatus.vue";
import { gql } from "@apollo/client/core";
import {
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Zap,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Skeleton } from "~/components/ui/skeleton";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

const { t } = useI18n();
const apolloClient = useApolloClient().client;
const me = computed(() => useAuthStore().me);
const linkedAccountsEnabled = computed(
  () => useApplicationSettingsStore().linkedAccountsEnabled,
);

const authCode = ref("");
const shareCode = ref("");
const linking = ref(false);
const unlinking = ref(false);
const polling = ref(false);
const showUnlinkConfirm = ref(false);

// Linking auto-triggers a server-side poll. Surface that immediately and keep
// it visible until the first poll lands pending imports, an error, or simply
// completes (last_polled_at). A fallback timeout guards against a missing
// signal so we never spin forever.
const awaitingPoll = ref(false);
let awaitingPollTimeout: ReturnType<typeof setTimeout> | null = null;

function stopAwaitingPoll() {
  awaitingPoll.value = false;
  if (awaitingPollTimeout) {
    clearTimeout(awaitingPollTimeout);
    awaitingPollTimeout = null;
  }
}

const LINK_SUBSCRIPTION = gql`
  subscription PlayerSteamMatchAuth($steam_id: bigint!) {
    player_steam_match_auth_by_pk(steam_id: $steam_id) {
      steam_id
      last_known_share_code
      last_polled_at
      last_error
      updated_at
    }
  }
`;

const LINK_MUTATION = gql`
  mutation LinkSteamMatchHistory($auth_code: String!, $share_code: String!) {
    linkSteamMatchHistory(auth_code: $auth_code, share_code: $share_code) {
      success
      error
    }
  }
`;

const UNLINK_MUTATION = gql`
  mutation UnlinkSteamMatchHistory {
    unlinkSteamMatchHistory {
      success
    }
  }
`;

const POLL_MUTATION = gql`
  mutation PollSteamMatchHistory {
    pollSteamMatchHistory {
      success
      collected
      error
    }
  }
`;

const PENDING_IMPORTS_SUBSCRIPTION = gql`
  subscription PendingMatchImports {
    pending_match_imports(order_by: { updated_at: desc }) {
      valve_match_id
      status
      error
      map_name
      match_start_time
      created_at
      updated_at
    }
  }
`;

const CLEAR_PENDING_MUTATION = gql`
  mutation ClearPendingMatchImport($valve_match_id: String!) {
    clearPendingMatchImport(valve_match_id: $valve_match_id) {
      success
    }
  }
`;

// Presence bot: adding it as a Steam friend gives instant imports.
const ASSIGN_PRESENCE_BOT_MUTATION = gql`
  mutation AssignSteamPresenceBot {
    assignSteamPresenceBot {
      enabled
      steamId
      addUrl
      status
    }
  }
`;

const PRESENCE_FRIEND_SUBSCRIPTION = gql`
  subscription PlayerSteamBotFriend($steam_id: bigint!) {
    player_steam_bot_friend_by_pk(steam_id: $steam_id) {
      status
      bot_steamid64
      last_presence_state
      updated_at
    }
  }
`;

// Your own live 5stack match, in the same shape the friends list normalizes, so
// "as your friends see you" shows the match preview exactly like friends do.
const MY_LIVE_MATCH_SUBSCRIPTION = gql`
  subscription MyLiveMatch($steam_id: bigint!) {
    players_by_pk(steam_id: $steam_id) {
      player_lineup(
        limit: 1
        where: { lineup: { match: { status: { _eq: Live } } } }
      ) {
        lineup {
          id
          match {
            id
            status
            started_at
            lineup_1_id
            lineup_2_id
            options {
              type
              best_of
            }
            streams(where: { is_live: { _eq: true } }, limit: 1) {
              id
            }
            match_maps(order_by: { order: asc }) {
              id
              order
              status
              is_current_map
              map {
                name
                label
              }
              lineup_1_score
              lineup_2_score
              winning_lineup_id
            }
          }
        }
      }
    }
  }
`;

type PresenceState = {
  inCs2?: boolean;
  inGame?: boolean;
  inMatch?: boolean;
  mode?: string | null;
  map?: string | null;
  score?: string | null;
};

// Friendly labels for CS2 game:mode values.
const presenceBot = ref<{
  enabled: boolean;
  steamId: string | null;
  addUrl: string | null;
  status: string | null;
} | null>(null);
const presenceFriend = ref<{
  status: string;
  bot_steamid64: string | null;
  last_presence_state: PresenceState | null;
  updated_at: string | null;
} | null>(null);
const myLiveMatchLineup = ref<any>(null);
const presenceConnecting = ref(false);
let presenceSubHandle: { unsubscribe: () => void } | null = null;
let myMatchSubHandle: { unsubscribe: () => void } | null = null;

// Shaped like a my_friends row so <PlayerLiveStatus> renders it identically.
const selfPresencePlayer = computed(() => ({
  last_presence_state: presenceFriend.value?.last_presence_state ?? null,
  player: {
    player_lineup: myLiveMatchLineup.value ? [myLiveMatchLineup.value] : [],
  },
}));

const presenceConnected = computed(
  () => presenceFriend.value?.status === "friends",
);
const presenceAddUrl = computed(() => {
  if (presenceBot.value?.addUrl) return presenceBot.value.addUrl;
  if (presenceFriend.value?.bot_steamid64) {
    return `https://steamcommunity.com/profiles/${presenceFriend.value.bot_steamid64}`;
  }
  return null;
});

async function connectPresence() {
  presenceConnecting.value = true;
  try {
    const { data } = await apolloClient.mutate({
      mutation: ASSIGN_PRESENCE_BOT_MUTATION,
    });
    const result = data?.assignSteamPresenceBot;
    presenceBot.value = result ?? null;
    if (!result?.enabled || !result?.addUrl) {
      toast({
        title: t("pages.settings.linked_accounts.presence_unavailable"),
        variant: "destructive",
      });
      return;
    }
    // Open the bot's Steam profile so the user can send the friend request.
    window.open(result.addUrl, "_blank", "noopener");
  } finally {
    presenceConnecting.value = false;
  }
}

const linkQuery = ref<any>(null);
const linkLoaded = ref(false);
const pendingImports = ref<
  Array<{
    valve_match_id: string;
    status: string;
    error?: string | null;
    map_name?: string | null;
    match_start_time?: string | null;
    created_at: string;
    updated_at: string;
  }>
>([]);

let linkSubHandle: { unsubscribe: () => void } | null = null;
let pendingSubHandle: { unsubscribe: () => void } | null = null;

function teardownSubs() {
  linkSubHandle?.unsubscribe();
  linkSubHandle = null;
  pendingSubHandle?.unsubscribe();
  pendingSubHandle = null;
  presenceSubHandle?.unsubscribe();
  presenceSubHandle = null;
  myMatchSubHandle?.unsubscribe();
  myMatchSubHandle = null;
}

watch(
  () => me.value?.steam_id,
  (steamId) => {
    teardownSubs();
    linkLoaded.value = false;
    if (!steamId) return;

    linkSubHandle = apolloClient
      .subscribe({
        query: LINK_SUBSCRIPTION,
        variables: { steam_id: steamId },
      })
      .subscribe({
        next: ({ data }: any) => {
          linkQuery.value = data?.player_steam_match_auth_by_pk ?? null;
          linkLoaded.value = true;
        },
      });

    presenceSubHandle = apolloClient
      .subscribe({
        query: PRESENCE_FRIEND_SUBSCRIPTION,
        variables: { steam_id: steamId },
      })
      .subscribe({
        next: ({ data }: any) => {
          presenceFriend.value = data?.player_steam_bot_friend_by_pk ?? null;
        },
      });

    myMatchSubHandle = apolloClient
      .subscribe({
        query: MY_LIVE_MATCH_SUBSCRIPTION,
        variables: { steam_id: steamId },
      })
      .subscribe({
        next: ({ data }: any) => {
          myLiveMatchLineup.value =
            data?.players_by_pk?.player_lineup?.[0] ?? null;
        },
      });

    pendingSubHandle = apolloClient
      .subscribe({ query: PENDING_IMPORTS_SUBSCRIPTION })
      .subscribe({
        next: ({ data }: any) => {
          const all = data?.pending_match_imports ?? [];
          // Failed imports can't be retrieved (demo expired / gone from Valve);
          // silently drop them from the queue and hide them from the user.
          for (const entry of all) {
            if (entry.status === "Failed")
              autoClearFailed(entry.valve_match_id);
          }
          pendingImports.value = all.filter(
            (entry: any) => entry.status !== "Failed",
          );
        },
      });
  },
  { immediate: true },
);

onUnmounted(() => {
  teardownSubs();
  stopAwaitingPoll();
});

// Clear the "polling…" state once the auto-poll resolves: pending imports
// arrive, an error surfaces, or the poll completes (last_polled_at is set).
watch(
  [
    () => linkQuery.value?.last_polled_at,
    () => linkQuery.value?.last_error,
    () => pendingImports.value.length,
  ],
  ([polledAt, lastError, pendingCount]) => {
    if (!awaitingPoll.value) return;
    if (polledAt || lastError || (pendingCount as number) > 0) {
      stopAwaitingPoll();
    }
  },
);

async function submitLink() {
  if (!authCode.value || !shareCode.value) return;
  linking.value = true;
  try {
    const { data } = await apolloClient.mutate({
      mutation: LINK_MUTATION,
      variables: { auth_code: authCode.value, share_code: shareCode.value },
    });
    const result = data?.linkSteamMatchHistory;
    if (result?.success) {
      toast({ title: t("pages.settings.linked_accounts.toast_linked") });
      authCode.value = "";
      shareCode.value = "";
      // We auto-poll right after linking — reflect it straight away.
      awaitingPoll.value = true;
      if (awaitingPollTimeout) clearTimeout(awaitingPollTimeout);
      awaitingPollTimeout = setTimeout(stopAwaitingPoll, 90_000);
    } else {
      toast({
        title: t("pages.settings.linked_accounts.toast_could_not_link"),
        description:
          result?.error ?? t("pages.settings.linked_accounts.unknown_error"),
        variant: "destructive",
      });
    }
  } finally {
    linking.value = false;
  }
}

async function submitUnlink() {
  unlinking.value = true;
  try {
    await apolloClient.mutate({ mutation: UNLINK_MUTATION });
    toast({ title: t("pages.settings.linked_accounts.toast_unlinked") });
    showUnlinkConfirm.value = false;
  } finally {
    unlinking.value = false;
  }
}

async function submitPoll() {
  polling.value = true;
  try {
    const { data } = await apolloClient.mutate({ mutation: POLL_MUTATION });
    const result = data?.pollSteamMatchHistory;
    if (result?.success) {
      toast({
        title: t("pages.settings.linked_accounts.toast_polled"),
        description: t("pages.settings.linked_accounts.toast_collected", {
          count: result.collected,
        }),
      });
    } else {
      toast({
        title: t("pages.settings.linked_accounts.toast_poll_failed"),
        description:
          result?.error ?? t("pages.settings.linked_accounts.unknown_error"),
        variant: "destructive",
      });
    }
  } finally {
    polling.value = false;
  }
}

const isLinked = computed(() => !!linkQuery.value);

const busyImportId = ref<string | null>(null);
const autoClearedIds = new Set<string>();

function autoClearFailed(valveMatchId: string) {
  if (autoClearedIds.has(valveMatchId)) return;
  autoClearedIds.add(valveMatchId);
  apolloClient
    .mutate({
      mutation: CLEAR_PENDING_MUTATION,
      variables: { valve_match_id: valveMatchId },
    })
    .catch(() => {
      // best-effort — it's filtered from the UI regardless
    });
}

async function clearImport(valveMatchId: string) {
  busyImportId.value = valveMatchId;
  try {
    await apolloClient.mutate({
      mutation: CLEAR_PENDING_MUTATION,
      variables: { valve_match_id: valveMatchId },
    });
    toast({ title: t("pages.settings.linked_accounts.toast_cleared_import") });
  } finally {
    busyImportId.value = null;
  }
}

const PENDING_STATUSES = ["Queued", "Parsing"] as const;
type PendingStatus = (typeof PENDING_STATUSES)[number];

const pendingFilters = ref<Set<string>>(new Set());
const pendingExpanded = ref(false);
const PENDING_VISIBLE_LIMIT = 25;

const pendingCountsByStatus = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  for (const e of pendingImports.value) {
    out[e.status] = (out[e.status] ?? 0) + 1;
  }
  return out;
});

const filteredPendingImports = computed(() => {
  if (pendingFilters.value.size === 0) {
    return pendingImports.value;
  }
  return pendingImports.value.filter((e) => pendingFilters.value.has(e.status));
});

const visiblePendingImports = computed(() => {
  return pendingExpanded.value
    ? filteredPendingImports.value
    : filteredPendingImports.value.slice(0, PENDING_VISIBLE_LIMIT);
});

const hiddenPendingCount = computed(
  () =>
    filteredPendingImports.value.length - visiblePendingImports.value.length,
);

function togglePendingFilter(status: PendingStatus) {
  if (pendingFilters.value.has(status)) {
    pendingFilters.value.delete(status);
  } else {
    pendingFilters.value.add(status);
  }
  pendingFilters.value = new Set(pendingFilters.value);
}

function formatPendingDate(date: string): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <PageTransition v-if="!linkedAccountsEnabled" :delay="0">
    <div
      class="max-w-xl rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
    >
      {{ $t("pages.settings.application.linked_accounts.disabled_notice") }}
    </div>
  </PageTransition>

  <PageTransition v-if="linkedAccountsEnabled" :delay="100">
    <FadeSwap>
    <div v-if="!linkLoaded" key="loading" class="grid gap-4 max-w-xl">
      <div class="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Skeleton class="h-7 w-7 shrink-0 rounded-md" />
            <div class="space-y-1.5">
              <Skeleton class="h-3.5 w-32" />
              <Skeleton class="h-3 w-44" />
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <Skeleton class="h-8 w-8 rounded-md" />
            <Skeleton class="h-8 w-8 rounded-md" />
          </div>
        </div>
        <div class="space-y-2.5 px-4 py-3">
          <Skeleton class="h-3 w-full" />
          <Skeleton class="h-3 w-2/3" />
        </div>
      </div>
    </div>

    <div v-else-if="!isLinked" key="form" class="grid gap-4 max-w-xl">
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.settings.linked_accounts.need_two_codes") }}
      </p>
      <ol class="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
        <li>
          {{ $t("pages.settings.linked_accounts.step_auth_prefix") }}
          <a
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
            href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128"
            >{{ $t("pages.settings.linked_accounts.steam_auth_code") }}</a
          >
          {{ $t("pages.settings.linked_accounts.step_auth_mid") }}
          <em>{{
            $t("pages.settings.linked_accounts.access_match_history")
          }}</em>
          {{ $t("pages.settings.linked_accounts.step_auth_and_click") }}
          <em>{{ $t("pages.settings.linked_accounts.create_auth_code") }}</em
          >. {{ $t("pages.settings.linked_accounts.generated_once") }}
        </li>
        <li>
          {{ $t("pages.settings.linked_accounts.step_share_prefix") }}
          <strong>{{
            $t("pages.settings.linked_accounts.match_share_code")
          }}</strong>
          {{ $t("pages.settings.linked_accounts.step_share_copy") }}
          <em>{{
            $t("pages.settings.linked_accounts.watch_your_matches")
          }}</em>
          {{ $t("pages.settings.linked_accounts.step_share_within_30") }}
        </li>
      </ol>

      <div class="space-y-2">
        <label class="text-sm font-medium">{{
          $t("pages.settings.linked_accounts.auth_code")
        }}</label>
        <Input
          v-model="authCode"
          placeholder="XXXX-XXXXX-XXXX"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">{{
          $t("pages.settings.linked_accounts.share_code")
        }}</label>
        <Input
          v-model="shareCode"
          placeholder="CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div>
        <Button
          :disabled="!authCode || !shareCode || linking"
          @click="submitLink"
        >
          {{
            linking
              ? $t("pages.settings.linked_accounts.linking")
              : $t("pages.settings.linked_accounts.link_match_history")
          }}
        </Button>
      </div>
    </div>

    <div v-else key="linked" class="grid gap-4 max-w-xl">
      <div class="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
              :class="
                linkQuery?.last_error
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-400'
              "
            >
              <AlertCircle v-if="linkQuery?.last_error" class="w-4 h-4" />
              <CheckCircle2 v-else class="w-4 h-4" />
            </span>
            <div class="min-w-0">
              <div class="text-sm font-medium leading-tight">
                {{
                  linkQuery?.last_error
                    ? $t("pages.settings.linked_accounts.linked_errors")
                    : $t("pages.settings.linked_accounts.linked")
                }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ $t("pages.settings.linked_accounts.last_poll") }}
                <template v-if="linkQuery?.last_polled_at">
                  <TimeAgo :date="linkQuery.last_polled_at" hide-icon />
                </template>
                <template v-else
                  >· {{ $t("pages.settings.linked_accounts.never") }}</template
                >
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <FiveStackToolTip side="bottom">
              <template #trigger>
                <Button
                  size="icon"
                  variant="outline"
                  class="h-8 w-8 transition-shadow"
                  :class="{ 'poll-active': polling || awaitingPoll }"
                  :disabled="polling || awaitingPoll"
                  @click="submitPoll"
                >
                  <RefreshCw
                    class="w-3.5 h-3.5"
                    :class="{ 'poll-spin': polling || awaitingPoll }"
                  />
                </Button>
              </template>
              {{
                polling || awaitingPoll
                  ? $t("pages.settings.linked_accounts.polling")
                  : $t("pages.settings.linked_accounts.poll_now")
              }}
            </FiveStackToolTip>
            <FiveStackToolTip side="bottom">
              <template #trigger>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  :disabled="unlinking"
                  @click="showUnlinkConfirm = true"
                >
                  <Unlink class="w-3.5 h-3.5" />
                </Button>
              </template>
              {{
                unlinking
                  ? $t("pages.settings.linked_accounts.unlinking")
                  : $t("pages.settings.linked_accounts.unlink")
              }}
            </FiveStackToolTip>
          </div>
        </div>

        <dl class="divide-y divide-border/60 text-sm">
          <div class="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt class="text-muted-foreground">
              {{ $t("pages.settings.linked_accounts.most_recent_share_code") }}
            </dt>
            <dd class="text-right">
              <div class="font-mono text-xs break-all">
                {{ linkQuery?.last_known_share_code || "—" }}
              </div>
              <div
                v-if="linkQuery?.last_polled_at"
                class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground mt-0.5"
              >
                {{ $t("pages.settings.linked_accounts.scanned") }}
                <TimeAgo :date="linkQuery.last_polled_at" hide-icon />
              </div>
            </dd>
          </div>
          <div
            v-if="linkQuery?.last_error"
            class="flex items-start justify-between gap-4 px-4 py-2.5"
          >
            <dt class="text-muted-foreground">
              {{ $t("pages.settings.linked_accounts.last_error") }}
            </dt>
            <dd class="font-mono text-xs text-destructive break-all text-right">
              {{ linkQuery.last_error }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- 5stack Steam bot — presence link that powers instant imports.
           Header mirrors the linked-account card above for visual consistency;
           the connected state previews the exact friend-list row (role + rank +
           live status) that friends see. -->
      <div class="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div
          class="flex items-center gap-2.5 px-4 py-3"
          :class="{ 'border-b border-border/60': presenceConnected }"
        >
          <span
            class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
            :class="
              presenceConnected
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
            "
          >
            <CheckCircle2 v-if="presenceConnected" class="w-4 h-4" />
            <Zap v-else class="w-4 h-4" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium leading-tight">
              {{ $t("pages.settings.linked_accounts.presence_title") }}
            </div>
            <div
              class="text-xs"
              :class="
                presenceConnected ? 'text-emerald-400' : 'text-muted-foreground'
              "
            >
              {{
                presenceConnected
                  ? $t("pages.settings.linked_accounts.presence_connected")
                  : $t("pages.settings.linked_accounts.presence_not_connected")
              }}
            </div>
          </div>
        </div>

        <template v-if="presenceConnected">
          <!-- Rendered like a friends-list entry: your avatar, name, role and
               rank plus the live status only friends can see. -->
          <div class="px-4 py-3">
            <div
              class="rounded-md border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <div
                class="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
              >
                {{ $t("pages.settings.linked_accounts.presence_self_label") }}
              </div>
              <PlayerDisplay
                :player="me"
                :show-online="false"
                :linkable="false"
                :truncate-name="true"
                size="sm"
              />
              <PlayerLiveStatus
                :player="selfPresencePlayer"
                online
                show-offline
                class="mt-1.5"
              />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="px-4 py-3 space-y-3">
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.linked_accounts.presence_description") }}
            </p>
            <a
              v-if="presenceAddUrl"
              :href="presenceAddUrl"
              target="_blank"
              rel="noopener"
              class="inline-block"
            >
              <Button size="sm" variant="tactical">
                <UserPlus class="h-4 w-4" />
                {{ $t("pages.settings.linked_accounts.presence_add_bot") }}
              </Button>
            </a>
            <Button
              v-else
              size="sm"
              variant="tactical"
              :disabled="presenceConnecting"
              @click="connectPresence"
            >
              <UserPlus class="h-4 w-4" />
              {{ $t("pages.settings.linked_accounts.presence_connect") }}
            </Button>
            <p
              v-if="presenceFriend && !presenceConnected"
              class="text-xs text-muted-foreground"
            >
              {{ $t("pages.settings.linked_accounts.presence_pending") }}
            </p>
          </div>
        </template>
      </div>
    </div>
    </FadeSwap>
  </PageTransition>

  <AlertDialog v-model:open="showUnlinkConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.settings.linked_accounts.unlink_confirm_title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.settings.linked_accounts.unlink_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="unlinking">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button — radix's AlertDialogAction auto-closes
             before the async mutation can run. -->
        <button
          type="button"
          :disabled="unlinking"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          @click="submitUnlink"
        >
          {{
            unlinking
              ? $t("pages.settings.linked_accounts.unlinking")
              : $t("pages.settings.linked_accounts.unlink")
          }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <PageTransition v-if="linkedAccountsEnabled && awaitingPoll" :delay="120">
    <div
      class="flex items-start gap-2.5 rounded-lg border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-3 text-sm max-w-xl mt-4"
    >
      <Spinner class="w-4 h-4 mt-0.5 shrink-0 text-[hsl(var(--tac-amber))]" />
      <div>
        <div class="font-medium">
          {{ $t("pages.settings.linked_accounts.polling_banner_title") }}
        </div>
        <div class="text-xs text-muted-foreground mt-0.5">
          {{ $t("pages.settings.linked_accounts.polling_banner_description") }}
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition
    v-if="linkedAccountsEnabled && pendingImports.length > 0"
    :delay="150"
  >
    <div class="grid gap-3 max-w-xl mt-8">
      <div>
        <h3 class="text-base font-semibold uppercase tracking-wide">
          {{ $t("pages.settings.linked_accounts.pending_imports") }}
          <span class="text-muted-foreground font-normal">
            ({{ pendingImports.length }})
          </span>
        </h3>
        <p class="text-sm text-muted-foreground mt-0.5">
          {{
            $t("pages.settings.linked_accounts.pending_imports_description")
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="status in PENDING_STATUSES"
          :key="status"
          type="button"
          :disabled="!pendingCountsByStatus[status]"
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-30"
          :class="
            pendingFilters.has(status)
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
              : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
          "
          @click="togglePendingFilter(status)"
        >
          {{ status }}
          <span class="font-bold">
            {{ pendingCountsByStatus[status] ?? 0 }}
          </span>
        </button>
      </div>
      <ul class="divide-y divide-border/40 rounded border border-border/60">
        <li
          v-for="entry in visiblePendingImports"
          :key="entry.valve_match_id"
          class="flex items-center justify-between gap-4 px-3 py-2 text-sm"
        >
          <div class="min-w-0">
            <div v-if="entry.map_name" class="font-medium truncate">
              {{ entry.map_name }}
            </div>
            <div
              v-if="entry.match_start_time"
              class="font-mono text-[0.7rem] text-muted-foreground"
            >
              {{ formatPendingDate(entry.match_start_time) }}
            </div>
            <div
              v-else-if="!entry.map_name"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner class="w-3.5 h-3.5" />
              {{ $t("pages.settings.linked_accounts.importing") }}
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="font-mono text-[0.65rem] uppercase tracking-[0.14em]"
              :class="{
                'text-muted-foreground': entry.status === 'Queued',
                'text-[hsl(45_95%_60%)]': entry.status === 'Parsing',
              }"
            >
              {{ entry.status }}
            </span>
            <Button
              size="sm"
              variant="ghost"
              :disabled="busyImportId === entry.valve_match_id"
              @click="clearImport(entry.valve_match_id)"
            >
              {{ $t("common.clear") }}
            </Button>
          </div>
        </li>
      </ul>
      <div
        v-if="hiddenPendingCount > 0 || pendingExpanded"
        class="flex justify-center"
      >
        <button
          type="button"
          class="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          @click="pendingExpanded = !pendingExpanded"
        >
          <template v-if="pendingExpanded">{{
            $t("pages.settings.linked_accounts.show_less")
          }}</template>
          <template v-else>{{
            $t("pages.settings.linked_accounts.show_more", {
              count: hiddenPendingCount,
            })
          }}</template>
        </button>
      </div>
    </div>
  </PageTransition>
</template>

<style scoped>
/* Polling: a deliberate "scanning" rotation with eased cadence rather than a
   flat linear spin, plus a soft amber glow that ties into the tactical theme. */
.poll-active {
  border-color: hsl(var(--tac-amber) / 0.55);
  color: hsl(var(--tac-amber));
  box-shadow:
    inset 0 0 0 1px hsl(var(--tac-amber) / 0.18),
    0 0 14px -3px hsl(var(--tac-amber) / 0.65);
}

.poll-spin {
  animation: poll-spin 1.5s cubic-bezier(0.66, 0, 0.34, 1) infinite;
  transform-origin: center;
}

@keyframes poll-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .poll-spin {
    animation-duration: 2.4s;
    animation-timing-function: linear;
  }
}
</style>
