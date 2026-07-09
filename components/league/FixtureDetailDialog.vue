<script setup lang="ts">
import { computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  CalendarClock,
  Check,
  ExternalLink,
  Flag,
  Globe,
  Trophy,
  X,
} from "lucide-vue-next";
import {
  canRespondTo,
  reschedulable,
  type Fixture,
  type Proposal,
} from "~/utilities/leagueFixtures";
import { tacticalSectionTickClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  open: boolean;
  fixture: Fixture | null;
  isAdmin: boolean;
  mySteamId?: string | null;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "propose", fixture: Fixture): void;
  (e: "counter", fixture: Fixture, proposalId: string): void;
  (
    e: "respond",
    proposalId: string,
    status: "Accepted" | "Declined" | "Countered",
  ): void;
  (e: "forfeit", bracketId: string, winningTeamId: string): void;
}>();

const canReschedule = computed(
  () =>
    !!props.fixture &&
    reschedulable(props.fixture) &&
    (props.fixture.mine || props.isAdmin),
);

function respondable(proposal: Proposal): boolean {
  if (!props.fixture) {
    return false;
  }
  return canRespondTo(props.fixture.bracket, proposal, {
    isAdmin: props.isAdmin,
    mySteamId: props.mySteamId,
    mine: props.fixture.mine,
  });
}

