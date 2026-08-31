<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Lock, Trash2 } from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
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
import { toast } from "~/components/ui/toast";
import {
  CREATE_TOURNAMENT_INVITE_MUTATION,
  CREATE_TOURNAMENT_TEAM_INVITE_MUTATION,
  DELETE_TOURNAMENT_INVITE_MUTATION,
  TOURNAMENT_INVITES_SUBSCRIPTION,
} from "~/graphql/tournamentInvites";
import { canSendTournamentInvites } from "~/utilities/tournamentInvites";

/**
 * The organizer's direct-invite list: address a specific team or a specific
 * player, as opposed to the shareable links in TournamentInviteLinks.
 *
 * An invite and a redeemed link are two doors onto ONE grant — accepting writes
 * the same `tournament_registration_unlocks` row — so nothing downstream (the
 * entry gate, the join button, the free agent pool) has to learn that either
 * exists. This component only creates and revokes rows.
 *
 * Deliberately NOT gated on `invite_only`. Invite-only governs who may ENTER,
 * not whether an organizer may invite, exactly as a lobby works; gating the UI
 * on the saved flag is what made invites look impossible to generate. On an
 * open tournament an invite is a shortcut, and the hint below says so.
 */
const props = defineProps<{
  tournament: Record<string, any>;
  // The registration columns, fetched separately by TournamentDetail. Only read
  // to decide which hint to show — never to decide whether to render.
  registration?: Record<string, any> | null;
}>();

// The Teams tab's strip renders this as a live badge, which is the whole reason
// the tabs beat the old stack: "there are 3 people waiting" has to be readable
// without opening the tab. TournamentDetail keeps every pane mounted (v-show)
// precisely so this stays live while another tab is showing.
const emit = defineEmits<{ count: [number] }>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const invites = ref<any[]>([]);

watch(
  () => invites.value.length,
  (count) => emit("count", count),
  { immediate: true },
);

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);

const inviteOnly = computed(() => props.registration?.invite_only === true);

// The API rejects every invite past registration, so the search controls are
// replaced with the reason rather than left offering an action that bounces.
// Existing invites stay listed and revocable — closing registration does not
// make an already-sent invite the organizer's problem to keep.
const canInvite = computed(() =>
  canSendTournamentInvites(props.tournament?.status),
);

let subscription: { unsubscribe: () => void } | null = null;

