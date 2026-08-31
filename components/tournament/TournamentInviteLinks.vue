<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  ChevronDown,
  Copy,
  Link2,
  Lock,
  Share2,
  Trash2,
} from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Fold } from "~/components/ui/transitions";
import { toast } from "~/components/ui/toast";
import {
  CREATE_TOURNAMENT_INVITE_CODE_MUTATION,
  REVOKE_TOURNAMENT_INVITE_CODE_MUTATION,
  TOURNAMENT_INVITE_CODES_SUBSCRIPTION,
  TOURNAMENT_INVITE_CODE_USES_QUERY,
} from "~/graphql/tournamentInviteCodes";
import {
  canSendTournamentInvites,
  tournamentInviteUrl,
} from "~/utilities/tournamentInvites";

/**
 * Shareable invite links — the replacement for the typed registration
 * passcode, which was a static bearer secret that never expired, could not be
 * revoked, and left no record of who had used it.
 *
 * A link is only ever a shortcut past the invite-only gate; it grants nothing
 * else. Redemption is an explicit act on the tournament page (see the accept
 * prompt in TournamentDetail), never something the link performs on arrival.
 */
const props = defineProps<{
  tournament: Record<string, any>;
}>();

// Live badge on the Teams tab's Links tab. Counts exactly what the list below
// shows (every non-revoked link), so the two can never disagree — a dead link is
// still a link the organizer handed out and may be asked about.
const emit = defineEmits<{ count: [number] }>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

// reka-ui reserves the empty model value for "nothing selected", so "no expiry"
// and "no cap" travel as sentinels and are translated back to the null the
// action reads as never / unlimited.
const NEVER = "never";
const UNLIMITED = "unlimited";

const EXPIRY_OPTIONS = [
  { value: "30", minutes: 30 },
  { value: "60", minutes: 60 },
  { value: "360", minutes: 360 },
  { value: "720", minutes: 720 },
  { value: "1440", minutes: 1440 },
  { value: "10080", minutes: 10080 },
  { value: NEVER, minutes: null },
];

const MAX_USES_OPTIONS = [
  { value: "1", uses: 1 },
  { value: "5", uses: 5 },
  { value: "10", uses: 10 },
  { value: "25", uses: 25 },
  { value: "50", uses: 50 },
  { value: "100", uses: 100 },
  { value: UNLIMITED, uses: null },
];

// Discord's defaults, and the right ones here: a link an organizer pastes into
// a Discord channel should stop working on its own if they forget about it.
const expiry = ref("1440");
const maxUses = ref(UNLIMITED);

const codes = ref<any[]>([]);
const expanded = ref<Record<string, boolean>>({});
const usesByCode = ref<Record<string, any[]>>({});

watch(
  () => codes.value.length,
  (count) => emit("count", count),
  { immediate: true },
);

// Minting a link is an invite, and the API refuses one past registration. The
// generator is replaced with the reason; revoking stays available, because
// killing a link that is already out there is the one thing an organizer still
// needs to be able to do after registration shuts.
const canInvite = computed(() =>
  canSendTournamentInvites(props.tournament?.status),
);

let subscription: { unsubscribe: () => void } | null = null;

function subscribe(tournamentId: string) {
  subscription?.unsubscribe();
  subscription = apolloClient
    .subscribe({
      query: TOURNAMENT_INVITE_CODES_SUBSCRIPTION,
      variables: { tournamentId },
    })
    .subscribe({
      next: ({ data }: { data?: any }) => {
        codes.value = data?.tournament_invite_codes ?? [];
      },
      error: (error: unknown) =>
        console.warn("tournament invite codes subscription failed", error),
    });
}

