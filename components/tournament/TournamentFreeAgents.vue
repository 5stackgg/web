<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient, useSubscription } from "@vue/apollo-composable";
import { Info, RefreshCw, UserMinus, UserPlus } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "~/components/ui/empty";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { toast } from "~/components/ui/toast";
import { $, e_tournament_status_enum } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { useAuthStore } from "~/stores/AuthStore";
import { dateLocale } from "~/utilities/dateLocale";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  tournament: Record<string, any>;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

const me = computed(() => useAuthStore().me);

// tournament_free_agents only exists after the registration migration, so this
// selection is asserted rather than inferred until `yarn codegen` catches up.
// Deliberately un-ordered on the server: the sort key is an enum, and Zeus
// cannot resolve an enum literal on a table its generated schema map has never
// seen — it would emit `"asc"` quoted and Hasura would reject the document.
const { result } = useSubscription(
  generateSubscription({
    tournament_free_agents: [
      {
        where: {
          tournament_id: {
            _eq: $("tournamentId", "uuid!"),
          },
        },
      },
      {
        id: true,
        status: true,
        created_at: true,
        tournament_team_id: true,
        player: playerFields,
        tournament_team: {
          id: true,
          name: true,
        },
      },
    ],
  } as any),
  () => ({ tournamentId: props.tournament.id }),
);

const filter = ref("all");

// Sign-up order is the whole rule — it decides who gets a slot — so it is the
// list's only ordering, applied here rather than server-side.
const pool = computed(() => {
  const rows = ((result.value as any)?.tournament_free_agents ?? []) as Array<
    Record<string, any>
  >;
  return rows
    .filter((row) => row.status !== "withdrawn")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
});

const draftedAgents = computed(() =>
  pool.value.filter((row) => row.status === "drafted"),
);
const waitlistedAgents = computed(() =>
  pool.value.filter((row) => row.status === "waitlisted"),
);

const filterOptions = computed(() => [
  {
    key: "all",
    label: t("tournament.free_agents.filter_all"),
    count: pool.value.length,
  },
  {
    key: "drafted",
    label: t("tournament.free_agents.filter_drafted"),
    count: draftedAgents.value.length,
  },
  {
    key: "waitlist",
    label: t("tournament.free_agents.filter_waitlist"),
    count: waitlistedAgents.value.length,
  },
]);

const visibleAgents = computed(() => {
  if (filter.value === "drafted") {
    return draftedAgents.value;
  }
  if (filter.value === "waitlist") {
    return waitlistedAgents.value;
  }
  return pool.value;
});

const teamSize = computed(
  () =>
    Number(props.tournament?.min_players_per_lineup) ||
    Number(props.tournament?.max_players_per_lineup) ||
    0,
);

// Only the first stage caps the field; later stages are fed by results.
const stageMaxTeams = computed(() => {
  const max = props.tournament?.stages?.[0]?.max_teams;
  return max ? Number(max) : null;
});

const hasDrafted = computed(() => draftedAgents.value.length > 0);

// Before the draft runs this is a projection of what will happen; afterwards it
// is a report of what did. Both read the same, which is the point — an
// organizer should not have to guess whether the numbers are hypothetical.
const projection = computed(() => {
  if (hasDrafted.value) {
    const teamIds = new Set(
      draftedAgents.value
        .map((row) => row.tournament_team_id)
        .filter((id) => !!id),
    );
    return {
      teams: teamIds.size,
      waitlisted: waitlistedAgents.value.length,
    };
  }
  if (teamSize.value < 1) {
    return { teams: 0, waitlisted: pool.value.length };
  }
  const possible = Math.floor(pool.value.length / teamSize.value);
  const teams =
    stageMaxTeams.value === null
      ? possible
      : Math.min(possible, stageMaxTeams.value);
  return {
    teams,
    waitlisted: pool.value.length - teams * teamSize.value,
  };
});

