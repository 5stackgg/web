<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient, useSubscription } from "@vue/apollo-composable";
import { Info, RefreshCw, UserMinus, UserPlus, Users } from "lucide-vue-next";
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
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
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

type Agent = Record<string, any>;

/** A party, or a solo free agent. The draft only ever moves whole units. */
type Unit = {
  key: string;
  partyId: string | null;
  members: Agent[];
};

const me = computed(() => useAuthStore().me);

// tournament_free_agents only exists after the registration migration, so this
// selection is asserted rather than inferred until `yarn codegen` catches up.
// Deliberately un-ordered on the server: the sort key is an enum, and Zeus
// cannot resolve an enum literal on a table its generated schema map has never
// seen — it would emit `"asc"` quoted and Hasura would reject the document.
//
// PRE-CODEGEN ESCAPE HATCH — `party_id` lands with the free-agent-parties
// migration, so it rides the same `as any`; drop nothing here but the cast once
// `yarn codegen` has run against a migrated stack.
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
        party_id: true,
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

// A party's priority is its FOUNDER's signup — MIN(created_at), tie-broken by
// MIN(id). That is both a floor and a ceiling: a latecomer can neither lift the
// party ahead of anyone who signed up before the founder nor push the founder
// back. Sign-up order is the whole rule, so it is the list's only ordering.
function compareSignup(a: Agent, b: Agent) {
  const left = new Date(a.created_at).getTime();
  const right = new Date(b.created_at).getTime();
  if (left !== right) {
    return left - right;
  }
  return String(a.id).localeCompare(String(b.id));
}

// `party_id` IS the matchmaking lobby id the signup came from, so every row
// carrying the same one is a single entity to the draft. Rendering them as
// unrelated adjacent rows would hide the only thing that makes them a party.
function groupUnits(rows: Agent[]): Unit[] {
  const byParty = new Map<string, Unit>();
  const units: Unit[] = [];

  for (const row of rows) {
    const partyId = row.party_id ? String(row.party_id) : null;
    if (!partyId) {
      units.push({ key: String(row.id), partyId: null, members: [row] });
      continue;
    }

    const existing = byParty.get(partyId);
    if (existing) {
      existing.members.push(row);
      continue;
    }

    const unit: Unit = { key: `party:${partyId}`, partyId, members: [row] };
    byParty.set(partyId, unit);
    units.push(unit);
  }

  return units;
}

const poolUnits = computed<Unit[]>(() => {
  const rows = ((result.value as any)?.tournament_free_agents ?? []) as Agent[];
  return groupUnits(rows.filter((row) => row.status !== "withdrawn"))
    .map((unit) => ({
      ...unit,
      members: unit.members.slice().sort(compareSignup),
    }))
    .sort((a, b) => compareSignup(a.members[0], b.members[0]));
});

const pool = computed(() => poolUnits.value.flatMap((unit) => unit.members));

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

function matchesFilter(agent: Agent) {
  if (filter.value === "drafted") {
    return agent.status === "drafted";
  }
  if (filter.value === "waitlist") {
    return agent.status === "waitlisted";
  }
  return true;
}

