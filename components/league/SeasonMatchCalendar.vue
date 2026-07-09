<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { Button } from "~/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover";
import ProposeTimeDialog from "~/components/league/ProposeTimeDialog.vue";
import ProposeTimeForm from "~/components/league/ProposeTimeForm.vue";
import FixtureDetailDialog from "~/components/league/FixtureDetailDialog.vue";
import SeasonScheduleTable from "~/components/league/SeasonScheduleTable.vue";
import TeamCalendarButton from "~/components/team/TeamCalendarButton.vue";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Globe,
  Lock,
  Radio,
  User,
} from "lucide-vue-next";
import {
  buildFixtures,
  dayKey,
  endOfDay,
  localTimeInput,
  reschedulable,
  startOfDay,
  weekForDay,
  type Bracket,
  type Fixture,
  type MatchWeek,
} from "~/utilities/leagueFixtures";
import { tacticalSectionTickClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  weeks: MatchWeek[];
  brackets: Bracket[];
  managedTeamIds: string[];
  isAdmin: boolean;
  mySteamId?: string | null;
  busy?: boolean;
  weekBestOf?: Record<string, number>;
  defaultBestOf?: number;
  /** Team the viewer manages in this season — gates the calendar-feed button. */
  myTeamId?: string | null;
  /** Shown in the propose surface so a captain knows what they're scheduling. */
  seasonName?: string | null;
}>();

const emit = defineEmits<{
  (e: "propose", bracketId: string, proposedTime: string, message: string): void;
  (
    e: "respond",
    proposalId: string,
    status: "Accepted" | "Declined" | "Countered",
  ): void;
  (e: "forfeit", bracketId: string, winningTeamId: string): void;
}>();

// The page is client-fetched, so `now` never renders on the server. Ticking it
// keeps the today highlight and window shading correct across midnight.
const now = ref(new Date());
const today = computed(() => startOfDay(now.value));

let nowTicker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  nowTicker = setInterval(() => {
    now.value = new Date();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (nowTicker) {
    clearInterval(nowTicker);
    nowTicker = null;
  }
});

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeZoneAbbr =
  new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(now.value)
    .find((part) => part.type === "timeZoneName")?.value ?? "";

const allFixtures = computed(() =>
  buildFixtures(props.brackets, props.weeks, {
    managedTeamIds: props.managedTeamIds,
    isAdmin: props.isAdmin,
    mySteamId: props.mySteamId,
    weekBestOf: props.weekBestOf,
    defaultBestOf: props.defaultBestOf,
  }),
);

const hasOwnFixtures = computed(() =>
  allFixtures.value.some((fixture) => fixture.mine),
);

// Month and agenda are the captain's surfaces: they only ever show the viewer's
// own fixtures. Admins reach every fixture through the table instead — a
// division-wide calendar is unreadable at hundreds of matches.
const fixtures = computed(() =>
  allFixtures.value.filter((fixture) => fixture.mine),
);

type View = "month" | "agenda" | "table";
const views = computed<View[]>(() =>
  props.isAdmin ? ["month", "agenda", "table"] : ["month", "agenda"],
);
// An admin with no team of their own has nothing to see on a calendar.
const view = ref<View>(
  props.isAdmin && !hasOwnFixtures.value ? "table" : "month",
);

// ---- Month grid ----

const seasonStart = computed(() =>
  props.weeks.length
    ? startOfDay(
        props.weeks.reduce((min, week) =>
          new Date(week.opens_at) < new Date(min.opens_at) ? week : min,
        ).opens_at,
      )
    : today.value,
);
const seasonEnd = computed(() =>
  props.weeks.length
    ? endOfDay(
        props.weeks.reduce((max, week) =>
          new Date(week.closes_at) > new Date(max.closes_at) ? week : max,
        ).closes_at,
      )
    : today.value,
);

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

const firstMonth = computed(() => monthIndex(seasonStart.value));
const lastMonth = computed(() => monthIndex(seasonEnd.value));

// Open on the month the viewer is living in, clamped into the season.
const cursor = ref(
  Math.min(Math.max(monthIndex(now.value), monthIndex(seasonStart.value)), monthIndex(seasonEnd.value)),
);
const cursorDate = computed(
  () => new Date(Math.floor(cursor.value / 12), cursor.value % 12, 1),
);
const canPrev = computed(() => cursor.value > firstMonth.value);
const canNext = computed(() => cursor.value < lastMonth.value);

