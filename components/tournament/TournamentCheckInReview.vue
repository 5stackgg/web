<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Clock, Info, UserPlus } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import TimeAgo from "~/components/TimeAgo.vue";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { toast } from "~/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { dateLocale } from "~/utilities/dateLocale";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  tournament: Record<string, any>;
  registration?: Record<string, any> | null;
  teams?: Array<Record<string, any>> | null;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

// The organizer picks how much slack to give; the API only takes a minute
// count, so the choice lives entirely in the menu.
const EXTEND_OPTIONS = [5, 10, 15, 30];

const checkInSetting = computed<string>(
  () => props.registration?.check_in_setting ?? "Captains",
);

const minPlayers = computed(
  () => Number(props.tournament?.min_players_per_lineup) || 0,
);

function teamName(team: Record<string, any>) {
  return team?.name || team?.team?.name || t("common.untitled");
}

function teamInitials(team: Record<string, any>) {
  const source =
    team?.short_name || team?.team?.short_name || teamName(team) || "?";
  return String(source).slice(0, 2).toUpperCase();
}

const missedTeams = computed(() =>
  (props.teams ?? [])
    .filter((team) => !team.checked_in_at)
    .map((team) => {
      const roster = (team.roster as any[]) ?? [];
      const rosterSize =
        team.roster_aggregate?.aggregate?.count ?? roster.length;
      const confirmed = roster.filter((member) => !!member.checked_in_at).length;
      // In Players mode a team can be one confirmation short of the line
      // rather than absent entirely — worth distinguishing, because that
      // organizer decides very differently.
      const partial =
        checkInSetting.value === "Players" &&
        confirmed > 0 &&
        confirmed < minPlayers.value;
      return {
        id: team.id,
        name: teamName(team),
        initials: teamInitials(team),
        createdAt: team.created_at,
        rosterSize,
        confirmed,
        shortBy: Math.max(0, minPlayers.value - confirmed),
        partial,
      };
    }),
);

const autoContinueLabel = computed(() => {
  const start = props.tournament?.start;
  if (!start) {
    return null;
  }
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
});

