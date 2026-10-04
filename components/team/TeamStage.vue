<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { Radio, Swords } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import {
  teamMatchesFilter,
  teamStageMatchFields,
} from "~/graphql/teamPulseFields";
import { Button } from "~/components/ui/button";
import TeamCalendarButton from "~/components/team/TeamCalendarButton.vue";
import {
  TICKER_LIVE_STATUSES,
  sortLiveMatches,
  teamMonogram,
  tickerCell,
  tickerTag,
} from "~/components/watch/watchTicker";
import { relativeWhen } from "~/components/play/scheduleRow";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// The team's one headline card: the match it's playing, else the next one on
// the calendar, else what to do about an empty calendar.
const props = defineProps<{
  team: any;
  isOnTeam: boolean;
  matchesCount: number;
  canRequestScrim: boolean;
}>();
const emit = defineEmits<{
  (e: "open-scrims"): void;
  (e: "request-scrim"): void;
}>();

const { t, locale } = useI18n();
const { client } = useApolloClient();

// Live and scheduled are followed apart, so a long fixture list can't push
// the match being played out of the window.
const liveMatches = ref<any[]>([]);
const scheduledMatches = ref<any[]>([]);
let subs: Array<{ unsubscribe: () => void }> = [];

function stageQuery(order: any[]) {
  return generateSubscription({
    matches: [
      {
        where: {
          status: { _in: $("statuses", "[e_match_status_enum!]") },
          ...teamMatchesFilter,
        },
        order_by: order,
        limit: 10,
      },
      teamStageMatchFields,
    ],
  } as any);
}
const liveQuery = stageQuery([{ started_at: order_by.desc_nulls_last }]);
const scheduledQuery = stageQuery([
  { scheduled_at: order_by.asc_nulls_last },
  { created_at: order_by.asc },
]);

function stop() {
  subs.forEach((sub) => sub.unsubscribe());
  subs = [];
}

function follow(query: any, statuses: string[], into: typeof liveMatches) {
  const teamId = props.team?.id;
  subs.push(
    client.subscribe({ query, variables: { teamId, statuses } }).subscribe({
      next: ({ data }: any) => {
        into.value = data?.matches ?? [];
      },
      error: (error: any) => {
        console.error("[team-stage] subscription error", error);
      },
    }),
  );
}

watch(
  () => props.team?.id,
  (teamId) => {
    stop();
    liveMatches.value = [];
    scheduledMatches.value = [];
    if (!teamId || typeof window === "undefined") return;
    follow(liveQuery, [...TICKER_LIVE_STATUSES], liveMatches);
    follow(scheduledQuery, ["Scheduled"], scheduledMatches);
  },
  { immediate: true },
);
onBeforeUnmount(stop);

const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 30_000)
    : null;
onBeforeUnmount(() => clock && clearInterval(clock));

const ctx = computed(() => ({ t, locale: locale.value, now: now.value }));

const live = computed(() => {
  const match = sortLiveMatches(liveMatches.value)[0];
  return match ? { match, cell: tickerCell(match, ctx.value) } : null;
});

const upcoming = computed(() => scheduledMatches.value);

// The other side, when the team's own lineup can be told apart; a bracket
// lineup without a team_id falls back to the name.
function opponent(match: any) {
  const lineups = [match?.lineup_1, match?.lineup_2];
  const ours = lineups.findIndex(
    (lineup) =>
      lineup?.team_id === props.team?.id ||
      (!lineup?.team_id && lineup?.name === props.team?.name),
  );
  return ours === -1 ? null : lineups[1 - ours];
}

function lineupName(lineup: any) {
  return lineup?.team?.name || lineup?.name || t("pages.watch.ticker.tbd");
}

function vsLabel(match: any) {
  const other = opponent(match);
  return other
    ? lineupName(other)
    : `${lineupName(match.lineup_1)} – ${lineupName(match.lineup_2)}`;
}