watch(
  () => props.tournament?.id,
  (tournamentId) => {
    if (tournamentId) {
      subscribe(tournamentId);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  subscription?.unsubscribe();
  subscription = null;
});

function expiryLabel(option: { value: string; minutes: number | null }) {
  if (option.minutes === null) {
    return t("tournament.invite_links.expiry_never");
  }
  if (option.minutes < 60) {
    return t("tournament.invite_links.expiry_minutes", {
      count: option.minutes,
    });
  }
  // Singular carries its own key rather than a count of 1: "1 hours" is wrong
  // in English and the plural rule is not the same in every locale this file
  // gets translated into.
  if (option.minutes < 1440) {
    const hours = option.minutes / 60;
    return hours === 1
      ? t("tournament.invite_links.expiry_hour")
      : t("tournament.invite_links.expiry_hours", { count: hours });
  }
  const days = option.minutes / 1440;
  return days === 1
    ? t("tournament.invite_links.expiry_day")
    : t("tournament.invite_links.expiry_days", { count: days });
}

function maxUsesLabel(option: { value: string; uses: number | null }) {
  if (option.uses === null) {
    return t("tournament.invite_links.uses_unlimited");
  }
  if (option.uses === 1) {
    return t("tournament.invite_links.uses_one");
  }
  return t("tournament.invite_links.uses_limit", { count: option.uses });
}

function linkFor(code: Record<string, any>) {
  return tournamentInviteUrl(props.tournament.id, code.code);
}

function isExpired(code: Record<string, any>): boolean {
  return !!code.expires_at && new Date(code.expires_at).getTime() <= Date.now();
}

function isExhausted(code: Record<string, any>): boolean {
  return code.max_uses != null && Number(code.uses) >= Number(code.max_uses);
}

// A link that can no longer let anyone in is kept on screen rather than hidden:
// "the link I sent stopped working" is a question the organizer asks, and an
// empty list is not an answer.
function isDead(code: Record<string, any>): boolean {
  return isExpired(code) || isExhausted(code);
}

function usesLabel(code: Record<string, any>): string {
  return code.max_uses == null
    ? t("tournament.invite_links.uses_count", { count: Number(code.uses ?? 0) })
    : `${Number(code.uses ?? 0)} / ${Number(code.max_uses)}`;
}

async function createLink() {
  const minutes = EXPIRY_OPTIONS.find(
    (option) => option.value === expiry.value,
  )?.minutes;
  const uses = MAX_USES_OPTIONS.find(
    (option) => option.value === maxUses.value,
  )?.uses;

  try {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_TOURNAMENT_INVITE_CODE_MUTATION,
      variables: {
        tournamentId: props.tournament.id,
        expiresInMinutes: minutes ?? null,
        maxUses: uses ?? null,
      },
    });

    const code = (data as any)?.createTournamentInviteCode?.code;
    if (code && typeof navigator !== "undefined" && navigator.clipboard) {
      // The one thing the organizer wants next is the link in their paste
      // buffer. A failure here is not a failure of the link, which is already
      // on screen with its own copy control.
      await navigator.clipboard
        .writeText(tournamentInviteUrl(props.tournament.id, code))
        .catch(() => undefined);
    }

    toast({ title: t("tournament.invite_links.created") });
  } catch (error: unknown) {
    toast({
      title: t("tournament.invite_links.create_failed"),
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  }
}

async function revoke(inviteCodeId: string) {
  try {
    await apolloClient.mutate({
      mutation: REVOKE_TOURNAMENT_INVITE_CODE_MUTATION,
      variables: { inviteCodeId },
    });
    toast({ title: t("tournament.invite_links.revoked") });
  } catch (error: unknown) {
    toast({
      title: t("tournament.invite_links.revoke_failed"),
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  }
}

// Same shape as useClipShare: the OS share sheet on a touch device is one tap
// to Discord/Messages instead of paste-and-go, and an aborted sheet is a
// deliberate cancel, not an error to fall back from.
const canShare = computed(
  () =>
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(pointer: coarse)").matches,
);

async function share(code: Record<string, any>) {
  try {
    await navigator.share({ url: linkFor(code) });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return;
    }
    toast({
      title: t("toasts.copy_failed"),
      description: linkFor(code),
      variant: "destructive",
    });
  }
}

// Fetched on demand rather than subscribed: an organizer opens this to read it
// once, and a live socket per expanded row buys nothing. A failure (the most
// likely being a `player`/`team` relationship named differently by the API)
// leaves the row empty instead of taking the panel down.
async function toggleUses(code: Record<string, any>) {
  const open = !expanded.value[code.id];
  expanded.value = { ...expanded.value, [code.id]: open };
  if (!open || usesByCode.value[code.id]) {
    return;
  }

  try {
    const { data } = await apolloClient.query({
      query: TOURNAMENT_INVITE_CODE_USES_QUERY,
      variables: { inviteCodeId: code.id },
      fetchPolicy: "network-only",
    });
    usesByCode.value = {
      ...usesByCode.value,
      [code.id]: (data as any)?.tournament_invite_code_uses ?? [],
    };
  } catch (error: unknown) {
    console.warn("tournament invite code uses query failed", error);
    usesByCode.value = { ...usesByCode.value, [code.id]: [] };
  }
}
</script>

<template>
  <div class="grid gap-3">
    <p
      v-if="canInvite"
      class="max-w-prose text-[0.75rem] leading-snug text-muted-foreground/80"
    >
      {{ $t("tournament.invite_links.hint") }}
    </p>

    <div
      v-else
      class="flex max-w-prose items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[0.72rem] leading-snug text-warning"
    >
      <Lock class="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{{ $t("tournament.invite_links.registration_closed") }}</span>
    </div>

    <!-- Expiry, cap and the mint button are one sentence, so at width they get
         one row. Stacked, the button stretched into a full-width banner that
         read as the pane's primary action rather than the tail of the two
         selects above it. Fixed tracks, not `1fr`: across the full Teams column
         a fraction would blow a "30 minutes" dropdown out to 400px, so the row
         sizes to its controls and leaves the slack on the right. -->
    <div
      v-if="canInvite"
      class="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,13rem)_auto] sm:items-end sm:gap-3"
    >
      <label class="grid gap-1">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {{ $t("tournament.invite_links.expires_after") }}
        </span>
        <Select v-model="expiry">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="option in EXPIRY_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ expiryLabel(option) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>

      <label class="grid gap-1">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {{ $t("tournament.invite_links.max_uses") }}
        </span>
        <Select v-model="maxUses">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="option in MAX_USES_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ maxUsesLabel(option) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>

      <!-- Button, not a bare <button>: it tracks the returned promise, so a
           double click cannot mint two links. `sm` so it lands on the same 2rem
           row height as the two selects it sits beside. -->
      <Button
        variant="tactical"
        size="sm"
        class="col-span-2 w-full sm:col-span-1 sm:w-auto"
        @click="createLink"
      >
        <Link2 class="h-4 w-4" />
        {{ $t("tournament.invite_links.create") }}
      </Button>
    </div>

    <ul v-if="codes.length > 0" class="grid gap-1.5">
      <!-- One wrapping flex row rather than a stack of full-width lines. The
           `order` swap is what makes the same markup work in both places: on a
           phone the copy/share/revoke cluster stays welded to the code it acts
           on and the status drops below, while at width the status slides
           inline instead of leaving an empty lane across the row. -->
      <li
        v-for="code in codes"
        :key="code.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-dashed border-border bg-muted/15 px-3 py-2.5 transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        :class="isDead(code) ? 'opacity-55' : ''"
      >
        <span
          class="order-1 min-w-0 flex-1 truncate font-mono text-[0.78rem] tracking-[0.08em] text-foreground"
        >
          {{ code.code }}
        </span>

        <div
          class="order-3 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-muted-foreground sm:order-2 sm:w-auto sm:justify-end"
        >
          <span class="tabular-nums">{{ usesLabel(code) }}</span>
          <span class="opacity-40">·</span>
          <span v-if="isExhausted(code)" class="text-warning">
            {{ $t("tournament.invite_links.exhausted") }}
          </span>
          <span v-else-if="isExpired(code)" class="text-warning">
            {{ $t("tournament.invite_links.expired") }}
          </span>
          <span v-else-if="code.expires_at" class="inline-flex gap-1">
            {{ $t("tournament.invite_links.expires") }}
            <TimeAgo :date="code.expires_at" hide-icon />
          </span>
          <span v-else>{{ $t("tournament.invite_links.never_expires") }}</span>
        </div>

        <div class="order-2 flex shrink-0 items-center gap-1 sm:order-3">
          <!-- The whole URL, not the bare code: what an organizer pastes into
               Discord has to be clickable. -->
          <ClipBoard :data="linkFor(code)" class="h-7 w-7 shrink-0">
            <Copy class="h-3.5 w-3.5" />
          </ClipBoard>
          <Button
            v-if="canShare"
            variant="ghost"
            size="icon"
            class="h-7 w-7 shrink-0 text-muted-foreground"
            :title="$t('tournament.invite_links.share')"
            @click="share(code)"
          >
            <Share2 class="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                :title="$t('tournament.invite_links.revoke')"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {{ $t("tournament.invite_links.confirm_revoke") }}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {{ $t("tournament.invite_links.revoke_description") }}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  @click="revoke(code.id)"
                >
                  {{ $t("tournament.invite_links.revoke") }}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <!-- Wrapper gated on the same condition as the toggle inside it: an
             always-rendered `w-full` flex child would claim a row of its own
             plus the row gap even while empty, so an unused link would sit in a
             taller card than a used one. -->
        <div v-if="Number(code.uses ?? 0) > 0" class="order-4 w-full">
          <button
            type="button"
            class="inline-flex items-center gap-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-opacity duration-150 hover:opacity-80 motion-reduce:transition-none"
            @click="toggleUses(code)"
          >
            {{ $t("tournament.invite_links.who_used") }}
            <ChevronDown
              class="h-3 w-3 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              :class="expanded[code.id] ? 'rotate-180' : ''"
            />
          </button>

          <Fold :open="!!expanded[code.id]">
            <!-- Two per row at width: a name and a timestamp pushed to opposite
                 ends of the full column would be joined by nothing but rule-less
                 whitespace. -->
            <ul class="grid gap-1 pt-1.5 sm:grid-cols-2 sm:gap-x-8">
              <li
                v-for="use in usesByCode[code.id] ?? []"
                :key="`${use.player_steam_id}`"
                class="flex min-w-0 items-center justify-between gap-2 text-[0.7rem]"
              >
                <span class="truncate">
                  {{ use.player?.name ?? use.player_steam_id }}
                  <span v-if="use.team" class="text-muted-foreground">
                    · {{ use.team.name }}
                  </span>
                </span>
                <TimeAgo
                  :date="use.used_at"
                  hide-icon
                  class="shrink-0 text-muted-foreground"
                />
              </li>
              <li
                v-if="(usesByCode[code.id] ?? []).length === 0"
                class="text-[0.7rem] text-muted-foreground sm:col-span-2"
              >
                {{ $t("tournament.invite_links.uses_empty") }}
              </li>
            </ul>
          </Fold>
        </div>
      </li>
    </ul>

    <div
      v-else
      class="rounded-sm border border-dashed border-border px-3 py-4 text-center text-[0.75rem] text-muted-foreground"
    >
      {{ $t("tournament.invite_links.empty") }}
    </div>
  </div>
</template>
