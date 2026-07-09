<script setup lang="ts">
import { computed } from "vue";
import { Lock } from "lucide-vue-next";

// A tactical campaign timeline: Registration → Regular Season → Playoffs →
// Complete, with the live phase lit in amber and each phase's date beneath it.
// Replaces the scattered status badges + date grid with one orienting strip.
const props = defineProps<{
  season: any;
}>();

const { t } = useI18n();

function fmt(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Which phase is "live" for each season status. RegistrationClosed sits between
// registration and kickoff, so registration reads done and the season is next.
const STATUS_INDEX: Record<string, number> = {
  Setup: 0,
  RegistrationOpen: 0,
  RegistrationClosed: 1,
  Live: 1,
  Playoffs: 2,
  Finished: 3,
  Canceled: -1,
};

const currentIndex = computed(() => STATUS_INDEX[props.season?.status] ?? 0);
const isCanceled = computed(() => props.season?.status === "Canceled");
const preOpen = computed(() => props.season?.status === "Setup");

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Playoffs begin when the regular season ends: the last match week's close, or
// (before weeks are generated) starts_at + match_weeks_count weeks.
const regularSeasonEnd = computed<string | null>(() => {
  const closes = (props.season?.match_weeks ?? [])
    .map((w: any) => w.closes_at)
    .filter(Boolean);
  if (closes.length) {
    return closes.reduce((a: string, b: string) =>
      new Date(b) > new Date(a) ? b : a,
    );
  }
  if (props.season?.starts_at && props.season?.match_weeks_count) {
    return addDays(props.season.starts_at, props.season.match_weeks_count * 7);
  }
  return null;
});

// Playoffs run a round a week; a rough completion estimate for the timeline.
const playoffRounds = computed(() => {
  const seats = props.season?.playoff_seats ?? 0;
  if (seats < 2) {
    return 1;
  }
  const wb = Math.ceil(Math.log2(seats));
  return props.season?.playoff_stage_type === "DoubleElimination" ? wb + 1 : wb;
});
const completeAt = computed<string | null>(() =>
  regularSeasonEnd.value
    ? addDays(regularSeasonEnd.value, playoffRounds.value * 7)
    : null,
);

const teamsCount = computed(
  () =>
    (props.season?.team_seasons ?? []).filter(
      (ts: any) => ts.status !== "Withdrawn" && ts.status !== "Declined",
    ).length,
);

const phases = computed(() => [
  {
    key: "registration",
    label: t("league.phases.registration"),
    date: props.season?.signup_closes_at
      ? fmt(props.season.signup_closes_at)
      : fmt(props.season?.signup_opens_at),
    stat: t("league.phases.teams_stat", { count: teamsCount.value }),
    approx: false,
  },
  {
    key: "regular_season",
    label: t("league.phases.regular_season"),
    date: fmt(props.season?.starts_at),
    stat: t("league.overview.weeks_count", {
      count: props.season?.match_weeks_count ?? 0,
    }),
    approx: false,
  },
  {
    key: "playoffs",
    label: t("league.phases.playoffs"),
    date: fmt(regularSeasonEnd.value),
    stat: t("league.phases.advance_stat", {
      count: props.season?.playoff_seats ?? 0,
    }),
    approx: true,
  },
  {
    key: "complete",
    label: t("league.phases.complete"),
    date: fmt(completeAt.value),
    stat: "",
    approx: true,
  },
]);

function nodeState(i: number): "done" | "current" | "upcoming" {
  if (i < currentIndex.value) {
    return "done";
  }
  if (i === currentIndex.value) {
    return "current";
  }
  return "upcoming";
}
</script>

<template>
  <div
    class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] px-4 py-4 sm:px-6"
  >
    <div
      v-if="isCanceled"
      class="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-destructive"
    >
      <span class="inline-block h-3 w-3 rotate-45 border border-destructive bg-destructive/40" />
      {{ $t("league.season_status.Canceled") }}
    </div>

    <ol v-else class="flex items-stretch overflow-x-auto">
      <li
        v-for="(phase, i) in phases"
        :key="phase.key"
        class="flex min-w-[6rem] flex-1 flex-col items-center px-1"
      >
        <div
          class="mb-2.5 whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
          :class="
            nodeState(i) === 'upcoming'
              ? 'text-muted-foreground/70'
              : 'text-[hsl(var(--tac-amber))]'
          "
        >
          {{ phase.label }}
        </div>

        <div class="relative flex w-full items-center justify-center">
          <span
            v-if="i > 0"
            class="absolute left-0 top-1/2 h-px w-1/2 -translate-y-1/2"
            :class="
              i <= currentIndex
                ? 'bg-[hsl(var(--tac-amber)/0.6)]'
                : 'bg-border'
            "
          />
          <span
            v-if="i < phases.length - 1"
            class="absolute right-0 top-1/2 h-px w-1/2 -translate-y-1/2"
            :class="
              i < currentIndex ? 'bg-[hsl(var(--tac-amber)/0.6)]' : 'bg-border'
            "
          />
          <span
            class="relative z-10 h-3 w-3 rotate-45 border transition-colors duration-200"
            :class="{
              'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))]':
                nodeState(i) === 'done',
              'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] [box-shadow:0_0_0_3px_hsl(var(--tac-amber)/0.15),0_0_14px_hsl(var(--tac-amber)/0.5)]':
                nodeState(i) === 'current',
              'border-border bg-background': nodeState(i) === 'upcoming',
            }"
          />
        </div>

        <div
          class="mt-2.5 h-4 whitespace-nowrap font-mono text-[0.6rem] text-muted-foreground"
        >
          <template v-if="i === 0 && preOpen">{{
            $t("league.phases.opens_soon")
          }}</template>
          <template v-else-if="phase.date"
            ><span v-if="phase.approx" class="opacity-60">~</span
            >{{ phase.date }}</template
          >
        </div>
        <div
          v-if="phase.stat"
          class="mt-1 h-4 whitespace-nowrap font-mono text-[0.6rem] font-semibold uppercase tracking-wider text-[hsl(var(--tac-amber))]"
        >
          {{ phase.stat }}
        </div>
      </li>
    </ol>

    <div
      v-if="!isCanceled && season?.roster_lock_at"
      class="mt-3 flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em]"
      :class="
        season.is_roster_locked
          ? 'text-destructive'
          : 'text-muted-foreground'
      "
    >
      <Lock class="h-3 w-3" />
      {{
        season.is_roster_locked
          ? $t("league.overview.roster_locked")
          : $t("league.overview.roster_locks", {
              date: new Date(season.roster_lock_at).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" },
              ),
            })
      }}
    </div>
  </div>
</template>
