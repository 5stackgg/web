<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import ManageSection from "~/components/common/ManageSection.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
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
  DELETE_TOURNAMENT_INVITE_MUTATION,
  TOURNAMENT_INVITES_SUBSCRIPTION,
} from "~/graphql/tournamentInvites";

/**
 * The organizer half of invite-only registration.
 *
 * An invite and the passcode are two doors onto ONE grant: accepting writes the
 * same `tournament_registration_unlocks` row `unlockTournamentRegistration`
 * writes, so nothing downstream — the entry gate, the join button, the free
 * agent pool — has to learn that invites exist. This component only creates and
 * revokes rows; it never touches registration itself.
 */
const props = defineProps<{
  tournament: Record<string, any>;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const invites = ref<any[]>([]);

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
const ineligible = computed(() => {
  const map: Record<string, string> = {};
  for (const invite of invites.value) {
    map[String(invite.steam_id)] = t("tournament.invites.already_invited");
  }
  return map;
});

async function invitePlayer(player: { steam_id: string }) {
  try {
    await apolloClient.mutate({
      mutation: CREATE_TOURNAMENT_INVITE_MUTATION,
      variables: {
        tournamentId: props.tournament.id,
        steamId: player.steam_id,
      },
    });
    toast({ title: t("tournament.invites.sent") });
  } catch (error: unknown) {
    // UNIQUE (tournament_id, steam_id) — inviting someone twice is the same
    // state as inviting them once, so it is reported as a no-op, not a failure.
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

async function revoke(inviteId: string) {
  await apolloClient.mutate({
    mutation: DELETE_TOURNAMENT_INVITE_MUTATION,
    variables: { id: inviteId },
  });
  toast({ title: t("tournament.invites.revoked") });
}
</script>

<template>
  <ManageSection
    id="tournament-invites"
    :label="$t('tournament.invites.title')"
    :hint="$t('tournament.invites.description')"
  >
    <PlayerSearch
      :label="$t('tournament.invites.add')"
      :ineligible="ineligible"
      @selected="invitePlayer"
    />

    <div v-if="invites.length > 0" class="grid gap-2">
      <div
        v-for="invite in invites"
        :key="invite.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/15 px-[0.85rem] py-[0.65rem]"
      >
        <div class="flex min-w-0 items-center gap-[0.65rem]">
          <PlayerDisplay :player="invite.player" />
          <span
            class="rounded-full bg-muted/40 px-[0.45rem] py-[0.1rem] font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("tournament.invites.pending") }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{
              $t("tournament.invites.invited_by", {
                name: invite.invited_by?.name ?? "",
              })
            }}
            <TimeAgo :date="invite.created_at" hide-icon />
          </span>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="outline" size="sm">
                {{ $t("tournament.invites.revoke") }}
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
                      name: invite.player?.name ?? "",
                    })
                  }}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
                <AlertDialogAction @click="revoke(invite.id)">
                  {{ $t("common.confirm") }}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>

    <div
      v-else
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {{ $t("tournament.invites.empty") }}
    </div>
  </ManageSection>
</template>