const draftedTeams = computed(() => {
  const groups = new Map<
    string,
    { id: string; name: string; members: Array<Record<string, any>> }
  >();
  for (const row of draftedAgents.value) {
    const id = row.tournament_team_id;
    if (!id) {
      continue;
    }
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: row.tournament_team?.name ?? t("common.untitled"),
        members: [],
      });
    }
    groups.get(id)!.members.push(row);
  }
  return [...groups.values()]
    .map((group) => {
      const elos = group.members
        .map((member) => Number(member.player?.elo))
        .filter((elo) => Number.isFinite(elo));
      return {
        ...group,
        members: group.members
          .slice()
          .sort((a, b) => Number(b.player?.elo ?? 0) - Number(a.player?.elo ?? 0)),
        averageElo: elos.length
          ? Math.round(elos.reduce((sum, elo) => sum + elo, 0) / elos.length)
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
});

// The single most confusing thing about this pool: the best player in it can be
// on the waitlist. Say so out loud instead of letting it look like a bug.
const topRatedWaitlisted = computed(() => {
  if (pool.value.length === 0) {
    return null;
  }
  const best = pool.value.reduce((top, row) =>
    Number(row.player?.elo ?? 0) > Number(top.player?.elo ?? 0) ? row : top,
  );
  return best.status === "waitlisted" ? best : null;
});

const myEntry = computed(() => {
  const steamId = me.value?.steam_id;
  if (!steamId) {
    return null;
  }
  return (
    pool.value.find((row) => row.player?.steam_id === steamId) ?? null
  );
});

const registrationOpen = computed(() =>
  [
    e_tournament_status_enum.Setup,
    e_tournament_status_enum.RegistrationOpen,
  ].includes(props.tournament?.status),
);

const canSignUp = computed(
  () => !!me.value && registrationOpen.value && !myEntry.value,
);

// Leaving after the draft would tear a hole in a seeded team, and the API's
// delete rule stops at RegistrationOpen anyway.
const canLeave = computed(
  () =>
    !!myEntry.value &&
    registrationOpen.value &&
    myEntry.value.status !== "drafted",
);

function signUpTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string) {
  if (status === "drafted") {
    return "ok";
  }
  if (status === "waitlisted") {
    return "warn";
  }
  return "muted";
}

function statusLabel(status: string) {
  if (status === "drafted") {
    return t("tournament.free_agents.status_drafted");
  }
  if (status === "waitlisted") {
    return t("tournament.free_agents.status_waitlisted");
  }
  return t("tournament.free_agents.status_registered");
}