// The queue position runs across the whole visible list, not per unit — it is
// the answer to "who is ahead of me", which parties do not change.
const visibleUnits = computed(() => {
  let position = 0;

  return poolUnits.value
    .map((unit) => {
      const rows = unit.members.filter(matchesFilter).map((agent) => {
        position += 1;
        return { position, agent };
      });
      const statuses = new Set(rows.map((row) => row.agent.status));
      return {
        key: unit.key,
        rows,
        // The promotion split is the one thing that can leave a lone member
        // holding a party id; one person is not a party, so it renders plain.
        isParty: !!unit.partyId && rows.length > 1,
        status: statuses.size === 1 ? [...statuses][0] : "",
      };
    })
    .filter((unit) => unit.rows.length > 0);
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

// `both` mode drafts into whatever room the bracket has LEFT, not the whole
// cap: the server's limit is GREATEST(max_teams - existing_teams, 0). Ignoring
// the registered teams promises slots that were already taken.
const existingTeams = computed(
  () => Number(props.tournament?.teams_aggregate?.aggregate?.count) || 0,
);

const hasDrafted = computed(() => draftedAgents.value.length > 0);

// draft_tournament_free_agent_teams short-circuits to 0 the moment a drafted
// team exists, and the action refuses outright once the bracket is in play.
// Both cases return "Drafted 0 teams" as a success, so the button has to go
// rather than lie.
const draftLocked = computed(() =>
  [
    e_tournament_status_enum.Live,
    e_tournament_status_enum.Paused,
    e_tournament_status_enum.Finished,
    e_tournament_status_enum.Cancelled,
    e_tournament_status_enum.CancelledMinTeams,
  ].includes(props.tournament?.status),
);

const canDraft = computed(() => !hasDrafted.value && !draftLocked.value);

// First fit, in priority order, into `teams` bins of `teamSize`. A unit that
// fits nowhere is SKIPPED and the walk continues — without that departure from
// strict priority a five-stack arriving early strands four slots forever.
//
// Exactness is then checked by packing, never by summing: {4,4,2} into two
// teams of five sums to the capacity and packs into neither.
function packsExactly(sizes: number[], teams: number, size: number) {
  const bins = new Array(teams).fill(size);
  for (const unitSize of sizes) {
    const bin = bins.findIndex((free) => free >= unitSize);
    if (bin === -1) {
      continue;
    }
    bins[bin] -= unitSize;
  }
  return bins.every((free) => free === 0);
}

// Mirrors stage 1 of draft_tournament_free_agent_teams, because the organizer
// line is a promise about what the button will do. Parties break the old
// floor(pool / size) arithmetic outright — enough players is no longer the same
// question as enough teams.
const draftPlan = computed(() => {
  const total = pool.value.length;
  if (teamSize.value < 1) {
    return { teams: 0, waitlisted: total, capacity: 0 };
  }

  const room =
    stageMaxTeams.value === null
      ? Number.POSITIVE_INFINITY
      : Math.max(stageMaxTeams.value - existingTeams.value, 0);
  const capacity = Math.min(Math.floor(total / teamSize.value), room);
  const sizes = poolUnits.value.map((unit) => unit.members.length);

  // The decrement-and-retry loop is the only second chance first fit gets;
  // reordering the walk would break priority, which outranks packing quality.
  for (let teams = capacity; teams >= 1; teams--) {
    if (packsExactly(sizes, teams, teamSize.value)) {
      return { teams, waitlisted: total - teams * teamSize.value, capacity };
    }
  }

  return { teams: 0, waitlisted: total, capacity };
});

// Enough players and enough room, but no exact packing: {4,4,4} into teams of
// five is the canonical case. Naming it matters — "0 teams" under a full pool
// reads as a broken draft rather than as arithmetic.
const partyDeadlock = computed(
  () =>
    !hasDrafted.value &&
    draftPlan.value.capacity >= 1 &&
    draftPlan.value.teams === 0,
);

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
  return {
    teams: draftPlan.value.teams,
    waitlisted: draftPlan.value.waitlisted,
  };
});