async function runAction(
  mutation: Record<string, any>,
  failureTitle: string,
): Promise<void> {
  try {
    await client.mutate({
      // Actions land with the tournament check-in migration; their zeus types
      // only exist once `yarn codegen` has run against that schema.
      mutation: generateMutation(mutation as any),
    });
  } catch (error: unknown) {
    toast({
      title: failureTitle,
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  }
}

async function readmit(tournamentTeamId: string) {
  await runAction(
    {
      readmitTournamentTeam: [
        {
          tournament_id: props.tournament.id,
          tournament_team_id: tournamentTeamId,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.check_in_review.readmit_failed"),
  );
}

async function continueWithout() {
  await runAction(
    {
      continueTournamentCheckIn: [
        {
          tournament_id: props.tournament.id,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.check_in_review.continue_failed"),
  );
}

async function extend(minutes: number) {
  await runAction(
    {
      extendTournamentCheckIn: [
        {
          tournament_id: props.tournament.id,
          minutes,
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.check_in_review.extend_failed"),
  );
}
</script>

<template>
  <section
    class="relative mt-4 rounded-lg border border-warning/50 px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.7)_0%,hsl(var(--card)_/_0.4)_100%)] [backdrop-filter:blur(6px)]"
  >
    <div class="flex flex-wrap items-start justify-between gap-5">
      <div class="min-w-0">
        <h3
          class="m-0 font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
        >
          {{
            $t("tournament.check_in_review.heading", {
              count: missedTeams.length,
            })
          }}
        </h3>
        <p class="mt-1 max-w-[70ch] text-[0.8rem] leading-relaxed text-muted-foreground">
          {{ $t("tournament.check_in_review.subheading") }}
        </p>
      </div>
      <TournamentChip tone="warn">
        <Clock class="h-3 w-3" />
        {{
          autoContinueLabel
            ? $t("tournament.check_in_review.chip_held_at", {
                time: autoContinueLabel,
              })
            : $t("tournament.check_in_review.chip_held")
        }}
      </TournamentChip>
    </div>

    <TransitionGroup
      tag="div"
      class="mt-4 flex flex-col gap-1.5"
      enter-active-class="transition-[opacity,transform] [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
      enter-from-class="opacity-0 translate-y-2 motion-reduce:translate-y-0"
      leave-active-class="absolute w-full transition-[opacity,transform] duration-200 ease-in motion-reduce:![transition-duration:1ms]"
      leave-to-class="opacity-0 -translate-y-1 motion-reduce:translate-y-0"
      move-class="transition-transform duration-300 ease-out motion-reduce:!transition-none"
    >
      <div
        v-for="team in missedTeams"
        :key="team.id"
        class="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/45 px-3 py-2.5"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[hsl(var(--tac-amber)_/_0.35)] bg-[hsl(var(--tac-amber)_/_0.08)] font-mono text-[0.55rem] font-bold uppercase tracking-[0.08em] text-[hsl(var(--tac-amber))]"
        >
          {{ team.initials }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-foreground">
            {{ team.name }}
          </div>
          <div
            class="flex flex-wrap items-center gap-1.5 text-[0.72rem] text-muted-foreground"
          >
            <template v-if="team.partial">
              {{
                $t("tournament.check_in_review.partial_roster", {
                  checked: team.confirmed,
                  required: minPlayers,
                  short: team.shortBy,
                })
              }}
            </template>
            <template v-else>
              {{
                $t("tournament.check_in_review.roster_size", {
                  count: team.rosterSize,
                })
              }}
            </template>
            <span class="opacity-40">·</span>
            <span class="inline-flex items-center gap-1">
              {{ $t("tournament.check_in_review.registered") }}
              <TimeAgo :date="team.createdAt" hide-icon />
            </span>
          </div>
        </div>
        <TournamentChip :tone="team.partial ? 'warn' : 'bad'">
          {{
            team.partial
              ? $t("tournament.check_in_review.chip_incomplete")
              : $t("tournament.check_in_review.chip_no_check_in")
          }}
        </TournamentChip>
        <Button
          variant="outline"
          size="sm"
          class="h-8 shrink-0"
          @click="readmit(team.id)"
        >
          <UserPlus class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("tournament.check_in_review.readmit") }}
        </Button>
      </div>
    </TransitionGroup>

    <div class="my-4 h-px bg-border"></div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        :class="[tacticalCtaButtonClasses, 'h-9 px-4 py-2 text-[0.68rem]']"
        @click="continueWithout"
      >
        {{ $t("tournament.check_in_review.continue") }}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="h-9">
            <Clock class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("tournament.check_in_review.extend") }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            v-for="minutes in EXTEND_OPTIONS"
            :key="minutes"
            @click="extend(minutes)"
          >
            {{ $t("tournament.check_in_review.extend_by", { minutes }) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span class="text-[0.75rem] text-muted-foreground">
        {{
          $t("tournament.check_in_review.extend_hint", {
            count: missedTeams.length,
          })
        }}
      </span>
    </div>

    <div
      class="mt-4 flex flex-col gap-2 rounded-md border border-border bg-muted/20 px-4 py-3 text-[0.78rem] leading-relaxed text-muted-foreground"
    >
      <div class="flex items-start gap-2.5">
        <Info class="mt-px h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span>
          {{
            autoContinueLabel
              ? $t("tournament.check_in_review.auto_continue", {
                  time: autoContinueLabel,
                })
              : $t("tournament.check_in_review.auto_continue_no_time")
          }}
        </span>
      </div>
      <div class="flex items-start gap-2.5">
        <Info class="mt-px h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span>{{ $t("tournament.check_in_review.reseed_warning") }}</span>
      </div>
    </div>
  </section>
</template>
