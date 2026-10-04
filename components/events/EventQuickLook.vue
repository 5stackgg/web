<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import { ArrowRight, Trophy } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";
import {
  eventLeaderboardQuery,
  featuredEventFields,
} from "~/graphql/eventCardFields";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { eventPhase } from "~/utilities/eventDisplay";
import {
  eventDayProgress,
  eventOrganizerNames,
  formatEventRange,
  formatStartTime,
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";

const props = defineProps<{ event: any }>();

const { t } = useI18n();

const { result } = useQuery(
  typedGql("query")({
    events_by_pk: [
      { id: $("id", "uuid!") },
      { ...featuredEventFields, visibility: true },
    ],
  } as any),
  () => ({ id: props.event.id }),
);

const { result: leaderboardResult } = useQuery(
  eventLeaderboardQuery,
  () => ({ eventId: props.event.id }),
  { fetchPolicy: "network-only" },
);

const details = computed(() => (result.value as any)?.events_by_pk ?? null);
const leaderboard = computed(
  () => (leaderboardResult.value as any)?.get_event_leaderboard ?? [],
);

const phase = computed(() => eventPhase(props.event));
const path = computed(() => `/events/${props.event.id}`);

const bannerSrc = computed(() =>
  props.event.banner && !props.event.banner.mime_type?.startsWith("video/")
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);

const whenLine = computed(() => {
  const parts: string[] = [];
  const progress =
    phase.value === "live"
      ? eventDayProgress(props.event.starts_at, props.event.ends_at)
      : null;
  if (progress) {
    parts.push(
      progress.total
        ? t("pages.watch.events.day_of", progress)
        : t("pages.watch.events.day", progress),
    );
  }
  parts.push(
    formatEventRange(props.event.starts_at, props.event.ends_at) ??
      t("pages.events.date_tbd"),
  );
  return parts.join(" · ");
});

const organizers = computed(() =>
  details.value ? eventOrganizerNames(details.value) : [],
);

const counts = computed(() =>
  [
    { key: "count_tournaments", aggregate: "tournaments" },
    { key: "count_teams", aggregate: "teams" },
    { key: "count_players", aggregate: "players" },
    { key: "count_media", aggregate: "media" },
  ]
    .map((count) => ({
      key: count.key,
      value: props.event[`${count.aggregate}_aggregate`]?.aggregate?.count ?? 0,
    }))
    .filter((count) => count.value > 0),
);

const tournaments = computed(() =>
  (details.value?.tournaments || [])
    .map((entry: any) => entry.tournament)
    .filter(Boolean),
);

const visibility = computed(() => details.value?.visibility);

const phaseClasses = computed(() => {
  if (phase.value === "live") return "text-destructive";
  if (phase.value === "upcoming") return "text-[hsl(var(--tac-amber))]";
  return "text-foreground/85";
});

const sectionTitle = "m-0 text-xs font-medium text-muted-foreground";
const section = "grid gap-2.5 border-t border-border/65 pt-4";
</script>

<template>
  <div class="relative aspect-[3/1] overflow-hidden bg-muted/40">
    <img v-if="bannerSrc" :src="bannerSrc" alt="" class="h-full w-full object-cover" />
  </div>

  <div class="grid gap-5 px-5 pb-6 pt-4">
    <div class="grid gap-1.5">
      <p
        class="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
      >
        <span
          v-if="phase === 'live'"
          class="relative mr-0.5 inline-flex h-2 w-2 shrink-0"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
          ></span>
          <span
            class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
          ></span>
        </span>
        <span class="font-semibold" :class="phaseClasses">
          {{ $t(`event.phase.${phase}`) }}
        </span>
        <span aria-hidden="true">·</span>
        <span>{{ whenLine }}</span>
        <template v-if="visibility && visibility !== 'Public'">
          <span aria-hidden="true">·</span>
          <span class="text-[hsl(var(--tac-amber))]">
            {{ $t(`event.visibility.${visibility.toLowerCase()}`) }}
          </span>
        </template>
      </p>
      <h2 class="m-0 text-2xl font-extrabold leading-tight [text-wrap:balance]">
        {{ event.name }}
      </h2>
      <p v-if="organizers.length" class="m-0 text-[0.8125rem] text-muted-foreground">
        {{
          $t("pages.watch.events.organized_by", { names: organizers.join(", ") })
        }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        as-child
        size="sm"
        class="h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
      >
        <NuxtLink :to="path">
          {{ $t("pages.watch.events.open_event") }}
          <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </Button>
    </div>

    <dl v-if="counts.length" class="m-0 grid grid-cols-2 gap-x-5 gap-y-3.5">
      <div v-for="count in counts" :key="count.key" class="grid gap-0.5">
        <dt class="text-xs text-muted-foreground">
          {{ $t(`pages.events.counts.${count.key}`) }}
        </dt>
        <dd class="m-0 text-lg font-bold tabular-nums">{{ count.value }}</dd>
      </div>
    </dl>

    <div :class="section">
      <p :class="sectionTitle">{{ $t("pages.events.counts.count_tournaments") }}</p>
      <p
        v-if="details && !tournaments.length"
        class="m-0 text-[0.8125rem] text-muted-foreground"
      >
        {{ $t("pages.events.no_tournaments") }}
      </p>
      <div class="divide-y divide-border/60">
        <NuxtLink
          v-for="tournament in tournaments"
          :key="tournament.id"
          :to="`/tournaments/${tournament.id}`"
          class="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-1 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            class="grid h-9 w-9 place-items-center rounded-md bg-muted/55 text-xs font-extrabold tabular-nums text-muted-foreground"
          >
            {{ matchTypeLabel(tournament.options?.type) }}
          </span>
          <span class="min-w-0 truncate text-sm font-bold">
            {{ tournament.name }}
          </span>
          <span class="text-right text-xs text-muted-foreground">
            <span
              v-if="tournamentRowState(tournament.status) === 'live'"
              class="inline-flex items-center gap-1.5 font-semibold text-destructive"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-destructive"></span>
              {{ $t("event.phase.live") }}
            </span>
            <span
              v-else-if="tournamentChampion(tournament)"
              class="inline-flex items-center gap-1.5 font-semibold text-foreground"
            >
              <Trophy class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
              {{ tournamentChampion(tournament) }}
            </span>
            <template
              v-else-if="tournamentRowState(tournament.status) === 'finished'"
            >
              {{ $t("event.phase.finished") }}
            </template>
            <template v-else-if="tournament.start">
              {{
                $t("pages.watch.events.starts", {
                  time: formatStartTime(tournament.start),
                })
              }}
            </template>
          </span>
        </NuxtLink>
      </div>
    </div>

    <div v-if="leaderboard.length" :class="section">
      <p :class="sectionTitle">{{ $t("pages.watch.events.leaderboard") }}</p>
      <ol class="m-0 grid list-none gap-1 p-0">
        <li
          v-for="(row, index) in leaderboard"
          :key="row.player_steam_id"
          class="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 py-1 text-sm"
        >
          <span
            class="text-xs font-bold tabular-nums"
            :class="
              index === 0 ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
            "
          >
            {{ index + 1 }}
          </span>
          <span class="truncate font-semibold">{{ row.player_name }}</span>
          <span class="text-right">
            <b class="tabular-nums">{{ Number(row.value).toFixed(2) }}</b>
            <span class="ml-1.5 text-xs text-muted-foreground">
              {{
                $t(
                  "pages.watch.events.matches_played",
                  { count: row.matches_played ?? 0 },
                  row.matches_played ?? 0,
                )
              }}
            </span>
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