const monthLabel = computed(() =>
  cursorDate.value.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  }),
);

const weekdayNames = computed(() => {
  // Week starts Sunday to match the ui/calendar the propose dialog uses.
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(base);
    day.setDate(base.getDate() + index);
    return {
      short: day.toLocaleDateString(undefined, { weekday: "short" }),
      index,
    };
  });
});

const fixturesByDay = computed(() => {
  const map = new Map<string, Fixture[]>();
  for (const fixture of fixtures.value) {
    if (fixture.bye) {
      continue;
    }
    const key = dayKey(fixture.date);
    map.set(key, [...(map.get(key) ?? []), fixture]);
  }
  return map;
});

interface DayCell {
  date: Date;
  key: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  week?: MatchWeek;
  /** Amber wash: a window that's still open and still owes the viewer a time. */
  actionable: boolean;
  isDefaultNight: boolean;
  /** The one fixture a click on this cell would propose for — else no affordance. */
  slotFor: Fixture | null;
  events: Fixture[];
}

interface CalendarRow {
  gutter: string;
  days: DayCell[];
}

const rows = computed<CalendarRow[]>(() => {
  const first = new Date(cursorDate.value);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());

  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const trailing = 6 - last.getDay();
  const totalDays = Math.ceil((last.getDate() + first.getDay() + trailing) / 7) * 7;

  const cells: DayCell[] = [];
  for (let offset = 0; offset < totalDays; offset++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);

    const week = weekForDay(props.weeks, date);
    const key = dayKey(date);
    const events = fixturesByDay.value.get(key) ?? [];

    const weekFixtures = week
      ? fixtures.value.filter(
          (fixture) => fixture.weekNumber === week.week_number && !fixture.bye,
        )
      : [];
    const openFixtures = weekFixtures.filter(
      (fixture) => fixture.needsMe && reschedulable(fixture),
    );
    const windowOpen = !!week && new Date(week.closes_at) >= now.value;

    // Ambiguity guard: with two open fixtures in one week (an admin browsing the
    // division) a cell click has no single meaning, so we don't offer one.
    const proposable =
      windowOpen &&
      openFixtures.length === 1 &&
      date >= today.value &&
      date >= startOfDay(week!.opens_at) &&
      date <= endOfDay(week!.closes_at);

    cells.push({
      date,
      key,
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      isToday: key === dayKey(now.value),
      week,
      actionable: windowOpen && openFixtures.length > 0,
      isDefaultNight: !!week && dayKey(week.default_match_at) === key,
      slotFor: proposable && !events.length ? openFixtures[0] : null,
      events,
    });
  }

  const result: CalendarRow[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    const days = cells.slice(index, index + 7);
    const numbers = [
      ...new Set(
        days.flatMap((day) => (day.week ? [day.week.week_number] : [])),
      ),
    ];
    result.push({
      gutter: numbers.length
        ? numbers.map((number) => `W${number}`).join(" · ")
        : "",
      days,
    });
  }
  return result;
});

// ---- Agenda ----

const agenda = computed(() =>
  [...fixtures.value].sort((a, b) => {
    if (a.weekNumber !== b.weekNumber) {
      return a.weekNumber - b.weekNumber;
    }
    return a.date.getTime() - b.date.getTime();
  }),
);

// ---- Rail ----

const needsAction = computed(() =>
  fixtures.value
    .filter((fixture) => fixture.needsMe)
    .sort((a, b) => a.weekNumber - b.weekNumber),
);

const upcoming = computed(() =>
  fixtures.value
    .filter(
      (fixture) =>
        !fixture.bye &&
        fixture.status !== "finished" &&
        fixture.date >= today.value,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4),
);

// ---- Presentation ----

const EVENT_CLASSES: Record<string, string> = {
  finished: "border-l-border bg-muted/40 text-muted-foreground",
  won: "border-l-success bg-success/10 text-success",
  lost: "border-l-destructive bg-destructive/10 text-destructive",
  live: "border-l-destructive bg-destructive/15 text-destructive",
  "pending-me":
    "border-l-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]",
  "pending-them":
    "border-l-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)] text-[hsl(var(--tac-amber))]",
  agreed: "border-l-muted-foreground/60 bg-muted/50 text-muted-foreground",
  default:
    "border-l-border border-dashed bg-transparent text-muted-foreground opacity-70",
};

