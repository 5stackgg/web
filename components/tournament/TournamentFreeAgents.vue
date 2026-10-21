<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient, useSubscription } from "@vue/apollo-composable";
import { CaretSortIcon } from "@radix-icons/vue";
import {
  Info,
  RefreshCw,
  TriangleAlert,
  UserMinus,
  UserPlus,
} from "lucide-vue-next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "~/components/ui/empty";
import { FadeSwap, HeightSwap } from "~/components/ui/transitions";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import TournamentFreeAgentSignUp from "~/components/tournament/TournamentFreeAgentSignUp.vue";
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
import { runTournamentAction } from "~/utilities/tournamentActions";
import {
  tournamentEloLadder,
  tournamentPlayerElo,
} from "~/utilities/tournamentElo";

const props = defineProps<{
  tournament: Record<string, any>;
  // The viewer's own team in this tournament, invites included.
  myTeam?: Record<string, any> | null;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

type Agent = Record<string, any>;

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

// Sign-up order is the whole rule, so it is the list's only ordering.
function compareSignup(a: Agent, b: Agent) {
  const left = new Date(a.created_at).getTime();
  const right = new Date(b.created_at).getTime();
  if (left !== right) {
    return left - right;
  }
  return String(a.id).localeCompare(String(b.id));
}

const pool = computed<Agent[]>(() => {
  const rows = ((result.value as any)?.tournament_free_agents ?? []) as Agent[];
  return rows.filter((row) => row.status !== "withdrawn").sort(compareSignup);
});

const draftedAgents = computed(() =>
  pool.value.filter((row) => row.status === "drafted"),
);
const waitlistedAgents = computed(() =>
  pool.value.filter((row) => row.status === "waitlisted"),
);

// A drafted player is on a pickup team and listed under it, so the pool shows
// only the players still waiting for a seat.
const waitingRows = computed(() =>
  pool.value
    .filter((row) => row.status !== "drafted")
    .map((agent, index) => ({ position: index + 1, agent })),
);

const teamSize = computed(
  () =>
    Number(props.tournament?.min_players_per_lineup) ||
    Number(props.tournament?.max_players_per_lineup) ||
    0,
);

// The ladder the DRAFT rates on, not the one the player looks best on:
// draft_tournament_free_agent_teams orders the pool by get_tournament_player_elo.
const eloLadder = computed(() => tournamentEloLadder(props.tournament));

function playerElo(agent: Agent) {
  return tournamentPlayerElo(props.tournament, agent?.player);
}

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

// Mirrors stage 1 of draft_tournament_free_agent_teams, because the organizer
// line is a promise about what the button will do.
const draftPlan = computed(() => {
  const total = pool.value.length;
  if (teamSize.value < 1) {
    return { teams: 0, waitlisted: total };
  }

  const room =
    stageMaxTeams.value === null
      ? Number.POSITIVE_INFINITY
      : Math.max(stageMaxTeams.value - existingTeams.value, 0);
  const teams = Math.min(Math.floor(total / teamSize.value), room);

  return { teams, waitlisted: total - teams * teamSize.value };
});

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
        .map((member) => playerElo(member))
        .filter((elo): elo is number => elo !== null);
      const byElo = group.members
        .slice()
        .sort((a, b) => (playerElo(b) ?? 0) - (playerElo(a) ?? 0));
      return {
        ...group,
        // Rating order, so the team owner (highest rated) leads the card.
        members: byElo,
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
    (playerElo(row) ?? 0) > (playerElo(top) ?? 0) ? row : top,
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

// The same rule leaveTournamentAsFreeAgent enforces. A drafted player holds a
// slot, and can give it up until registration closes: an organizer can draft
// while registration is still open, and gating on that would strand everyone
// the draft touched. The action drops the roster row, promotes the first
// waitlisted agent into it and reseeds. Anyone still waiting holds nothing and
// can step out until the bracket is in play -- kept on the waitlist, they would
// be promoted into a team they will not show up for.
const canLeave = computed(() => {
  if (!myEntry.value) {
    return false;
  }

  if (myEntry.value.status !== "drafted") {
    return !draftLocked.value;
  }

  return [
    e_tournament_status_enum.Setup,
    e_tournament_status_enum.RegistrationOpen,
  ].includes(props.tournament?.status);
});

const recruitingTeam = computed(() => {
  const team = props.myTeam;
  if (!team?.can_manage) {
    return null;
  }

  // Recruiting onto a team-backed entry invites the player to the team too,
  // which takes the right to invite to it (can_recruit). Organizers place
  // free agents outright instead.
  if (team.team_id && !team.can_recruit && !props.tournament?.is_organizer) {
    return null;
  }

  if (props.tournament?.status !== e_tournament_status_enum.RegistrationOpen) {
    return null;
  }

  const seats = Number(props.tournament?.max_players_per_lineup) || 0;
  if (seats > 0 && (team.roster?.length ?? 0) >= seats) {
    return null;
  }

  return team;
});

const invitedSteamIds = computed(
  () =>
    new Set(
      (props.myTeam?.invites ?? []).map((invite: Agent) =>
        String(invite.player?.steam_id),
      ),
    ),
);

function canInvite(agent: Agent) {
  return (
    !!recruitingTeam.value &&
    ["registered", "waitlisted"].includes(agent.status) &&
    String(agent.player?.steam_id) !== String(me.value?.steam_id)
  );
}

async function invite(agent: Agent) {
  try {
    const result = await client.mutate({
      mutation: generateMutation({
        insert_tournament_team_roster_one: [
          {
            object: {
              player_steam_id: agent.player.steam_id,
              tournament_team_id: recruitingTeam.value?.id,
              tournament_id: props.tournament.id,
            },
          },
          {
            player_steam_id: true,
          },
        ],
      }),
    });

    // An organizer's session places the player outright; anyone else's
    // becomes an invite the free agent answers.
    const added = Boolean(
      result.data?.insert_tournament_team_roster_one?.player_steam_id,
    );

    toast({
      title: added
        ? t("tournament.team.member_added")
        : t("tournament.team.invite_sent"),
      description: added
        ? t("tournament.team.member_added_description", {
            name: agent.player?.name,
          })
        : t(
            recruitingTeam.value?.team_id
              ? "tournament.team.invite_sent_team_description"
              : "tournament.team.invite_sent_tournament_description",
            {
              name: agent.player?.name,
              team:
                recruitingTeam.value?.team?.name || recruitingTeam.value?.name,
            },
          ),
    });
  } catch {
    // The refusal is already toasted by the global Apollo error handler.
  }
}

// The api's window for organizer edits, wider than a player's own sign-up:
// closing registration is what drafts the pool.
const POOL_EDITABLE = [
  e_tournament_status_enum.Setup,
  e_tournament_status_enum.RegistrationOpen,
  e_tournament_status_enum.CheckInReview,
] as string[];

const poolEditable = computed(
  () =>
    !!props.tournament?.is_organizer &&
    POOL_EDITABLE.includes(props.tournament?.status),
);

const poolLocked = computed(
  () =>
    !!props.tournament?.is_organizer &&
    props.tournament?.status === e_tournament_status_enum.RegistrationClosed,
);

// Layered so the most specific fact wins: a drafted player is in the pool and
// also on their pickup team.
const ineligibleAgents = computed(() => {
  const reasons: Record<string, string> = {};

  for (const row of pool.value) {
    if (row.player?.steam_id) {
      reasons[String(row.player.steam_id)] = t(
        "tournament.free_agents.ineligible_in_pool",
      );
    }
  }

  for (const team of props.tournament?.teams ?? []) {
    for (const member of team.roster ?? []) {
      if (member.player?.steam_id) {
        reasons[String(member.player.steam_id)] = t(
          "tournament.team.ineligible.on_other_team",
          { team: team.name },
        );
      }
    }
  }

  return reasons;
});

async function addAgent(player: Agent) {
  const data = await runTournamentAction(
    client,
    {
      addTournamentFreeAgent: [
        {
          tournament_id: props.tournament.id,
          steam_id: player.steam_id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.free_agents.add_failed"),
  );

  if (!data) {
    return;
  }

  toast({
    title: t("tournament.free_agents.added", { name: player.name }),
  });
}

const removeDialogOpen = ref(false);
const removing = ref<Agent | null>(null);

function confirmRemove(agent: Agent) {
  removing.value = agent;
  removeDialogOpen.value = true;
}

async function removeAgent() {
  const agent = removing.value;
  if (!agent) {
    return;
  }

  const data = await runTournamentAction(
    client,
    {
      removeTournamentFreeAgent: [
        {
          tournament_id: props.tournament.id,
          steam_id: agent.player?.steam_id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.free_agents.remove_failed"),
  );

  if (!data) {
    return;
  }

  removeDialogOpen.value = false;
  toast({
    title: t("tournament.free_agents.removed", { name: agent.player?.name }),
  });
}

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

async function leavePool() {
  await runTournamentAction(
    client,
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
  const data = await runTournamentAction(
    client,
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
      description: t("tournament.free_agents.nothing_drafted_hint", {
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
            hasDrafted
              ? $t("tournament.free_agents.waitlisted_count", {
                  count: waitingRows.length,
                })
              : $t("tournament.free_agents.signed_up", { count: pool.length })
          }}
        </TournamentChip>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="canLeave"
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

    <TournamentFreeAgentSignUp :tournament="tournament" :my-entry="myEntry" />

    <div v-if="poolEditable || poolLocked" class="flex items-center gap-2">
      <FadeSwap class="min-w-0 flex-1">
        <div v-if="poolEditable" key="add">
          <PlayerSearch
            :label="$t('tournament.free_agents.add')"
            :ineligible="ineligibleAgents"
            @selected="addAgent"
          />
        </div>
        <Button
          v-else
          key="locked"
          variant="outline"
          disabled
          class="w-full justify-between [&>span:last-child]:w-full [&>span:last-child]:justify-between"
        >
          {{ $t("tournament.free_agents.add") }}
          <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </FadeSwap>
      <FadeSwap>
        <span v-if="poolLocked" key="locked" class="inline-flex">
          <FiveStackToolTip as-child :delay-duration="120">
            <template #trigger>
              <span
                class="inline-flex cursor-help text-[hsl(var(--tac-amber))]"
                tabindex="0"
                role="img"
                :aria-label="$t('tournament.free_agents.pool_locked')"
                @click.prevent
              >
                <TriangleAlert class="h-4 w-4" />
              </span>
            </template>
            <p class="max-w-[16rem]">
              {{ $t("tournament.free_agents.pool_locked") }}
            </p>
          </FiveStackToolTip>
        </span>
      </FadeSwap>
    </div>

    <HeightSwap>
      <Empty v-if="waitingRows.length === 0" key="empty" class="min-h-[180px]">
        <EmptyTitle>
          {{
            hasDrafted
              ? $t("tournament.free_agents.nobody_waiting_title")
              : $t("tournament.free_agents.empty_title")
          }}
        </EmptyTitle>
        <EmptyDescription>
          {{
            hasDrafted
              ? $t("tournament.free_agents.nobody_waiting_description")
              : $t("tournament.free_agents.empty_description")
          }}
        </EmptyDescription>
      </Empty>

      <div v-else key="list" class="flex flex-col gap-5">
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
            v-for="row in waitingRows"
            :key="row.agent.id"
            class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/45 px-3 py-2 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.35)]"
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
            <span class="flex shrink-0 items-center justify-end gap-1.5">
              <PlayerPremierRank
                :premier-rank="row.agent.player?.premier_rank"
                :premier-rank-updated-at="
                  row.agent.player?.premier_rank_updated_at
                "
              />
              <PlayerFaceitRank
                :faceit-skill-level="row.agent.player?.faceit_skill_level"
                :faceit-elo="row.agent.player?.faceit_elo"
                :faceit-url="row.agent.player?.faceit_url"
                :faceit-nickname="row.agent.player?.faceit_nickname"
              />
            </span>
            <span class="flex w-14 shrink-0 justify-end">
              <PlayerElo
                v-if="playerElo(row.agent) !== null"
                :elo="row.agent.player?.elo"
                :type="eloLadder"
              />
              <span
                v-else
                class="font-mono text-[0.78rem] text-muted-foreground"
              >
                &mdash;
              </span>
            </span>
            <span
              class="w-14 shrink-0 text-right font-mono text-[0.72rem] tabular-nums text-muted-foreground"
            >
              {{ signUpTime(row.agent.created_at) }}
            </span>
            <TournamentChip :tone="statusTone(row.agent.status)">
              {{ statusLabel(row.agent.status) }}
            </TournamentChip>
            <template v-if="canInvite(row.agent)">
              <TournamentChip
                v-if="invitedSteamIds.has(String(row.agent.player?.steam_id))"
                tone="amber"
              >
                {{ $t("tournament.free_agents.invited") }}
              </TournamentChip>
              <Button
                v-else
                variant="outline"
                size="sm"
                class="h-7 px-2.5"
                @click="invite(row.agent)"
              >
                <UserPlus class="mr-1.5 h-3.5 w-3.5" />
                {{ $t("tournament.free_agents.invite") }}
              </Button>
            </template>
            <Button
              v-if="poolEditable"
              variant="ghost"
              size="icon"
              class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive [&_svg]:size-3.5"
              :aria-label="
                $t('tournament.free_agents.remove_agent', {
                  name: row.agent.player?.name,
                })
              "
              @click="confirmRemove(row.agent)"
            >
              <UserMinus />
            </Button>
          </div>
        </TransitionGroup>

        <div
          v-if="topRatedWaitlisted"
          class="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 px-4 py-3 text-[0.78rem] leading-relaxed text-muted-foreground"
        >
          <Info
            class="mt-px h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <span>
            {{
              $t("tournament.free_agents.waitlist_explainer", {
                name: topRatedWaitlisted.player?.name,
              })
            }}
          </span>
        </div>
      </div>
    </HeightSwap>

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
              <span class="flex shrink-0 justify-end">
                <PlayerElo
                  v-if="playerElo(member) !== null"
                  :elo="member.player?.elo"
                  :type="eloLadder"
                />
                <span
                  v-else
                  class="font-mono text-[0.7rem] text-muted-foreground"
                >
                  &mdash;
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <AlertDialog
      :open="removeDialogOpen"
      @update:open="(open) => (removeDialogOpen = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{
              $t("tournament.free_agents.remove_title", {
                name: removing?.player?.name,
              })
            }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("tournament.free_agents.remove_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <Button variant="destructive" @click="removeAgent">
            {{ $t("tournament.free_agents.remove") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