function subscribe(tournamentId: string) {
  subscription?.unsubscribe();
  subscription = apolloClient
    .subscribe({
      query: TOURNAMENT_INVITES_SUBSCRIPTION,
      variables: { tournamentId },
    })
    .subscribe({
      next: ({ data }: { data?: any }) => {
        invites.value = data?.tournament_invites ?? [];
      },
      error: (error: unknown) =>
        console.warn("tournament invites subscription failed", error),
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

// Rendered dimmed with a reason rather than filtered out: "already invited" is
// the answer the organizer is looking for when they search someone a second
// time, and a player who silently vanishes from the results reads as "no such
// player".
const ineligiblePlayers = computed(() => {
  const map: Record<string, string> = {};
  for (const invite of invites.value) {
    if (invite.steam_id) {
      map[String(invite.steam_id)] = t("tournament.invites.already_invited");
    }
  }
  return map;
});

// Two reasons, most specific last so it wins: a team already registered is a
// stronger answer than "already invited", and inviting it again does nothing.
const ineligibleTeams = computed(() => {
  const map: Record<string, string> = {};
  for (const invite of invites.value) {
    if (invite.team_id) {
      map[String(invite.team_id)] = t("tournament.invites.already_invited");
    }
  }
  for (const team of props.tournament?.teams ?? []) {
    if (team.team_id) {
      map[String(team.team_id)] = t("team.search.ineligible.in_tournament");
    }
  }
  return map;
});

function teamAvatarSrc(team: { avatar_url?: string | null }): string | null {
  if (!team?.avatar_url) {
    return null;
  }
  return `https://${apiDomain.value}/${team.avatar_url}`;
}

function inviteName(invite: Record<string, any>): string {
  return invite.team?.name ?? invite.player?.name ?? "";
}

// UNIQUE (tournament_id, steam_id) / (tournament_id, team_id) — inviting the
// same recipient twice is the same state as inviting them once, so it is
// reported as a no-op rather than surfaced as a failure.
async function sendInvite(mutation: any, variables: Record<string, any>) {
  try {
    await apolloClient.mutate({ mutation, variables });
    toast({ title: t("tournament.invites.sent") });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/uniqueness violation|already exists/i.test(message)) {
      toast({ title: t("tournament.invites.already_invited") });
      return;
    }
    toast({
      title: t("tournament.invites.send_failed"),
      description: message,
      variant: "destructive",
    });
  }
}

function invitePlayer(player: { steam_id: string }) {
  return sendInvite(CREATE_TOURNAMENT_INVITE_MUTATION, {
    tournamentId: props.tournament.id,
    steamId: player.steam_id,
  });
}

function inviteTeam(team: { id: string }) {
  if (!team?.id) {
    return;
  }
  return sendInvite(CREATE_TOURNAMENT_TEAM_INVITE_MUTATION, {
    tournamentId: props.tournament.id,
    teamId: team.id,
  });
}

async function revoke(inviteId: string) {
  await apolloClient.mutate({
    mutation: DELETE_TOURNAMENT_INVITE_MUTATION,
    variables: { id: inviteId },
  });
  toast({ title: t("tournament.invites.revoked") });
}
</script>

<template>
  <div class="grid gap-3">
    <p
      v-if="canInvite"
      class="max-w-prose text-[0.75rem] leading-snug text-muted-foreground/80"
    >
      {{
        inviteOnly
          ? $t("tournament.invites.description")
          : $t("tournament.invites.hint_open")
      }}
    </p>

    <div
      v-else
      class="flex max-w-prose items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[0.72rem] leading-snug text-warning"
    >
      <Lock class="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{{ $t("tournament.invites.registration_closed") }}</span>
    </div>

    <!-- No v-model on either search: an invite is an action, not a selection,
         so the control must fall back to its own label after each one rather
         than sitting on the last recipient. TeamSearch would otherwise pin the
         chosen team in the trigger (it reads `modelValue`, where PlayerSearch
         reads `selected`).
         Side by side once there is room: they are two halves of one question
         ("who do I invite"), and stacked across the full width of the Teams tab
         each search stretches into a banner that reads as two unrelated steps. -->
    <div v-if="canInvite" class="grid gap-3 sm:grid-cols-2">
      <TeamSearch
        :label="$t('tournament.invites.add_team')"
        :ineligible="ineligibleTeams"
        @selected="inviteTeam"
      />

      <PlayerSearch
        :label="$t('tournament.invites.add')"
        :ineligible="ineligiblePlayers"
        @selected="invitePlayer"
      />
    </div>

    <ul v-if="invites.length > 0" class="grid gap-1.5">
      <!-- One wrapping flex row rather than a two-line grid. `order` is what
           makes it work at both widths: narrow, the revoke button stays pinned
           to the name it revokes and the meta drops to its own full-width line;
           wide, the meta slides inline and the button goes to the far edge
           instead of leaving a lane of empty row behind it. -->
      <li
        v-for="invite in invites"
        :key="invite.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-dashed border-border bg-muted/15 px-3 py-2.5"
      >
        <div class="order-1 flex min-w-0 flex-1 items-center gap-2">
          <PlayerDisplay v-if="invite.player" :player="invite.player" />
          <template v-else>
            <Avatar class="h-5 w-5 shrink-0 rounded">
              <AvatarImage
                v-if="teamAvatarSrc(invite.team)"
                :src="teamAvatarSrc(invite.team)!"
                :alt="invite.team?.name"
              />
              <AvatarFallback class="rounded text-[0.55rem]">
                {{
                  (invite.team?.short_name || invite.team?.name || "").slice(
                    0,
                    2,
                  )
                }}
              </AvatarFallback>
            </Avatar>
            <span class="truncate text-sm">{{ invite.team?.name }}</span>
          </template>
        </div>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="order-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive sm:order-3"
              :title="$t('tournament.invites.revoke')"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ $t("tournament.invites.confirm_revoke") }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t("tournament.invites.revoke_description", {
                    name: inviteName(invite),
                  })
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                @click="revoke(invite.id)"
              >
                {{ $t("tournament.invites.revoke") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div
          class="order-3 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-muted-foreground sm:order-2 sm:w-auto sm:justify-end"
        >
          <span
            class="rounded-full bg-muted/40 px-[0.4rem] py-[0.05rem] font-mono text-[0.55rem] font-bold uppercase tracking-[0.18em]"
          >
            {{
              invite.team_id
                ? $t("tournament.invites.team_label")
                : $t("tournament.invites.pending")
            }}
          </span>
          <span>
            {{
              $t("tournament.invites.invited_by", {
                name: invite.invited_by?.name ?? "",
              })
            }}
          </span>
          <TimeAgo :date="invite.created_at" hide-icon />
        </div>
      </li>
    </ul>

    <div
      v-else
      class="rounded-sm border border-dashed border-border px-3 py-4 text-center text-[0.75rem] text-muted-foreground"
    >
      {{ $t("tournament.invites.empty") }}
    </div>
  </div>
</template>
