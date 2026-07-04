<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import FilterBar from "~/components/common/FilterBar.vue";
import Pagination from "~/components/Pagination.vue";
import { ChevronRight, Lock, Radio, Search } from "lucide-vue-next";
import type { Fixture, MatchWeek } from "~/utilities/leagueFixtures";

// The admin surface. Unlike the calendar — which answers "when do I play" for a
// single captain — this answers "which of these hundreds of fixtures still has
// no agreed time", so it's a dense, filterable, read-first table.
const props = defineProps<{
  fixtures: Fixture[];
  weeks: MatchWeek[];
}>();

const emit = defineEmits<{ (e: "open", fixture: Fixture): void }>();

const search = ref("");
const week = ref<string>("all");
const status = ref<string>("all");
const page = ref(1);
const perPage = 25;

const STATUS_OPTIONS = [
  "unscheduled",
  "pending-them",
  "pending-me",
  "agreed",
  "live",
  "finished",
];

// The table's "unscheduled" is the fixture model's `default` — nobody has put a
// time forward, so it falls back to the league's match night.
function statusOf(fixture: Fixture): string {
  return fixture.status === "default" ? "unscheduled" : fixture.status;
}

const playable = computed(() =>
  props.fixtures.filter((fixture) => !fixture.bye),
);

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  return playable.value
    .filter((fixture) => {
      if (week.value !== "all" && String(fixture.weekNumber) !== week.value) {
        return false;
      }
      if (status.value !== "all" && statusOf(fixture) !== status.value) {
        return false;
      }
      if (term) {
        const haystack =
          `${fixture.bracket.team_1?.name ?? ""} ${fixture.bracket.team_2?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) =>
      a.weekNumber !== b.weekNumber
        ? a.weekNumber - b.weekNumber
        : a.date.getTime() - b.date.getTime(),
    );
});

watch([search, week, status], () => {
  page.value = 1;
});

const paged = computed(() =>
  filtered.value.slice((page.value - 1) * perPage, page.value * perPage),
);

const unscheduledCount = computed(
  () => playable.value.filter((f) => f.status === "default").length,
);
const awaitingCount = computed(
  () => playable.value.filter((f) => f.pending.length > 0).length,
);

const STATUS_CLASSES: Record<string, string> = {
  unscheduled:
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  "pending-me":
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  "pending-them": "border-border bg-muted/30 text-muted-foreground",
  agreed: "border-border bg-muted/40 text-foreground",
  live: "border-destructive/50 bg-destructive/10 text-destructive",
  finished: "border-success/40 bg-success/10 text-success",
};

function formatWhen(fixture: Fixture): string {
  return fixture.date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function proposedBy(fixture: Fixture): string | null {
  return fixture.pending[0]?.proposed_by?.name ?? null;
}
</script>

<template>
  <div class="space-y-3">
    <FilterBar>
      <!-- Search is always visible: type straight into it, never behind a menu. -->
      <div class="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="$t('league.calendar.search_teams')"
          class="h-8 pl-8 text-xs"
        />
      </div>

      <Select v-model="week">
        <SelectTrigger class="h-8 w-[8.5rem] text-xs">
          <SelectValue :placeholder="$t('league.calendar.all_weeks')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ $t("league.calendar.all_weeks") }}</SelectItem>
          <SelectItem
            v-for="w in weeks"
            :key="w.id"
            :value="String(w.week_number)"
          >
            {{ $t("league.schedule.week", { week: w.week_number }) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="status">
        <SelectTrigger class="h-8 w-[10rem] text-xs">
          <SelectValue :placeholder="$t('league.calendar.all_statuses')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {{ $t("league.calendar.all_statuses") }}
          </SelectItem>
          <SelectItem v-for="option in STATUS_OPTIONS" :key="option" :value="option">
            {{ $t(`league.calendar.status.${option}`) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <span
        class="ml-auto flex flex-wrap items-center gap-x-3 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span>{{ filtered.length }} / {{ playable.length }}</span>
        <span v-if="unscheduledCount" class="text-[hsl(var(--tac-amber))]">
          {{ $t("league.calendar.n_unscheduled", { count: unscheduledCount }) }}
        </span>
        <span v-if="awaitingCount">
          {{ $t("league.calendar.n_awaiting", { count: awaitingCount }) }}
        </span>
      </span>
    </FilterBar>

    <div class="rounded-lg border border-border bg-[hsl(var(--card)/0.35)]">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-[4.5rem]">{{ $t("league.calendar.col.week") }}</TableHead>
            <TableHead>{{ $t("league.calendar.col.matchup") }}</TableHead>
            <TableHead class="w-[11rem]">{{ $t("league.calendar.col.status") }}</TableHead>
            <TableHead class="w-[13rem]">{{ $t("league.calendar.col.time") }}</TableHead>
            <TableHead class="w-[10rem]">
              {{ $t("league.calendar.col.proposed_by") }}
            </TableHead>
            <TableHead class="w-[3rem]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!paged.length" class="hover:bg-transparent">
            <TableCell
              colspan="6"
              class="py-10 text-center text-sm text-muted-foreground"
            >
              {{ $t("league.calendar.no_results") }}
            </TableCell>
          </TableRow>

          <TableRow
            v-for="fixture in paged"
            :key="fixture.bracket.id"
            class="cursor-pointer"
            @click="emit('open', fixture)"
          >
            <TableCell
              class="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground"
            >
              W{{ fixture.weekNumber }}
            </TableCell>

            <TableCell class="min-w-0">
              <span class="flex items-center gap-2 text-sm">
                <span class="truncate font-semibold">
                  {{ fixture.bracket.team_1?.name ?? "TBD" }}
                </span>
                <span class="shrink-0 font-mono text-[0.62rem] text-muted-foreground">
                  vs
                </span>
                <span class="truncate font-semibold">
                  {{ fixture.bracket.team_2?.name ?? "TBD" }}
                </span>
                <span
                  v-if="fixture.bestOf"
                  class="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.1em]"
                  :class="
                    fixture.bestOf > 1
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground/60'
                  "
                >
                  BO{{ fixture.bestOf }}
                </span>
              </span>
            </TableCell>

            <TableCell>
              <span
                class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em]"
                :class="STATUS_CLASSES[statusOf(fixture)]"
              >
                <Radio v-if="fixture.status === 'live'" class="h-3 w-3" />
                <Lock v-else-if="fixture.status === 'agreed'" class="h-3 w-3" />
                {{ $t(`league.calendar.status.${statusOf(fixture)}`) }}
              </span>
            </TableCell>

            <TableCell
              class="font-mono text-xs"
              :class="
                fixture.status === 'default'
                  ? 'text-muted-foreground'
                  : 'text-foreground'
              "
            >
              {{ formatWhen(fixture) }}
              <span
                v-if="fixture.status === 'default'"
                class="block text-[0.56rem] uppercase tracking-[0.1em] text-muted-foreground/70"
              >
                {{ $t("league.calendar.default_night") }}
              </span>
              <span
                v-else-if="fixture.score"
                class="block text-[0.6rem] text-muted-foreground"
              >
                {{ fixture.score }}
              </span>
            </TableCell>

            <TableCell class="truncate text-xs text-muted-foreground">
              {{ proposedBy(fixture) ?? "—" }}
            </TableCell>

            <TableCell>
              <ChevronRight class="h-4 w-4 text-muted-foreground" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Pagination
      v-if="filtered.length > perPage"
      :total="filtered.length"
      :page="page"
      :per-page="perPage"
      @page="page = $event"
    />
  </div>
</template>
