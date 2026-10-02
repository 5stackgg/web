<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { CalendarClock, Lock } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import { FadeSwap, Fold } from "~/components/ui/transitions";
import ProposeTimeDialog from "~/components/league/ProposeTimeDialog.vue";
import BracketNegotiationDialog from "~/components/tournament/BracketNegotiationDialog.vue";
import {
  PROPOSE_TIME_MUTATION,
  RESPOND_PROPOSAL_MUTATION,
} from "~/graphql/leagues";
import { MY_TEAM_MANAGERS_QUERY } from "~/graphql/bracketNegotiation";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { localTimeInput } from "~/utilities/leagueFixtures";
import {
  bracketAgreedAt,
  bracketNegotiationStatus,
  bracketPendingProposals,
  bracketProposalWindow,
  type BracketNegotiationStatus,
  type NegotiationViewer,
  type NegotiationWindow,
} from "~/utilities/bracketNegotiation";
import type { Bracket } from "~/types/tournament";

const props = defineProps<{
  bracket: Bracket;
  windows?: NegotiationWindow[] | null;
  title: string;
  bestOf?: number | null;
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();

type ManagedTeam = {
  id: string;
  owner_steam_id: string | null;
  captain_steam_id: string | null;
  roster: Array<{ player_steam_id: string }>;
};

const managedTeams = ref<ManagedTeam[]>([]);
const dialogOpen = ref(false);
const proposeOpen = ref(false);
const counterProposalId = ref<string | null>(null);
const busy = ref(false);

watch(
  () => authStore.me?.steam_id,
  async (steamId) => {
    managedTeams.value = [];
    if (!steamId) {
      return;
    }
    try {
      const { data } = await nuxtApp.$apollo.defaultClient.query({
        query: MY_TEAM_MANAGERS_QUERY,
        variables: { steamId },
        fetchPolicy: "cache-first",
      });
      if (authStore.me?.steam_id !== steamId) {
        return;
      }
      managedTeams.value = data?.teams ?? [];
    } catch {
      managedTeams.value = [];
    }
  },
  { immediate: true },
);

const viewer = computed<NegotiationViewer>(() => ({
  isAdmin: authStore.isRoleAbove(e_player_roles_enum.administrator),
  mySteamId: authStore.me?.steam_id ? String(authStore.me.steam_id) : null,
  managedTeamIds: managedTeams.value.map((team) => team.id),
  teamManagers: Object.fromEntries(
    managedTeams.value.map((team) => [
      team.id,
      [
        team.owner_steam_id,
        team.captain_steam_id,
        ...team.roster.map((member) => member.player_steam_id),
      ]
        .filter((steamId): steamId is string => !!steamId)
        .map(String),
    ]),
  ),
}));

const status = computed(() =>
  bracketNegotiationStatus(props.bracket, viewer.value),
);
const pending = computed(() => bracketPendingProposals(props.bracket));
const cardTime = computed(
  () => pending.value[0]?.proposed_time ?? bracketAgreedAt(props.bracket),
);

const proposalWindow = computed(() =>
  bracketProposalWindow(props.windows, props.bracket, new Date()),
);
const proposeInitialDate = computed(() => {
  const opensAt = new Date(proposalWindow.value.opensAt);
  const now = new Date();
  return (opensAt > now ? opensAt : now).toISOString();
});

function teamName(team: Bracket["team_1"]): string {
  return team?.team?.name || team?.name || t("common.tbd");
}

const matchup = computed(() =>
  [props.bracket.team_1, props.bracket.team_2].map(teamName).join(" vs "),
);

const STATUS_CLASSES: Record<BracketNegotiationStatus, string> = {
  default:
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  "pending-me":
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  "pending-them": "border-border bg-muted/30 text-muted-foreground",
  agreed: "border-border bg-muted/40 text-foreground",
};

function formatLocal(value: string): string {
  return new Date(value).toLocaleString(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function openPropose(proposalId: string | null) {
  dialogOpen.value = false;
  counterProposalId.value = proposalId;
  proposeOpen.value = true;
}

function onProposeOpen(open: boolean) {
  proposeOpen.value = open;
  if (!open) {
    counterProposalId.value = null;
  }
}

function onError(error: any) {
  toast({ title: error?.message ?? String(error), variant: "destructive" });
}

async function respond(proposalId: string, status: "Accepted" | "Declined") {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: RESPOND_PROPOSAL_MUTATION,
      variables: { proposalId, status },
    });
  } catch (error) {
    onError(error);
  } finally {
    busy.value = false;
  }
}

async function onProposeSubmit(proposedTime: string, message: string) {
  if (busy.value) {
    return;
  }
  const countering = counterProposalId.value;
  busy.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: PROPOSE_TIME_MUTATION,
      variables: {
        bracketId: props.bracket.id,
        proposedTime,
        message: message || null,
      },
    });
    // Countered only after the new time is accepted by the server: a time the
    // trigger rejects must not strand the offer that was on the table.
    if (countering) {
      await nuxtApp.$apollo.defaultClient.mutate({
        mutation: RESPOND_PROPOSAL_MUTATION,
        variables: { proposalId: countering, status: "Countered" },
      });
    }
    toast({ title: t("league.schedule.proposed") });
  } catch (error) {
    onError(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-1 text-xs" @click.stop>
    <FadeSwap>
      <span
        :key="status"
        data-testid="negotiation-status"
        class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em]"
        :class="STATUS_CLASSES[status]"
      >
        <Lock v-if="status === 'agreed'" class="h-3 w-3" />
        {{ $t(`league.calendar.status.${status}`) }}
      </span>
    </FadeSwap>

    <Fold :open="!!cardTime">
      <FadeSwap>
        <span
          :key="cardTime ?? 'none'"
          class="block font-medium"
          :class="
            pending.length ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'
          "
        >
          {{ cardTime ? formatLocal(cardTime) : "" }}
        </span>
      </FadeSwap>
    </Fold>

    <Button
      size="sm"
      variant="outline"
      class="h-6 gap-1 px-2 text-[0.65rem] [&_svg]:size-3"
      @click.stop="dialogOpen = true"
    >
      <CalendarClock class="h-3 w-3" />
      {{ $t("tournament.negotiation.schedule") }}
    </Button>

    <BracketNegotiationDialog
      :open="dialogOpen"
      :bracket="bracket"
      :title="title"
      :best-of="bestOf"
      :viewer="viewer"
      :window-opens-at="proposalWindow.opensAt"
      :window-closes-at="proposalWindow.closesAt"
      :round-window="proposalWindow.roundWindow"
      :busy="busy"
      :respond="respond"
      @update:open="dialogOpen = $event"
      @propose="openPropose(null)"
      @counter="openPropose"
    />

    <ProposeTimeDialog
      v-if="proposeOpen"
      :open="proposeOpen"
      :week-opens-at="proposalWindow.opensAt"
      :week-closes-at="proposalWindow.closesAt"
      :initial-date="proposeInitialDate"
      :default-time="
        proposalWindow.defaultMatchAt
          ? localTimeInput(proposalWindow.defaultMatchAt)
          : null
      "
      :matchup="matchup"
      :scope="title"
      :outside-window-message="
        proposalWindow.roundWindow
          ? $t('tournament.negotiation.outside_window')
          : $t('tournament.negotiation.outside_two_weeks')
      "
      @update:open="onProposeOpen"
      @submit="onProposeSubmit"
    />
  </div>
</template>
