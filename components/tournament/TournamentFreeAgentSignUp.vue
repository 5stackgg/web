<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { UserPlus, Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { toast } from "~/components/ui/toast";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { runTournamentAction } from "~/utilities/tournamentActions";

type Agent = Record<string, any>;

const props = withDefaults(
  defineProps<{
    tournament: Record<string, any>;
    // The viewer's own pool row, if they have one. Passed in rather than looked
    // up so this renders the same answer as whatever surface hosts it.
    myEntry?: Agent | null;
    // Only the "already signed up alone" hint reads the pool, so a caller that
    // has not subscribed to it can leave it out.
    pool?: Agent[];
  }>(),
  { myEntry: null, pool: () => [] },
);

const emit = defineEmits<{ joined: [] }>();

const { t } = useI18n();
const { client } = useApolloClient();

const me = computed(() => useAuthStore().me);

const teamSize = computed(
  () =>
    Number(props.tournament?.min_players_per_lineup) ||
    Number(props.tournament?.max_players_per_lineup) ||
    0,
);

// joinTournamentAsFreeAgent requires exactly RegistrationOpen, while the leave
// rule also allows Setup. Offering Sign up during Setup produces a button that
// can only ever fail, so the two windows are kept apart.
const canSignUp = computed(
  () =>
    !!me.value &&
    props.tournament?.status === e_tournament_status_enum.RegistrationOpen &&
    !props.myEntry,
);

// The party IS the matchmaking lobby — there is no separate invite to accept,
// because a captain who can already queue the whole lobby into a live match is
// making a strictly smaller commitment by entering it in a draft. Read straight
// off the store that owns lobby state; a second derivation of "who is in my
// lobby" is how the two answers drift apart.
const lobbyMembers = computed<Agent[]>(() => {
  const lobby = useMatchmakingStore().currentLobby as Agent | undefined;
  // Only accepted members count — a pending invite is not consent, and the API
  // sizes the party the same way.
  return ((lobby?.players ?? []) as Agent[]).filter(
    (member) => member.status === "Accepted",
  );
});

const lobbyCaptain = computed(
  () => lobbyMembers.value.find((member) => member.captain) ?? null,
);

const isLobbyCaptain = computed(() => {
  const steamId = String(me.value?.steam_id ?? "");
  return (
    !!steamId && String(lobbyCaptain.value?.player?.steam_id ?? "") === steamId
  );
});

// A party of more than a full team can never be drafted, so the API refuses the
// signup outright. Signing up alone is the intended escape hatch. Mirrors
// tournament_free_agent_party_fits, which passes a format with no lineup size
// rather than measuring against a zero.
const lobbyFitsTeam = computed(
  () => teamSize.value < 1 || lobbyMembers.value.length <= teamSize.value,
);

const lobbyMembersAlreadyInPool = computed(() => {
  const steamIds = new Set(
    props.pool.map((row) => String(row.player?.steam_id)),
  );
  return lobbyMembers.value.filter((member) =>
    steamIds.has(String(member.player?.steam_id)),
  ).length;
});

const showLobbySignUp = computed(
  () => canSignUp.value && lobbyMembers.value.length > 1,
);

const canSignUpWithLobby = computed(
  () => showLobbySignUp.value && isLobbyCaptain.value && lobbyFitsTeam.value,
);

async function joinPool(withParty = false) {
  const data = await runTournamentAction(
    client,
    {
      joinTournamentAsFreeAgent: [
        {
          tournament_id: props.tournament.id,
          // PRE-CODEGEN ESCAPE HATCH — `with_party` is a new action argument
          // Zeus has not generated, so it rides the `as any` in
          // runTournamentAction. Omitted entirely when false: that is
          // byte-for-byte the old solo signup, which every unmigrated API
          // still accepts.
          ...(withParty ? { with_party: true } : {}),
        },
        {
          success: true,
        },
      ],
    },
    withParty
      ? t("tournament.free_agents.join_with_lobby_failed")
      : t("tournament.free_agents.join_failed"),
  );

  if (!data) {
    return;
  }

  toast({ title: t("tournament.free_agents.joined") });
  emit("joined");
}
</script>

<template>
  <!-- The whole lobby, or nobody: the consequence has to be readable before
       the click, because there is no confirmation step and no invite for the
       other members to accept. -->
  <div
    v-if="showLobbySignUp"
    class="rounded-md border border-l-2 border-border border-l-[hsl(var(--tac-amber))] bg-card/45 p-3.5"
  >
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <Users class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
      <span
        class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("tournament.free_agents.lobby_title") }}
      </span>
      <TournamentChip :tone="lobbyFitsTeam ? 'amber' : 'warn'">
        {{
          $t("tournament.free_agents.lobby_size", {
            count: lobbyMembers.length,
            size: teamSize,
          })
        }}
      </TournamentChip>
    </div>

    <div class="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <PlayerDisplay
        v-for="member in lobbyMembers"
        :key="member.player?.steam_id"
        :player="member.player"
        size="xs"
        :linkable="true"
        :show-elo="false"
        :show-online="false"
        :show-role="false"
      />
    </div>

    <p class="text-[0.78rem] leading-relaxed text-muted-foreground">
      {{
        lobbyFitsTeam
          ? $t("tournament.free_agents.lobby_hint", {
              count: lobbyMembers.length,
              size: teamSize,
            })
          : $t("tournament.free_agents.lobby_too_big", {
              count: lobbyMembers.length,
              size: teamSize,
            })
      }}
    </p>

    <p
      v-if="lobbyFitsTeam && !isLobbyCaptain && lobbyCaptain"
      class="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground"
    >
      {{
        $t("tournament.free_agents.lobby_not_captain", {
          name: lobbyCaptain.player?.name,
        })
      }}
    </p>

    <p
      v-if="canSignUpWithLobby && lobbyMembersAlreadyInPool > 0"
      class="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground"
    >
      {{
        $t("tournament.free_agents.lobby_already_signed_up", {
          count: lobbyMembersAlreadyInPool,
        })
      }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <Button
        v-if="canSignUpWithLobby"
        type="button"
        size="sm"
        class="h-8"
        @click="joinPool(true)"
      >
        <Users class="mr-1.5 h-3.5 w-3.5" />
        {{
          $t("tournament.free_agents.sign_up_with_lobby", {
            count: lobbyMembers.length,
          })
        }}
      </Button>
      <Button
        :variant="canSignUpWithLobby ? 'outline' : 'default'"
        type="button"
        size="sm"
        class="h-8"
        @click="joinPool()"
      >
        <UserPlus class="mr-1.5 h-3.5 w-3.5" />
        {{ $t("tournament.free_agents.sign_up_alone") }}
      </Button>
    </div>
  </div>

  <div
    v-else-if="canSignUp"
    class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card/45 p-3.5"
  >
    <p
      class="min-w-[18ch] flex-1 text-[0.78rem] leading-relaxed text-muted-foreground"
    >
      {{ $t("tournament.free_agents.sign_up_hint", { size: teamSize }) }}
    </p>
    <Button type="button" size="sm" class="h-8 shrink-0" @click="joinPool()">
      <UserPlus class="mr-1.5 h-3.5 w-3.5" />
      {{ $t("tournament.free_agents.sign_up") }}
    </Button>
  </div>
</template>