function startLabel(iso: string | null) {
  if (!iso) return t("match.stream.card.scheduled");
  return new Date(iso).toLocaleString(locale.value, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function contextLabel(match: any) {
  return [
    tickerTag(match),
    t("pages.play.schedule.best_of", { count: match?.options?.best_of ?? 1 }),
  ]
    .filter(Boolean)
    .join(" · ");
}

const next = computed(() => {
  const match = upcoming.value[0];
  if (!match) return null;
  const other = opponent(match);
  const name = vsLabel(match);
  return {
    match,
    when: startLabel(match.scheduled_at),
    relative: match.scheduled_at
      ? relativeWhen(new Date(match.scheduled_at), now.value, t)
      : "",
    name,
    monogram: teamMonogram(name, other?.team?.short_name),
    avatar: other?.team?.avatar_url ?? null,
    teamId: other?.team?.id ?? other?.team_id ?? null,
    context: contextLabel(match),
  };
});

const then = computed(() => {
  const match = upcoming.value[1];
  return match
    ? {
        when: startLabel(match.scheduled_at),
        name: vsLabel(match),
        context: tickerTag(match),
      }
    : null;
});

// An empty calendar offers the one thing the viewer can do about it, if any.
const empty = computed(() => {
  const name = props.team?.name ?? "";
  const openScrims = () => emit("open-scrims");
  if (
    props.team?.can_manage_scrims &&
    useApplicationSettingsStore().scrimFinderEnabled
  ) {
    return props.team?.scrim_settings?.enabled
      ? {
          text: null,
          action: {
            label: t("pages.play.more_ways.scrims.find"),
            run: openScrims,
          },
        }
      : {
          text: t("team.pulse.stage.open_to_scrims", { name }),
          action: {
            label: t("team.pulse.stage.set_up_scrims"),
            run: openScrims,
          },
        };
  }
  if (props.canRequestScrim) {
    return {
      text: null,
      action: {
        label: t("scrim.request_scrim"),
        run: () => emit("request-scrim"),
      },
    };
  }
  return {
    text: props.matchesCount
      ? null
      : t("team.pulse.stage.never_played", { name }),
    action: null,
  };
});

const apiDomain = useRuntimeConfig().public.apiDomain;
function avatarSrc(path: string) {
  return /^https?:\/\//.test(path) ? path : `https://${apiDomain}/${path}`;
}

const cardClasses =
  "relative flex h-full flex-col gap-4 rounded-lg border px-5 py-4 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)]";
</script>

<template>
  <section
    :class="[cardClasses, live ? 'border-destructive/35' : 'border-border']"
    aria-labelledby="team-stage-label"
  >
    <!-- Live: the match the team is in right now -->
    <template v-if="live">
      <div class="flex items-center justify-between gap-3">
        <h2
          id="team-stage-label"
          :class="[tacticalSectionLabelClasses, '!mb-0 !flex']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("team.pulse.stage.live") }}
        </h2>
        <span
          class="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold"
          :class="
            live.cell.kind === 'pre'
              ? 'text-[hsl(var(--tac-amber))]'
              : 'text-foreground'
          "
        >
          <span class="relative inline-flex size-2 shrink-0">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none"
              :class="
                live.cell.kind === 'pre'
                  ? 'bg-[hsl(var(--tac-amber))]'
                  : 'bg-destructive'
              "
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full"
              :class="
                live.cell.kind === 'pre'
                  ? 'bg-[hsl(var(--tac-amber))]'
                  : 'bg-destructive'
              "
            ></span>
          </span>
          <span class="truncate">{{
            [live.cell.status.text, live.cell.status.detail]
              .filter(Boolean)
              .join(" · ")
          }}</span>
        </span>
      </div>

      <div
        class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"
      >
        <div
          v-for="(side, i) in live.cell.teams"
          :key="i"
          class="flex min-w-0 flex-col items-center gap-2 text-center"
          :class="i === 0 ? 'order-1' : 'order-3'"
        >
          <img
            v-if="side.avatar"
            :src="avatarSrc(side.avatar)"
            alt=""
            class="size-11 rounded-md object-cover"
          />
          <span
            v-else
            aria-hidden="true"
            class="inline-grid size-11 place-items-center rounded-md bg-muted text-xs font-extrabold tracking-wide text-foreground/80"
            >{{ side.monogram }}</span
          >
          <span
            class="max-w-full truncate text-sm font-bold"
            :class="{ 'text-muted-foreground': side.emphasis === 'trail' }"
            :title="side.name"
            >{{ side.name }}</span
          >
        </div>
        <div
          class="order-2 flex items-center gap-2 text-3xl font-bold tabular-nums leading-none"
        >
          <template v-if="live.cell.teams[0].score !== null">
            <span
              :class="{
                'text-muted-foreground':
                  live.cell.teams[0].emphasis === 'trail',
              }"
              >{{ live.cell.teams[0].score }}</span
            >
            <span class="text-lg text-muted-foreground">–</span>
            <span
              :class="{
                'text-muted-foreground':
                  live.cell.teams[1].emphasis === 'trail',
              }"
              >{{ live.cell.teams[1].score }}</span
            >
          </template>
          <span v-else class="text-base text-muted-foreground">{{
            $t("pages.play.schedule.vs")
          }}</span>
        </div>
      </div>

      <div class="mt-auto flex items-center justify-between gap-3">
        <span class="min-w-0 truncate text-xs text-muted-foreground">
          {{ contextLabel(live.match) }}
        </span>
        <Button as-child variant="outline" size="sm" class="h-8 gap-1.5">
          <NuxtLink :to="{ name: 'matches-id', params: { id: live.match.id } }">
            <Radio class="size-3.5" />
            {{ $t("pages.watch.stage.watch") }}
          </NuxtLink>
        </Button>
      </div>
    </template>

    <!-- Next up: the soonest scheduled match -->
    <template v-else-if="next">
      <div class="flex items-center justify-between gap-3">
        <h2
          id="team-stage-label"
          :class="[tacticalSectionLabelClasses, '!mb-0 !flex']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("team.pulse.stage.next_up") }}
        </h2>
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ $t("team.pulse.stage.upcoming", { count: upcoming.length }) }}
        </span>
      </div>

      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <b class="block text-lg font-bold leading-tight tabular-nums">{{
            next.when
          }}</b>
          <span
            v-if="next.relative"
            class="text-xs font-semibold text-[hsl(var(--tac-amber))]"
            >{{ next.relative }}</span
          >
        </div>
        <TeamCalendarButton :team-id="team.id" quiet class="shrink-0" />
      </div>

      <div class="flex min-w-0 items-center gap-3">
        <img
          v-if="next.avatar"
          :src="avatarSrc(next.avatar)"
          alt=""
          class="size-10 shrink-0 rounded-md object-cover"
        />
        <span
          v-else
          aria-hidden="true"
          class="inline-grid size-10 shrink-0 place-items-center rounded-md bg-muted text-[0.65rem] font-extrabold tracking-wide text-foreground/80"
          >{{ next.monogram }}</span
        >
        <div class="min-w-0">
          <div class="flex min-w-0 items-baseline gap-1.5">
            <span class="shrink-0 text-xs text-muted-foreground">{{
              $t("pages.play.schedule.vs")
            }}</span>
            <NuxtLink
              v-if="next.teamId"
              :to="{ name: 'teams-id', params: { id: next.teamId } }"
              class="truncate text-base font-bold hover:underline"
              >{{ next.name }}</NuxtLink
            >
            <span v-else class="truncate text-base font-bold">{{
              next.name
            }}</span>
          </div>
          <span class="block truncate text-xs text-muted-foreground">{{
            next.context
          }}</span>
        </div>
      </div>

      <p
        v-if="then"
        class="mt-auto border-t border-border/70 pt-3 text-xs text-muted-foreground [text-wrap:pretty]"
      >
        {{ $t("team.pulse.stage.then") }}
        <b class="font-semibold text-foreground/90">{{ then.when }}</b>
        {{ $t("pages.play.schedule.vs") }}
        <span class="font-semibold text-foreground/90">{{ then.name }}</span>
        <template v-if="then.context"> · {{ then.context }}</template>
      </p>
    </template>

    <!-- Nothing on the calendar -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center"
    >
      <div class="grid max-w-xs gap-1">
        <h2
          id="team-stage-label"
          class="m-0 text-sm font-semibold text-foreground"
        >
          {{ $t("pages.watch.ticker.nothing_upcoming") }}
        </h2>
        <p
          v-if="empty.text"
          class="m-0 text-[13px] text-muted-foreground [text-wrap:pretty]"
        >
          {{ empty.text }}
        </p>
      </div>
      <Button
        v-if="empty.action"
        variant="outline"
        size="sm"
        class="h-8 gap-1.5"
        @click="empty.action.run"
      >
        <Swords class="size-3.5" />
        {{ empty.action.label }}
      </Button>
    </div>
  </section>
</template>
