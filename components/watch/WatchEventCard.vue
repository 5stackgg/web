<script setup lang="ts">
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, Link2, Music, Play, Trophy } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import WatchTournamentStepper from "~/components/watch/WatchTournamentStepper.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { useWatchHighlightsEvent } from "~/composables/useWatchStage";
import { formatPrizePool } from "~/utilities/prizePool";
import { parseExternalMedia } from "~/utilities/externalMedia";
import type { ProgressStep } from "~/utilities/tournamentProgressSteps";
import {
  eventDayProgress,
  formatEventRange,
  formatStartTime,
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";

const props = defineProps<{
  event: any;
  compact?: boolean;
  // Progress steps per live tournament id.
  steps: Record<string, ProgressStep[]>;
  leaderboard: any[];
  media: any[];
  mediaCount: number;
  playsCount: number;
}>();

const { t } = useI18n();
const { showEventHighlights } = useWatchHighlightsEvent();

const eventPath = computed(() => `/events/${props.event.id}`);

const bannerSrc = computed(() =>
  props.event.banner
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);
const bannerIsVideo = computed(() =>
  props.event.banner?.mime_type?.startsWith("video/"),
);

// Same precedence as EventHero: the creator unless hidden, then co-organizers.
const organizerNames = computed(() => {
  const e = props.event;
  const names: string[] = [];
  if (!e.hide_creator_organizer && e.organizer?.name) {
    names.push(e.organizer.name);
  }
  for (const entry of e.organizers || []) {
    if (String(entry.steam_id) === String(e.organizer_steam_id)) continue;
    if (entry.organizer?.name) names.push(entry.organizer.name);
  }
  return names;
});

const whenLine = computed(() => {
  const parts: string[] = [];
  const progress = eventDayProgress(props.event.starts_at, props.event.ends_at);
  if (progress) {
    parts.push(
      progress.total
        ? t("pages.watch.events.day_of", progress)
        : t("pages.watch.events.day", progress),
    );
  }
  const range = formatEventRange(props.event.starts_at, props.event.ends_at);
  if (range) parts.push(range);
  if (props.compact && organizerNames.value.length) {
    parts.push(
      t("pages.watch.events.organized_by", {
        names: organizerNames.value.join(", "),
      }),
    );
  }
  return parts.join(" · ");
});

const counts = computed(() =>
  [
    {
      key: "count_tournaments",
      value: props.event.tournaments_aggregate?.aggregate?.count ?? 0,
    },
    {
      key: "count_teams",
      value: props.event.teams_aggregate?.aggregate?.count ?? 0,
    },
    {
      key: "count_players",
      value: props.event.players_aggregate?.aggregate?.count ?? 0,
    },
    { key: "count_media", value: props.mediaCount },
  ].filter((count) => count.value > 0),
);

const tournaments = computed(() =>
  (props.event.tournaments || [])
    .map((entry: any) => entry.tournament)
    .filter(Boolean),
);

// The first live tournament with a bracket gets the stepper.
const lead = computed(() =>
  tournaments.value.find(
    (tournament: any) =>
      tournamentRowState(tournament.status) === "live" &&
      (props.steps[tournament.id]?.length ?? 0) > 0,
  ),
);
const rows = computed(() =>
  tournaments.value.filter((tournament: any) => tournament !== lead.value),
);

function stageType(tournament: any) {
  const stages = tournament.stages || [];
  const type = stages[stages.length - 1]?.type;
  return type ? t(`pages.watch.events.stage_types.${type}`) : null;
}

function meta(tournament: any) {
  const parts: string[] = [];
  const type = stageType(tournament);
  if (type) parts.push(type);
  const teams = tournament.teams_aggregate?.aggregate?.count ?? 0;
  if (teams > 0) {
    parts.push(
      `${teams} ${t(
        tournament.options?.type === "Duel"
          ? "pages.watch.events.count_players"
          : "pages.watch.events.count_teams",
        teams,
      )}`,
    );
  }
  const prizes = formatPrizePool(tournament.prizes);
  if (prizes) {
    parts.push(t("pages.watch.events.in_prizes", { amount: prizes }));
  }
  return parts.join(" · ");
}

function liveStep(tournament: any) {
  return props.steps[tournament.id]?.find((step) => step.state === "current");
}

function stepLabel(step: ProgressStep) {
  return t(`pages.watch.events.steps.${step.kind}`, {
    number: step.number ?? "",
  });
}

function mediaThumb(item: any): string | null {
  if (item.external_url) {
    const host = typeof window === "undefined" ? "" : window.location.hostname;
    return parseExternalMedia(item.external_url, host).thumbnailUrl;
  }
  if (item.mime_type?.startsWith("image/")) {
    return eventMediaUrl(props.event.id, item.filename);
  }
  if (item.thumbnail_filename) {
    return eventMediaUrl(props.event.id, item.thumbnail_filename);
  }
  return null;
}

function mediaIcon(item: any) {
  if (item.mime_type?.startsWith("audio/")) return Music;
  if (item.external_url) return Link2;
  return null;
}

const failedMedia = reactive(new Set<string>());

const moreMedia = computed(() =>
  Math.max(props.mediaCount - props.media.length, 0),
);

const hasSide = computed(
  () => props.leaderboard.length > 0 || props.media.length > 0,
);

function showPlays() {
  showEventHighlights({ id: props.event.id, name: props.event.name });
}

const tagClasses =
  "inline-flex h-[22px] items-center rounded-md px-[7px] text-xs font-semibold whitespace-nowrap bg-black/60 backdrop-blur-sm";
const linkClasses =
  "inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground";
const typeTileClasses =
  "grid h-9 w-9 place-items-center rounded-md text-xs font-extrabold tabular-nums";
</script>

<template>
  <article class="overflow-hidden rounded-lg border border-border bg-card/40">
    <div
      class="relative isolate flex flex-wrap justify-between gap-x-7 gap-y-4 px-4 sm:px-5"
      :class="
        compact
          ? 'min-h-[120px] items-center py-4'
          : 'min-h-[224px] items-end pb-5 pt-24 sm:pt-[22px]'
      "
    >
      <video
        v-if="bannerSrc && bannerIsVideo"
        :src="bannerSrc"
        aria-hidden="true"
        class="absolute inset-0 -z-20 h-full w-full object-cover"
        preload="metadata"
        muted
        playsinline
      />
      <img
        v-else-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
      />
      <div v-else aria-hidden="true" class="plate absolute inset-0 -z-20"></div>
      <div aria-hidden="true" class="scrim absolute inset-0 -z-10"></div>

      <div
        class="grid min-w-0 max-w-[680px]"
        :class="compact ? 'gap-1.5' : 'gap-2'"
      >
        <div
          class="flex flex-wrap items-center gap-2 text-[0.8125rem] text-foreground/85"
        >
          <span
            :class="[
              tagClasses,
              'text-destructive ring-1 ring-inset ring-destructive/50',
            ]"
          >
            {{ $t("event.phase.live") }}
          </span>
          <span>{{ whenLine }}</span>
        </div>
        <h3
          class="m-0 font-extrabold leading-none [text-wrap:balance]"
          :class="
            compact
              ? 'text-[clamp(1.375rem,2.2vw,1.75rem)]'
              : 'text-[clamp(1.75rem,3.1vw,2.75rem)]'
          "
        >
          {{ event.name }}
        </h3>
        <p
          v-if="!compact && organizerNames.length"
          class="m-0 text-[0.8125rem] text-foreground/70"
        >
          {{
            $t("pages.watch.events.organized_by", {
              names: organizerNames.join(", "),
            })
          }}
        </p>
        <div
          v-if="counts.length"
          class="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem] text-foreground/70 sm:flex sm:flex-wrap sm:gap-x-5"
          :class="{ 'mt-1': !compact }"
        >
          <span v-for="count in counts" :key="count.key">
            <b class="mr-1 text-base font-bold tabular-nums text-foreground">{{
              count.value
            }}</b>
            {{ $t(`pages.watch.events.${count.key}`, count.value) }}
          </span>
        </div>
      </div>

      <Button
        as-child
        size="sm"
        class="hit shrink-0 border border-[hsl(var(--tac-amber)/0.55)] bg-black/30 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)]"
      >
        <NuxtLink :to="eventPath">
          {{ $t("pages.watch.events.open_event") }}
          <ArrowRight />
        </NuxtLink>
      </Button>
    </div>

    <div
      class="grid border-t border-border"
      :class="{
        'lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]': hasSide,
      }"
    >
      <div
        class="grid min-w-0 content-start px-1.5 pb-2.5 pt-2 sm:px-3.5 sm:pb-3.5 sm:pt-3"
      >
        <div class="divide-y divide-border/60">
          <div v-if="lead" class="pb-3.5">
            <div
              class="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 px-2 py-[11px] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]"
            >
              <span
                :class="[
                  typeTileClasses,
                  'row-span-2 bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]',
                ]"
              >
                {{ matchTypeLabel(lead.options?.type) }}
              </span>
              <NuxtLink
                :to="`/tournaments/${lead.id}`"
                class="min-w-0 truncate text-[0.9375rem] font-bold hover:underline hover:underline-offset-[3px]"
              >
                {{ lead.name }}
              </NuxtLink>
              <span class="col-start-2 min-w-0 text-xs text-muted-foreground">
                {{ meta(lead) }}
              </span>
              <button
                v-if="playsCount > 0"
                type="button"
                class="hit col-start-2 mt-1 inline-flex items-center gap-1.5 justify-self-start rounded-sm text-[0.8125rem] font-semibold text-[hsl(var(--tac-amber))] hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0"
                @click="showPlays"
              >
                {{
                  $t(
                    "pages.watch.events.plays_link",
                    {
                      count: playsCount,
                      event: event.name,
                    },
                    playsCount,
                  )
                }}
                <ArrowRight class="h-3.5 w-3.5" />
              </button>
            </div>
            <div class="px-2 sm:pl-14 sm:pr-2">
              <WatchTournamentStepper
                :name="lead.name"
                :steps="steps[lead.id]"
              />
            </div>
          </div>

          <NuxtLink
            v-for="tournament in rows"
            :key="tournament.id"
            :to="`/tournaments/${tournament.id}`"
            class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-[11px] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              :class="[
                typeTileClasses,
                'row-span-2 bg-muted/55 text-muted-foreground',
              ]"
            >
              {{ matchTypeLabel(tournament.options?.type) }}
            </span>
            <span class="min-w-0 truncate text-[0.9375rem] font-bold">
              {{ tournament.name }}
            </span>
            <span
              class="col-start-3 row-span-2 row-start-1 flex flex-col items-end gap-0.5 text-right text-[0.8125rem] text-muted-foreground"
            >
              <template v-if="tournamentRowState(tournament.status) === 'live'">
                <span
                  class="inline-flex items-center gap-1.5 font-semibold text-foreground"
                >
                  <span class="relative inline-flex h-2 w-2 shrink-0">
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
                    ></span>
                    <span
                      class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
                    ></span>
                  </span>
                  <template v-if="liveStep(tournament)?.liveCount">
                    {{
                      $t("pages.watch.events.live_count", {
                        count: liveStep(tournament)!.liveCount,
                      })
                    }}
                  </template>
                  <template v-else>{{ $t("event.phase.live") }}</template>
                </span>
                <span v-if="liveStep(tournament)">{{
                  stepLabel(liveStep(tournament)!)
                }}</span>
              </template>
              <template
                v-else-if="tournamentRowState(tournament.status) === 'finished'"
              >
                <span
                  v-if="tournamentChampion(tournament)"
                  class="inline-flex items-center gap-1.5 font-semibold text-foreground"
                >
                  <Trophy class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
                  {{ tournamentChampion(tournament) }}
                </span>
                <span>{{ $t("event.phase.finished") }}</span>
              </template>
              <b
                v-else-if="tournament.start"
                class="font-semibold text-foreground"
              >
                {{
                  $t("pages.watch.events.starts", {
                    time: formatStartTime(tournament.start),
                  })
                }}
              </b>
            </span>
            <span class="col-start-2 min-w-0 text-xs text-muted-foreground">
              {{ meta(tournament) }}
            </span>
          </NuxtLink>

          <div v-if="!lead && playsCount > 0" class="px-2 py-3">
            <button
              type="button"
              class="hit inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-semibold text-[hsl(var(--tac-amber))] hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click="showPlays"
            >
              {{
                $t(
                  "pages.watch.events.plays_link",
                  {
                    count: playsCount,
                    event: event.name,
                  },
                  playsCount,
                )
              }}
              <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="hasSide"
        class="grid min-w-0 content-start gap-6 border-border px-3.5 pb-[18px] pt-4 max-lg:border-t sm:px-5 sm:pb-5 sm:pt-[18px] lg:border-l"
      >
        <div v-if="leaderboard.length">
          <div class="mb-2 flex items-baseline justify-between gap-2.5">
            <p class="m-0 text-xs text-muted-foreground">
              {{ $t("pages.watch.events.leaderboard") }}
            </p>
            <NuxtLink :to="`${eventPath}?tab=leaderboard`" :class="linkClasses">
              {{ $t("pages.watch.events.full_leaderboard") }}
              <ArrowRight class="h-3 w-3" />
            </NuxtLink>
          </div>
          <ol class="m-0 grid list-none gap-0.5 p-0">
            <li
              v-for="(row, index) in leaderboard"
              :key="row.player_steam_id"
              class="grid grid-cols-[1.625rem_1.875rem_minmax(0,1fr)_auto] items-center gap-2.5 px-1 py-1.5"
            >
              <span
                class="text-[0.8125rem] font-extrabold tabular-nums"
                :class="
                  index === 0
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                #{{ index + 1 }}
              </span>
              <Avatar class="h-[1.875rem] w-[1.875rem] rounded-full">
                <AvatarImage
                  v-if="row.player_avatar_url"
                  :src="row.player_avatar_url"
                  :alt="row.player_name"
                />
                <AvatarFallback class="text-xs font-bold">
                  {{ (row.player_name || "?").slice(0, 1).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <NuxtLink
                :to="`/players/${row.player_steam_id}`"
                class="min-w-0 truncate text-sm font-bold hover:underline hover:underline-offset-[3px]"
              >
                {{ row.player_name }}
              </NuxtLink>
              <span class="text-right">
                <b
                  class="block text-[1.0625rem] font-bold leading-tight tabular-nums"
                >
                  {{ Number(row.value).toFixed(2) }}
                </b>
                <span class="whitespace-nowrap text-xs text-muted-foreground">
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

        <div v-if="media.length">
          <div class="mb-2 flex items-baseline justify-between gap-2.5">
            <p class="m-0 text-xs text-muted-foreground">
              {{ $t("pages.watch.events.media") }}
            </p>
            <NuxtLink :to="`${eventPath}?tab=media`" :class="linkClasses">
              {{ $t("pages.watch.events.all_media") }}
              <ArrowRight class="h-3 w-3" />
            </NuxtLink>
          </div>
          <div class="grid grid-cols-5 gap-1.5">
            <NuxtLink
              v-for="item in media"
              :key="item.id"
              :to="`${eventPath}?tab=media`"
              :aria-label="item.title || $t('pages.watch.events.media')"
              class="group/media relative block aspect-square max-w-full overflow-hidden rounded-md border border-white/[0.08] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                v-if="mediaThumb(item) && !failedMedia.has(item.id)"
                :src="mediaThumb(item)!"
                alt=""
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-200 group-hover/media:scale-[1.06] motion-reduce:transition-none"
                @error="failedMedia.add(item.id)"
              />
              <span
                v-if="item.mime_type?.startsWith('video/')"
                aria-hidden="true"
                class="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-foreground/90 text-background"
              >
                <Play class="ml-px h-[11px] w-[11px] fill-current" />
              </span>
              <component
                :is="mediaIcon(item)"
                v-else-if="
                  mediaIcon(item) &&
                  (!mediaThumb(item) || failedMedia.has(item.id))
                "
                aria-hidden="true"
                class="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </NuxtLink>
            <NuxtLink
              v-if="moreMedia > 0"
              :to="`${eventPath}?tab=media`"
              :aria-label="
                $t('pages.watch.events.more_media', { count: moreMedia })
              "
              class="grid aspect-square max-w-full place-items-center rounded-md border border-white/[0.08] bg-muted/55 text-[0.9375rem] font-bold tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              +{{ moreMedia }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.plate {
  background:
    radial-gradient(
      ellipse 70% 100% at 70% 0%,
      hsl(220 10% 20% / 0.85),
      transparent 70%
    ),
    hsl(var(--muted) / 0.35);
}
.scrim {
  background:
    linear-gradient(
      90deg,
      hsl(var(--background) / 0.92) 0%,
      hsl(var(--background) / 0.66) 50%,
      hsl(var(--background) / 0.3) 100%
    ),
    linear-gradient(180deg, transparent 35%, hsl(var(--background) / 0.75));
}
@media (max-width: 639px) {
  .scrim {
    background: linear-gradient(
      180deg,
      hsl(var(--background) / 0.2) 0%,
      hsl(var(--background) / 0.92) 70%
    );
  }
}
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 2.75rem);
    height: max(100%, 2.75rem);
    transform: translate(-50%, -50%);
  }
}
</style>
