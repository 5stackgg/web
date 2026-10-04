<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, ChevronRight, Swords, UserPlus } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import TeamsEmblem from "~/components/teams/TeamsEmblem.vue";
import { useTeamNeeds } from "~/composables/useTeamNeeds";
import { formatStartTime } from "~/components/watch/watchTicker";
import { teamOpponent, teamResult } from "~/utilities/teamResults";

const props = defineProps<{ team: any; now: Date }>();

const { t, locale } = useI18n();
const { items } = useTeamNeeds(() => props.team, { followInvites: false });

const teamPath = computed(() => `/teams/${props.team.id}`);
const players = computed(() => props.team.roster?.length ?? 0);

const checkIn = computed(
  () => items.value.find((item) => item.kind === "check_in") ?? null,
);
const scrimReplies = computed(
  () =>
    items.value.filter(
      (item) => item.kind === "scrim" || item.kind === "counter",
    ).length,
);
const rosterGap = computed(() =>
  items.value.some((item) => item.kind === "roster"),
);

const LIVE = ["Live"];
const PRE = ["WaitingForCheckIn", "Veto", "WaitingForServer"];

function matchContext(match: any): string | null {
  return (
    match?.tournament_brackets?.[0]?.stage?.tournament?.name ??
    match?.options?.type ??
    null
  );
}

const next = computed(() => {
  // A match in play wins over the calendar, scheduled time or not.
  const match = props.team.live_matches?.[0] ?? props.team.next_matches?.[0];
  if (!match) return null;
  const opponent =
    teamOpponent(match, props.team.id)?.name || t("pages.watch.ticker.tbd");
  let when: string;
  let tone: "live" | "hot" | null = null;
  if (LIVE.includes(match.status)) {
    when = t("pages.teams.your_teams.playing_now");
    tone = "live";
  } else if (PRE.includes(match.status)) {
    when = t("pages.watch.ticker.going_live");
    tone = "hot";
  } else {
    when = match.scheduled_at
      ? formatStartTime(match.scheduled_at, props.now, locale.value)
      : t("match.stream.card.scheduled");
  }
  return { id: match.id, when, tone, opponent, context: matchContext(match) };
});

function score(match: any): string | null {
  const bestOf = match.options?.best_of ?? 1;
  const maps: any[] = match.match_maps ?? [];
  const lineup1 = match.lineup_1?.team_id === props.team.id;
  let ours: number;
  let theirs: number;
  if (bestOf > 1) {
    const won = (id: string) =>
      maps.filter((mm) => mm.winning_lineup_id === id).length;
    ours = won(lineup1 ? match.lineup_1_id : match.lineup_2_id);
    theirs = won(lineup1 ? match.lineup_2_id : match.lineup_1_id);
  } else {
    const map = [...maps]
      .reverse()
      .find((mm) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0);
    if (!map) return null;
    ours = lineup1 ? map.lineup_1_score : map.lineup_2_score;
    theirs = lineup1 ? map.lineup_2_score : map.lineup_1_score;
  }
  return `${ours}–${theirs}`;
}

const last = computed(() => {
  const match = props.team.last_matches?.[0];
  if (!match) return null;
  return {
    id: match.id,
    result: teamResult(match, props.team.id),
    opponent:
      teamOpponent(match, props.team.id)?.name || t("pages.watch.ticker.tbd"),
    score: score(match),
    endedAt: match.ended_at,
  };
});

const pillClasses =
  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] [@media(pointer:fine)]:after:hidden";
const quietPill = `${pillClasses} border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.16)]`;
const urgentPill = `${pillClasses} border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]`;
</script>

<template>
  <article
    class="group relative flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/20 p-4 transition-colors duration-150 has-[a.team-link:focus-visible]:ring-2 has-[a.team-link:focus-visible]:ring-[hsl(var(--tac-amber))] hover:border-foreground/20 hover:bg-muted/30"
  >
    <div class="flex min-w-[14rem] flex-1 flex-col gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <TeamsEmblem :team="team" :size="40" />
        <div class="grid min-w-0 gap-0.5">
          <NuxtLink
            :to="teamPath"
            class="team-link truncate text-base font-bold outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
            >{{ team.name }}</NuxtLink
          >
          <span class="truncate text-[12.5px] text-muted-foreground">
            {{ team.short_name }} ·
            {{ $t("pages.teams.players", players) }}
          </span>
        </div>
        <ChevronRight
          class="ml-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </div>

      <div
        v-if="checkIn || scrimReplies || rosterGap"
        class="flex flex-wrap gap-1.5"
      >
        <NuxtLink
          v-if="checkIn"
          :to="`/matches/${checkIn.kind === 'check_in' ? checkIn.match.id : ''}`"
          :class="urgentPill"
        >
          <CheckCircle2 class="size-3.5" />
          {{ $t("pages.teams.your_teams.check_in") }}
        </NuxtLink>
        <NuxtLink
          v-if="scrimReplies"
          :to="{
            path: teamPath,
            query: { tab: 'scrim', scrimTab: 'requests' },
          }"
          :class="quietPill"
        >
          <Swords class="size-3.5" />
          {{ $t("pages.teams.your_teams.scrim_replies", scrimReplies) }}
        </NuxtLink>
        <NuxtLink v-if="rosterGap" :to="teamPath" :class="quietPill">
          <UserPlus class="size-3.5" />
          {{ $t("pages.teams.your_teams.invite_starter") }}
        </NuxtLink>
      </div>
    </div>

    <dl
      class="m-0 grid min-w-[16rem] flex-[1.3] grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 self-center text-[13px]"
    >
      <dt class="text-xs font-semibold leading-5 text-muted-foreground">
        {{ $t("pages.teams.your_teams.next") }}
      </dt>
      <dd class="m-0 min-w-0 truncate">
        <template v-if="next">
          <span
            class="font-semibold"
            :class="{
              'text-destructive': next.tone === 'live',
              'text-[hsl(var(--tac-amber))]': next.tone === 'hot',
            }"
            >{{ next.when }}</span
          >
          <span class="text-muted-foreground"> {{ $t("common.vs") }} </span>
          {{ next.opponent }}
          <span v-if="next.context" class="text-muted-foreground">
            · {{ next.context }}</span
          >
        </template>
        <span v-else class="text-muted-foreground">{{
          $t("pages.teams.your_teams.nothing_scheduled")
        }}</span>
      </dd>
      <dt class="text-xs font-semibold leading-5 text-muted-foreground">
        {{ $t("pages.teams.your_teams.last") }}
      </dt>
      <dd class="m-0 min-w-0 truncate">
        <template v-if="last">
          <span
            v-if="last.result"
            class="font-semibold"
            :class="{
              'text-success': last.result === 'W',
              'text-destructive': last.result === 'L',
              'text-muted-foreground': last.result === 'T',
            }"
            >{{ $t(`pages.teams.your_teams.result_${last.result}`) }}</span
          >
          <span class="text-muted-foreground"> {{ $t("common.vs") }} </span>
          {{ last.opponent }}
          <span v-if="last.score" class="tabular-nums"> {{ last.score }}</span>
          <span v-if="last.endedAt" class="text-muted-foreground">
            ·
            <TimeAgo :date="last.endedAt" hide-icon />
          </span>
        </template>
        <span v-else class="text-muted-foreground">{{
          $t("pages.teams.your_teams.no_matches")
        }}</span>
      </dd>
    </dl>
  </article>
</template>