const draftedTeams = computed(() => {
  const groups = new Map<
    string,
    { id: string; name: string; members: Agent[] }
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
      const byElo = group.members
        .slice()
        .sort(
          (a, b) => Number(b.player?.elo ?? 0) - Number(a.player?.elo ?? 0),
        );
      return {
        ...group,
        // Grouped off an ELO-sorted list, so each unit keeps its members in
        // rating order and the units themselves stay in rating order — the
        // team owner (highest rated) still leads the card, and a party is not
        // scattered down it.
        units: groupUnits(byElo).map((unit) => ({
          key: unit.key,
          members: unit.members,
          isParty: !!unit.partyId && unit.members.length > 1,
        })),
        averageElo: elos.length
          ? Math.round(elos.reduce((sum, elo) => sum + elo, 0) / elos.length)
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
});

// A party is drafted whole or waitlisted whole, so one that missed the cut is
// visibly behind people who signed up after it. That inversion is the rule
// working, and it only needs explaining while such a party is on screen.
const hasWaitlistedParty = computed(() =>
  poolUnits.value.some(
    (unit) =>
      !!unit.partyId &&
      unit.members.length > 1 &&
      unit.members.every((member) => member.status === "waitlisted"),
  ),
);

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

// joinTournamentAsFreeAgent requires exactly RegistrationOpen, while the leave
// rule also allows Setup. Offering Sign up during Setup produces a button that
// can only ever fail, so the two windows are kept apart.
const canSignUp = computed(
  () =>
    !!me.value &&
    props.tournament?.status === e_tournament_status_enum.RegistrationOpen &&
    !myEntry.value,
);

// Leaving after the draft would tear a hole in a seeded team, and the API's
// delete rule stops at RegistrationOpen anyway.
const canLeave = computed(
  () =>
    !!myEntry.value &&
    [
      e_tournament_status_enum.Setup,
      e_tournament_status_enum.RegistrationOpen,
    ].includes(props.tournament?.status) &&
    myEntry.value.status !== "drafted",
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
    pool.value.map((row) => String(row.player?.steam_id)),
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

// Only worth saying once the draft has ruled on the party: before that every
// unit is "registered" and the block header already says it is a party.
function partyStatusLabel(status: string) {
  if (status === "drafted") {
    return t("tournament.free_agents.party_status_drafted");
  }
  if (status === "waitlisted") {
    return t("tournament.free_agents.party_status_waitlisted");
  }
  return "";
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

async function joinPool(withParty = false) {
  await runAction(
    {
      joinTournamentAsFreeAgent: [
        {
          tournament_id: props.tournament.id,
          // PRE-CODEGEN ESCAPE HATCH — `with_party` is a new action argument
          // Zeus has not generated, so it rides the `as any` in runAction.
          // Omitted entirely when false: that is byte-for-byte the old solo
          // signup, which every unmigrated API still accepts.
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

async function draftTeams() {
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

  const created = Number(data.draftTournamentTeams?.teams_created ?? 0);
  if (created < 1) {
    toast({
      title: t("tournament.free_agents.nothing_drafted"),
      description: partyDeadlock.value
        ? t("tournament.free_agents.nothing_drafted_parties", {
            size: teamSize.value,
          })
        : t("tournament.free_agents.nothing_drafted_hint", {
            size: teamSize.value,
          }),
      variant: "destructive",
    });
    return;
  }

  toast({
    title: t("tournament.free_agents.regenerated", { count: created }),
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
          v-if="canSignUp && !showLobbySignUp"
          size="sm"
          class="h-8"
          @click="joinPool()"
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
          size="sm"
          class="h-8"
          @click="joinPool()"
        >
          <UserPlus class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.free_agents.sign_up_alone") }}
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
        <!-- Iterated by unit, not by row: a party is one thing the draft moves
             and it has to look like one thing. Ordering is by unit priority, so
             a party is always a contiguous block. -->
        <div
          v-for="unit in visibleUnits"
          :key="unit.key"
          :class="
            unit.isParty
              ? 'rounded-md border border-l-2 border-[hsl(var(--tac-amber)_/_0.3)] border-l-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.04)] p-1.5'
              : ''
          "
        >
          <div
            v-if="unit.isParty"
            class="mb-1.5 flex flex-wrap items-center gap-2 px-1.5 pt-0.5"
          >
            <Users class="h-3 w-3 text-[hsl(var(--tac-amber))]" />
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              {{
                $t("tournament.free_agents.party_of", {
                  count: unit.rows.length,
                })
              }}
            </span>
            <TournamentChip
              v-if="partyStatusLabel(unit.status)"
              :tone="statusTone(unit.status)"
            >
              {{ partyStatusLabel(unit.status) }}
            </TournamentChip>
          </div>

          <div class="flex flex-col gap-1.5">
            <div
              v-for="row in unit.rows"
              :key="row.agent.id"
              class="flex flex-wrap items-center gap-3 rounded-md border bg-card/45 px-3 py-2 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.35)]"
              :class="[
                unit.isParty
                  ? 'border-[hsl(var(--tac-amber)_/_0.18)]'
                  : 'border-border',
                { 'opacity-60': row.agent.status === 'waitlisted' },
              ]"
            >
              <span
                class="w-7 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-muted-foreground"
              >
                {{ String(row.position).padStart(2, "0") }}
              </span>
              <div class="min-w-0 flex-1">
                <PlayerDisplay
                  :player="row.agent.player"
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
                  row.position === 1 && filter === 'all'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-foreground'
                "
              >
                {{ row.agent.player?.elo ?? "—" }}
              </span>
              <span
                class="w-14 shrink-0 text-right font-mono text-[0.72rem] tabular-nums text-muted-foreground"
              >
                {{ signUpTime(row.agent.created_at) }}
              </span>
              <TournamentChip :tone="statusTone(row.agent.status)">
                {{ statusLabel(row.agent.status) }}
              </TournamentChip>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div
        v-if="partyDeadlock"
        class="flex items-start gap-2.5 rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-[0.78rem] leading-relaxed text-muted-foreground"
      >
        <Info class="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
        <span>
          {{
            $t("tournament.free_agents.party_deadlock", {
              count: pool.length,
              size: teamSize,
            })
          }}
        </span>
      </div>

      <div
        v-if="hasWaitlistedParty"
        class="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 px-4 py-3 text-[0.78rem] leading-relaxed text-muted-foreground"
      >
        <Info class="mt-px h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span>{{ $t("tournament.free_agents.party_waitlist_explainer") }}</span>
      </div>

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
          v-if="canDraft"
          variant="outline"
          size="sm"
          class="h-8 shrink-0"
          @click="draftTeams"
        >
          <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.free_agents.regenerate") }}
        </Button>
        <span
          v-else
          class="max-w-[34ch] shrink-0 text-[0.78rem] leading-snug text-muted-foreground"
        >
          {{
            hasDrafted
              ? $t("tournament.free_agents.already_drafted")
              : $t("tournament.free_agents.draft_locked")
          }}
        </span>
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
            <!-- `party_id` outlives the draft as the record of who signed up
                 with whom, so the organizer can see what the draft kept
                 together rather than inferring it from the roster. -->
            <div
              v-for="unit in team.units"
              :key="unit.key"
              :class="
                unit.isParty
                  ? 'rounded border border-l-2 border-[hsl(var(--tac-amber)_/_0.3)] border-l-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.04)] p-1'
                  : ''
              "
            >
              <div
                v-if="unit.isParty"
                class="mb-1 flex items-center gap-1.5 px-1 pt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
              >
                <Users class="h-2.5 w-2.5" />
                {{
                  $t("tournament.free_agents.party_kept_together", {
                    count: unit.members.length,
                  })
                }}
              </div>
              <div class="flex flex-col gap-1">
                <div
                  v-for="member in unit.members"
                  :key="member.id"
                  class="flex items-center justify-between gap-2 rounded border bg-card/40 px-2 py-1"
                  :class="
                    unit.isParty
                      ? 'border-[hsl(var(--tac-amber)_/_0.18)]'
                      : 'border-border/60'
                  "
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
        </div>
      </div>
    </template>
  </div>
</template>