function eventClass(fixture: Fixture): string {
  if (fixture.status === "finished") {
    const key = fixture.won === true ? "won" : fixture.won === false ? "lost" : "finished";
    return EVENT_CLASSES[key];
  }
  return EVENT_CLASSES[fixture.status] ?? EVENT_CLASSES.default;
}

function statusKey(fixture: Fixture): string {
  if (fixture.status === "finished") {
    return fixture.won === true ? "won" : fixture.won === false ? "lost" : "played";
  }
  return fixture.status;
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(value: Date): string {
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function opponentLabel(fixture: Fixture): string {
  if (fixture.mine) {
    return fixture.opponent?.name ?? "TBD";
  }
  return `${fixture.bracket.team_1?.name ?? "TBD"} v ${fixture.bracket.team_2?.name ?? "TBD"}`;
}

// ---- Dialogs ----

const { t } = useI18n();

const detailFor = ref<Fixture | null>(null);
const proposeFor = ref<Fixture | null>(null);
const proposeDay = ref<string | null>(null);
// The day cell the propose surface points at. Set only when the flow started
// from the grid, which is what makes the popover placement meaningful.
const anchorKey = ref<string | null>(null);
// When countering, the proposal being replaced (declined as "Countered").
const counterProposalId = ref<string | null>(null);

// Anchoring to a cell only reads as a calendar popover when there's room for it
// beside the grid; below that the modal is the honest surface.
const isDesktop = useMediaQuery("(min-width: 768px)");
const usePopover = computed(
  () => isDesktop.value && !!anchorKey.value && !!proposeFor.value,
);

const proposeMatchup = computed(() =>
  proposeFor.value ? matchupLabel(proposeFor.value) : null,
);
const proposeScope = computed(() =>
  proposeFor.value
    ? [
        props.seasonName,
        t("league.schedule.week", { week: proposeFor.value.weekNumber }),
      ]
        .filter(Boolean)
        .join(" · ")
    : null,
);

function matchupLabel(fixture: Fixture): string {
  if (fixture.mine) {
    return `vs ${fixture.opponent?.name ?? "TBD"}`;
  }
  return `${fixture.bracket.team_1?.name ?? "TBD"} vs ${fixture.bracket.team_2?.name ?? "TBD"}`;
}

function openSlot(cell: DayCell) {
  if (!cell.slotFor) {
    return;
  }
  proposeFor.value = cell.slotFor;
  proposeDay.value = cell.date.toISOString();
  anchorKey.value = cell.key;
  counterProposalId.value = null;
}

function openPropose(fixture: Fixture) {
  detailFor.value = null;
  proposeFor.value = fixture;
  proposeDay.value = null;
  anchorKey.value = null;
  counterProposalId.value = null;
}

function openCounter(fixture: Fixture, proposalId: string) {
  detailFor.value = null;
  proposeFor.value = fixture;
  proposeDay.value = null;
  anchorKey.value = null;
  counterProposalId.value = proposalId;
}

// Paging the month (or switching to agenda) unmounts the anchor cell, which
// would strand the popover at a stale position.
watch([cursor, view], () => {
  if (anchorKey.value) {
    closePropose();
  }
});

function onProposeSubmit(proposedTime: string, message: string) {
  if (!proposeFor.value) {
    return;
  }
  // A counter rejects the standing proposal (kept as "Countered" in history)
  // and offers a new time.
  if (counterProposalId.value) {
    emit("respond", counterProposalId.value, "Countered");
    counterProposalId.value = null;
  }
  emit("propose", proposeFor.value.bracket.id, proposedTime, message);
}

function closePropose() {
  proposeFor.value = null;
  proposeDay.value = null;
  anchorKey.value = null;
  counterProposalId.value = null;
}

function onPopoverSubmit(proposedTime: string, message: string) {
  onProposeSubmit(proposedTime, message);
  closePropose();
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <div
        v-if="view === 'month'"
        class="flex items-center gap-0.5 rounded-md border border-border bg-card/50 p-0.5"
      >
        <Button
          size="icon"
          variant="ghost"
          class="h-7 w-7"
          :disabled="!canPrev"
          @click="cursor--"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span
          class="min-w-[9rem] text-center font-mono text-[0.66rem] font-bold uppercase tracking-[0.16em]"
        >
          {{ monthLabel }}
        </span>
        <Button
          size="icon"
          variant="ghost"
          class="h-7 w-7"
          :disabled="!canNext"
          @click="cursor++"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>

      <div class="flex gap-0.5 rounded-md border border-border bg-card/50 p-0.5">
        <button
          v-for="mode in views"
          :key="mode"
          type="button"
          class="rounded px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors"
          :class="
            view === mode
              ? 'bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="view = mode"
        >
          {{ $t(`league.calendar.${mode}`) }}
        </button>
      </div>

      <span
        v-if="view !== 'table' && hasOwnFixtures"
        class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
      >
        <User class="h-3.5 w-3.5" />
        {{ $t("league.schedule.my_matches") }}
      </span>

      <span
        class="ml-auto inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
      >
        <Globe class="h-3.5 w-3.5" />
        {{ $t("league.calendar.times_in") }}
        <span class="text-foreground">{{ timeZoneAbbr || timeZone }}</span>
      </span>
    </div>

    <!-- ===== Admin table (division-wide, no rail — it needs the width) ===== -->
    <SeasonScheduleTable
      v-if="view === 'table'"
      :fixtures="allFixtures"
      :weeks="weeks"
      @open="detailFor = $event"
    />

    <div v-else class="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
      <div>
        <!-- ===== Month grid ===== -->
        <Popover
          v-if="view === 'month'"
          :open="usePopover"
          @update:open="(open) => !open && closePropose()"
        >
        <div
          class="overflow-x-auto rounded-lg border border-border bg-[hsl(var(--card)/0.35)]"
        >
          <div class="min-w-[42rem]">
            <div
              class="grid grid-cols-[2.3rem_repeat(7,minmax(0,1fr))] border-b border-border bg-background/40"
            >
              <div class="border-r border-border"></div>
              <div
                v-for="weekday in weekdayNames"
                :key="weekday.index"
                class="px-2 py-2 text-center font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ weekday.short }}
              </div>
            </div>

            <div
              v-for="(row, rowIndex) in rows"
              :key="rowIndex"
              class="grid grid-cols-[2.3rem_repeat(7,minmax(0,1fr))] border-t border-border first:border-t-0"
            >
              <div
                class="flex items-center justify-center border-r border-border bg-background/25 py-2 font-mono text-[0.55rem] font-bold tracking-[0.1em] text-muted-foreground/60 [writing-mode:vertical-rl] [transform:rotate(180deg)]"
              >
                {{ row.gutter }}
              </div>

              <div
                v-for="cell in row.days"
                :key="cell.key"
                class="group relative min-h-[6.4rem] min-w-0 overflow-hidden border-l border-border/60 p-1.5 first:border-l-0 transition-colors"
                :class="[
                  !cell.inMonth ? 'bg-background/50' : '',
                  cell.actionable ? 'bg-[hsl(var(--tac-amber)/0.04)]' : '',
                  cell.slotFor
                    ? 'cursor-pointer hover:bg-[hsl(var(--tac-amber)/0.08)]'
                    : '',
                ]"
                @click="openSlot(cell)"
              >
                <!-- Zero-size anchor: the popover points at the day you clicked. -->
                <PopoverAnchor v-if="anchorKey === cell.key" as-child>
                  <span class="pointer-events-none absolute inset-0"></span>
                </PopoverAnchor>

                <div class="flex items-start justify-between gap-1">
                  <span
                    class="shrink-0 px-1 font-mono text-[0.62rem]"
                    :class="[
                      cell.isToday
                        ? 'rounded-sm bg-[hsl(var(--tac-amber))] font-bold text-[hsl(var(--tac-amber-foreground))]'
                        : cell.inMonth
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/35',
                    ]"
                  >
                    {{ cell.dayOfMonth }}
                  </span>
                  <span
                    v-if="cell.isDefaultNight && cell.inMonth"
                    class="shrink-0 whitespace-nowrap font-mono text-[0.44rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber)/0.65)]"
                  >
                    {{ $t("league.calendar.default_short") }}
                  </span>
                </div>

                <!-- Propose affordance -->
                <span
                  v-if="cell.slotFor"
                  class="pointer-events-none absolute inset-x-1.5 bottom-1.5 top-7 grid place-items-center rounded border border-dashed border-[hsl(var(--tac-amber)/0.45)] font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[hsl(var(--tac-amber))] opacity-0 transition-opacity group-hover:opacity-100"
                >
                  + {{ $t("league.schedule.propose") }}
                </span>

                <!-- Events -->
                <button
                  v-for="fixture in cell.events"
                  :key="fixture.bracket.id"
                  type="button"
                  class="mt-1 block w-full min-w-0 rounded border-l-2 px-1.5 py-1 text-left transition-transform hover:translate-x-px"
                  :class="eventClass(fixture)"
                  @click.stop="detailFor = fixture"
                >
                  <span class="block font-mono text-[0.58rem] font-bold">
                    <Radio
                      v-if="fixture.status === 'live'"
                      class="mr-0.5 inline-block h-2.5 w-2.5 align-[-1px]"
                    />
                    <Lock
                      v-else-if="fixture.status === 'agreed'"
                      class="mr-0.5 inline-block h-2.5 w-2.5 align-[-1px]"
                    />
                    {{ formatTime(fixture.date) }}
                  </span>
                  <span
                    class="block truncate text-[0.66rem] font-semibold text-foreground"
                  >
                    {{ opponentLabel(fixture) }}
                  </span>
                  <span
                    class="block truncate font-mono text-[0.48rem] uppercase tracking-[0.1em] opacity-90"
                  >
                    {{ $t(`league.calendar.status.${statusKey(fixture)}`) }}
                    <template v-if="fixture.score">· {{ fixture.score }}</template>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

          <PopoverContent
            v-if="proposeFor"
            side="right"
            align="start"
            :collision-padding="12"
            class="w-[21rem] p-4"
          >
            <div
              class="mb-3 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("league.schedule.propose_title") }}
            </div>
            <ProposeTimeForm
              :key="`${proposeFor.bracket.id}:${proposeDay ?? ''}`"
              :week-opens-at="proposeFor.week.opens_at"
              :week-closes-at="proposeFor.week.closes_at"
              :initial-date="proposeDay"
              :default-time="localTimeInput(proposeFor.week.default_match_at)"
              :matchup="proposeMatchup"
              :scope="proposeScope"
              @submit="onPopoverSubmit"
              @cancel="closePropose"
            />
          </PopoverContent>
        </Popover>

        <!-- ===== Agenda ===== -->
        <div
          v-else
          class="divide-y divide-border/60 rounded-lg border border-border bg-[hsl(var(--card)/0.35)]"
        >
          <p
            v-if="!agenda.length"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            {{ $t("league.schedule.no_matchups") }}
          </p>
          <button
            v-for="fixture in agenda"
            :key="fixture.bracket.id"
            type="button"
            class="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/25 disabled:cursor-default"
            :class="
              fixture.needsMe
                ? 'border-l-2 border-l-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.04)]'
                : fixture.mine
                  ? 'border-l-2 border-l-border/70'
                  : ''
            "
            :disabled="fixture.bye"
            @click="detailFor = fixture"
          >
            <span
              class="w-9 shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70"
            >
              W{{ fixture.weekNumber }}
            </span>

            <span v-if="!fixture.bye" class="w-14 shrink-0 text-center">
              <span class="block font-mono text-[0.55rem] uppercase text-muted-foreground">
                {{ formatDay(fixture.date) }}
              </span>
              <span
                class="block font-mono text-[0.72rem] font-bold"
                :class="fixture.exact ? '' : 'text-muted-foreground'"
              >
                {{ formatTime(fixture.date) }}
              </span>
            </span>
            <span v-else class="w-14 shrink-0"></span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">
                {{ fixture.bye ? $t("league.schedule.bye") : opponentLabel(fixture) }}
              </span>
              <span
                v-if="!fixture.bye"
                class="mt-0.5 block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted-foreground"
              >
                {{ $t(`league.calendar.status.${statusKey(fixture)}`) }}
                <template v-if="fixture.score">· {{ fixture.score }}</template>
                <template v-else-if="fixture.status === 'default'">
                  · {{ $t("league.calendar.default_night") }}
                </template>
              </span>
            </span>

            <span
              v-if="fixture.bestOf && !fixture.bye"
              class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.12em]"
              :class="
                fixture.bestOf > 1
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground/60'
              "
            >
              BO{{ fixture.bestOf }}
            </span>
          </button>
        </div>

        <!-- Legend -->
        <div
          v-if="view === 'month'"
          class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground/75"
        >
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--tac-amber))]"></i>
            {{ $t("league.calendar.legend.awaiting") }}
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-2.5 rounded-sm bg-muted-foreground/60"></i>
            {{ $t("league.calendar.legend.agreed") }}
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-2.5 rounded-sm bg-success"></i>
            {{ $t("league.calendar.legend.won") }}
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-2.5 rounded-sm bg-destructive"></i>
            {{ $t("league.calendar.legend.lost") }}
          </span>
          <span class="flex items-center gap-1.5">
            <i
              class="h-2.5 w-2.5 rounded-sm border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)]"
            ></i>
            {{ $t("league.calendar.legend.window") }}
          </span>
        </div>
      </div>

      <!-- ===== Rail ===== -->
      <aside class="flex flex-col gap-3 lg:sticky lg:top-4">
        <section
          v-if="needsAction.length"
          class="rounded-lg border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--card)/0.6)] p-4"
        >
          <div
            class="mb-2.5 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
              ></span>
              <span
                class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
              ></span>
            </span>
            {{ $t("league.calendar.needs_you") }}
          </div>

          <button
            v-for="fixture in needsAction.slice(0, 3)"
            :key="fixture.bracket.id"
            type="button"
            class="mb-2 block w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-left transition-colors last:mb-0 hover:border-[hsl(var(--tac-amber)/0.5)]"
            @click="detailFor = fixture"
          >
            <span class="block truncate text-sm font-semibold">
              {{ opponentLabel(fixture) }}
            </span>
            <span
              class="mt-0.5 block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted-foreground"
            >
              W{{ fixture.weekNumber }} ·
              {{ $t(`league.calendar.status.${statusKey(fixture)}`) }}
            </span>
          </button>

          <p
            v-if="needsAction.length > 3"
            class="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground"
          >
            +{{ needsAction.length - 3 }} {{ $t("league.calendar.more") }}
          </p>
        </section>

        <section
          v-else
          class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-4"
        >
          <div
            class="mb-1.5 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("league.calendar.needs_you") }}
          </div>
          <p class="text-sm text-muted-foreground">
            {{ $t("league.calendar.all_clear") }}
          </p>
        </section>

        <section class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-4">
          <div
            class="mb-2.5 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("league.calendar.upcoming") }}
          </div>

          <p v-if="!upcoming.length" class="text-sm text-muted-foreground">
            {{ $t("league.calendar.no_upcoming") }}
          </p>

          <button
            v-for="fixture in upcoming"
            :key="fixture.bracket.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/30"
            @click="detailFor = fixture"
          >
            <span class="w-9 shrink-0 text-center">
              <span
                class="block font-mono text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {{ fixture.date.toLocaleDateString(undefined, { month: "short" }) }}
              </span>
              <span class="block font-mono text-base font-bold leading-none">
                {{ fixture.date.getDate() }}
              </span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[0.8rem] font-semibold">
                {{ opponentLabel(fixture) }}
              </span>
              <span
                class="block font-mono text-[0.55rem] tracking-[0.08em] text-muted-foreground"
              >
                {{ formatTime(fixture.date) }}
                <template v-if="fixture.status === 'default'">
                  · {{ $t("league.calendar.default_night") }}
                </template>
              </span>
            </span>
            <CalendarClock
              v-if="!fixture.exact"
              class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <Lock v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          </button>
        </section>

        <TeamCalendarButton v-if="myTeamId" :team-id="myTeamId" class="w-full" />
      </aside>
    </div>

    <FixtureDetailDialog
      :open="!!detailFor"
      :fixture="detailFor"
      :is-admin="isAdmin"
      :my-steam-id="mySteamId"
      :busy="busy"
      @update:open="(open) => !open && (detailFor = null)"
      @propose="openPropose"
      @counter="openCounter"
      @respond="(id, status) => emit('respond', id, status)"
      @forfeit="(bracketId, teamId) => emit('forfeit', bracketId, teamId)"
    />

    <ProposeTimeDialog
      v-if="proposeFor && !usePopover"
      :open="!!proposeFor"
      :week-opens-at="proposeFor.week.opens_at"
      :week-closes-at="proposeFor.week.closes_at"
      :initial-date="proposeDay"
      :default-time="localTimeInput(proposeFor.week.default_match_at)"
      :matchup="proposeMatchup"
      :scope="proposeScope"
      @update:open="(open) => !open && closePropose()"
      @submit="onProposeSubmit"
    />
  </div>
</template>