function formatLocal(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Neither team's timezone is stored, so rather than guess we anchor every
// negotiated time to UTC — the one clock both sides can agree on.
function formatUtc(value: Date | string): string {
  return `${new Date(value).toLocaleString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })} UTC`;
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent v-if="fixture" class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex flex-wrap items-center gap-2">
          <span
            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("league.schedule.week", { week: fixture.weekNumber }) }}
          </span>
          <Badge v-if="fixture.bestOf" variant="outline" size="sm" class="font-mono">
            BO{{ fixture.bestOf }}
          </Badge>
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ fixture.bracket.team_1?.name ?? "TBD" }} vs
          {{ fixture.bracket.team_2?.name ?? "TBD" }}
        </DialogDescription>
      </DialogHeader>

      <!-- Matchup -->
      <div class="flex items-center justify-between gap-3 text-base font-semibold">
        <span class="truncate">{{ fixture.bracket.team_1?.name ?? "TBD" }}</span>
        <span class="shrink-0 font-mono text-xs text-muted-foreground">vs</span>
        <span class="truncate text-right">{{
          fixture.bracket.team_2?.name ?? "TBD"
        }}</span>
      </div>

      <!-- Result -->
      <div
        v-if="fixture.status === 'finished'"
        class="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm"
      >
        <span class="text-muted-foreground">{{ $t("league.schedule.winner") }}: </span>
        <span class="font-medium">{{
          fixture.bracket.match?.winning_lineup_id ===
          fixture.bracket.match?.lineup_1_id
            ? fixture.bracket.team_1?.name
            : fixture.bracket.team_2?.name
        }}</span>
        <span v-if="fixture.score" class="ml-2 font-mono">{{ fixture.score }}</span>
      </div>

      <!-- Agreed / default time. Suppressed while a proposal is on the table:
           the proposal card below already shows that time, in context. -->
      <div
        v-else-if="!fixture.pending.length"
        class="rounded-md border px-3 py-2.5"
        :class="
          fixture.exact
            ? 'border-border bg-muted/20'
            : 'border-dashed border-border bg-transparent'
        "
      >
        <div class="flex items-center gap-1.5 text-sm font-medium">
          <CalendarClock class="h-3.5 w-3.5 text-muted-foreground" />
          {{ formatLocal(fixture.date) }}
          <span
            v-if="!fixture.exact"
            class="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
          >
            · {{ $t("league.calendar.default_night") }}
          </span>
        </div>
        <div
          class="mt-1 flex items-center gap-1.5 font-mono text-[0.62rem] text-muted-foreground"
        >
          <Globe class="h-3 w-3" />
          {{ formatUtc(fixture.date) }}
        </div>
      </div>

      <!-- Pending proposals -->
      <div
        v-for="proposal in fixture.pending"
        :key="proposal.id"
        class="rounded-md border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.05)] px-3 py-2.5"
      >
        <div class="flex items-center gap-1.5 text-sm font-medium">
          <CalendarClock class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
          {{ formatLocal(proposal.proposed_time) }}
        </div>
        <div class="mt-1 font-mono text-[0.62rem] text-muted-foreground">
          {{ formatUtc(proposal.proposed_time) }}
        </div>
        <div class="mt-1.5 text-xs text-muted-foreground">
          {{ $t("league.schedule.proposed_by") }}
          {{ proposal.proposed_by?.name ?? "?" }}
          <span v-if="proposal.message" class="italic">
            · “{{ proposal.message }}”
          </span>
        </div>

        <div v-if="respondable(proposal)" class="mt-2.5 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            class="tac-amber-cta h-7 gap-1"
            :loading="busy"
            @click="emit('respond', proposal.id, 'Accepted')"
          >
            <Check class="h-3.5 w-3.5" />
            {{ $t("league.schedule.accept") }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-7 gap-1"
            :disabled="busy"
            @click="emit('counter', fixture, proposal.id)"
          >
            <CalendarClock class="h-3.5 w-3.5" />
            {{ $t("league.schedule.counter") }}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="h-7 gap-1 text-muted-foreground"
            :loading="busy"
            @click="emit('respond', proposal.id, 'Declined')"
          >
            <X class="h-3.5 w-3.5" />
            {{ $t("league.schedule.decline") }}
          </Button>
        </div>
        <p v-else class="mt-2 text-xs text-muted-foreground">
          {{ $t("league.schedule.awaiting_opponent") }}
        </p>
      </div>

      <!-- History -->
      <div v-if="fixture.history.length" class="space-y-1">
        <div :class="tacticalSectionTickClasses" class="!mb-1"></div>
        <ul class="space-y-1">
          <li
            v-for="past in fixture.history"
            :key="past.id"
            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <span class="font-mono line-through">
              {{ formatLocal(past.proposed_time) }}
            </span>
            <span>{{ past.proposed_by?.name ?? "?" }}</span>
            <span class="font-mono uppercase tracking-[0.12em]">
              · {{ $t(`league.schedule.status.${past.status}`) }}
            </span>
          </li>
        </ul>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          v-if="canReschedule"
          size="sm"
          :variant="fixture.pending.length ? 'outline' : 'default'"
          :class="fixture.pending.length ? '' : 'tac-amber-cta'"
          class="gap-1.5"
          @click="emit('propose', fixture)"
        >
          <CalendarClock class="h-3.5 w-3.5" />
          {{
            fixture.pending.length
              ? $t("league.schedule.propose_new")
              : $t("league.schedule.propose")
          }}
        </Button>

        <NuxtLink
          v-if="fixture.bracket.match"
          :to="{ name: 'matches-id', params: { id: fixture.bracket.match.id } }"
        >
          <Button size="sm" variant="outline" class="gap-1.5">
            <ExternalLink class="h-3.5 w-3.5" />
            {{ $t("league.schedule.view_match") }}
          </Button>
        </NuxtLink>

        <DropdownMenu v-if="isAdmin && !fixture.bracket.match && !fixture.bye">
          <DropdownMenuTrigger as-child>
            <Button
              size="sm"
              variant="ghost"
              class="ml-auto gap-1 text-muted-foreground hover:text-destructive"
            >
              <Flag class="h-3.5 w-3.5" />
              {{ $t("league.schedule.forfeit") }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              v-if="fixture.bracket.tournament_team_id_1"
              :disabled="busy"
              @click="
                emit('forfeit', fixture.bracket.id, fixture.bracket.tournament_team_id_1)
              "
            >
              <Trophy />
              {{
                $t("league.schedule.forfeit_win", {
                  team: fixture.bracket.team_1?.name,
                })
              }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="fixture.bracket.tournament_team_id_2"
              :disabled="busy"
              @click="
                emit('forfeit', fixture.bracket.id, fixture.bracket.tournament_team_id_2)
              "
            >
              <Trophy />
              {{
                $t("league.schedule.forfeit_win", {
                  team: fixture.bracket.team_2?.name,
                })
              }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DialogContent>
  </Dialog>
</template>