async function runAction(
  mutation: Record<string, any>,
  failureTitle: string,
): Promise<Record<string, any> | null> {
  try {
    const { data } = await client.mutate({
      // Free-agent actions ship with the registration migration; zeus types
      // for them only exist once `yarn codegen` has run against that schema.
      mutation: generateMutation(mutation as any),
    });
    return (data as Record<string, any>) ?? null;
  } catch (error: unknown) {
    toast({
      title: failureTitle,
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
    return null;
  }
}

async function joinPool() {
  await runAction(
    {
      joinTournamentAsFreeAgent: [
        {
          tournament_id: props.tournament.id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.free_agents.join_failed"),
  );
}

async function leavePool() {
  await runAction(
    {
      leaveTournamentAsFreeAgent: [
        {
          tournament_id: props.tournament.id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.free_agents.leave_failed"),
  );
}

async function regenerateTeams() {
  const data = await runAction(
    {
      draftTournamentTeams: [
        {
          tournament_id: props.tournament.id,
        },
        {
          teams_created: true,
        },
      ],
    },
    t("tournament.free_agents.regenerate_failed"),
  );

  if (!data) {
    return;
  }

  toast({
    title: t("tournament.free_agents.regenerated", {
      count: data.draftTournamentTeams?.teams_created ?? 0,
    }),
  });
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div :class="[tacticalSectionLabelClasses, 'mb-0']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("tournament.free_agents.title") }}
        <TournamentChip tone="amber">
          {{
            $t("tournament.free_agents.signed_up", { count: pool.length })
          }}
        </TournamentChip>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <AnimatedFilters
          v-if="pool.length > 0"
          v-model="filter"
          :options="filterOptions"
          square
        />
        <Button
          v-if="canSignUp"
          size="sm"
          class="h-8"
          @click="joinPool"
        >
          <UserPlus class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.free_agents.sign_up") }}
        </Button>
        <Button
          v-else-if="canLeave"
          variant="outline"
          size="sm"
          class="h-8"
          @click="leavePool"
        >
          <UserMinus class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.free_agents.leave") }}
        </Button>
      </div>
    </div>

    <Empty v-if="pool.length === 0" class="min-h-[180px]">
      <EmptyTitle>{{ $t("tournament.free_agents.empty_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("tournament.free_agents.empty_description") }}
      </EmptyDescription>
    </Empty>

    <template v-else>
      <TransitionGroup
        tag="div"
        class="relative flex flex-col gap-1.5"
        enter-active-class="transition-[opacity,transform] [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
        enter-from-class="opacity-0 translate-y-2 motion-reduce:translate-y-0"
        leave-active-class="absolute w-full transition-[opacity,transform] duration-200 ease-in motion-reduce:![transition-duration:1ms]"
        leave-to-class="opacity-0 -translate-y-1 motion-reduce:translate-y-0"
        move-class="transition-transform duration-300 ease-out motion-reduce:!transition-none"
      >
        <div
          v-for="(agent, index) in visibleAgents"
          :key="agent.id"
          class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/45 px-3 py-2 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.35)]"
          :class="{ 'opacity-60': agent.status === 'waitlisted' }"
        >
          <span
            class="w-7 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-muted-foreground"
          >
            {{ String(index + 1).padStart(2, "0") }}
          </span>
          <div class="min-w-0 flex-1">
            <PlayerDisplay
              :player="agent.player"
              size="xs"
              :linkable="true"
              :show-elo="false"
              :show-online="false"
              :show-role="false"
            />
          </div>
          <span
            class="w-14 shrink-0 text-right font-mono text-[0.78rem] font-semibold tabular-nums"
            :class="
              index === 0 && filter === 'all'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-foreground'
            "
          >
            {{ agent.player?.elo ?? "—" }}
          </span>
          <span
            class="w-14 shrink-0 text-right font-mono text-[0.72rem] tabular-nums text-muted-foreground"
          >
            {{ signUpTime(agent.created_at) }}
          </span>
          <TournamentChip :tone="statusTone(agent.status)">
            {{ statusLabel(agent.status) }}
          </TournamentChip>
        </div>
      </TransitionGroup>

      <div
        v-if="topRatedWaitlisted"
        class="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 px-4 py-3 text-[0.78rem] leading-relaxed text-muted-foreground"
      >
        <Info class="mt-px h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span>
          {{
            $t("tournament.free_agents.waitlist_explainer", {
              name: topRatedWaitlisted.player?.name,
            })
          }}
        </span>
      </div>
    </template>

    <template v-if="tournament.is_organizer">
      <div class="h-px bg-border"></div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <div
            class="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("tournament.free_agents.organizer") }}
          </div>
          <div class="text-[0.85rem] text-muted-foreground">
            {{
              $t("tournament.free_agents.draft_summary", {
                agents: pool.length,
                teams: projection.teams,
                size: teamSize,
                waitlisted: projection.waitlisted,
              })
            }}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="h-8 shrink-0"
          @click="regenerateTeams"
        >
          <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.free_agents.regenerate") }}
        </Button>
      </div>

      <div
        v-if="draftedTeams.length > 0"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="team in draftedTeams"
          :key="team.id"
          class="rounded-lg border border-border bg-card/45 p-3.5"
        >
          <div class="mb-2.5 flex items-center justify-between gap-2">
            <strong class="truncate text-[0.9rem] text-foreground">
              {{ team.name }}
            </strong>
            <TournamentChip v-if="team.averageElo !== null">
              {{ $t("common.avg") }} {{ team.averageElo }}
            </TournamentChip>
          </div>
          <div class="flex flex-col gap-1">
            <div
              v-for="member in team.members"
              :key="member.id"
              class="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1"
            >
              <PlayerDisplay
                :player="member.player"
                size="xs"
                :linkable="true"
                :show-elo="false"
                :show-online="false"
                :show-role="false"
              />
              <span
                class="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground"
              >
                {{ member.player?.elo ?? "—" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
