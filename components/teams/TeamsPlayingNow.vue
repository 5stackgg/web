<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight } from "lucide-vue-next";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import WatchTickerCell from "~/components/watch/WatchTickerCell.vue";
import { sortLiveMatches, tickerCell } from "~/components/watch/watchTicker";
import { useLiveTeamMatches } from "~/composables/useLiveTeamMatches";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{ myTeamIds: string[] }>();

// A busy night can have dozens of team matches; the row stays one row and
// the rest live on /watch.
const CAP = 8;

const { t, locale } = useI18n();
const { matches } = useLiveTeamMatches();

const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;
onBeforeUnmount(() => clock && clearInterval(clock));

// The viewer's own teams first, then tournaments, league fixtures, the rest.
function rank(match: any) {
  const mine =
    match.is_in_lineup ||
    props.myTeamIds.includes(match.lineup_1?.team_id) ||
    props.myTeamIds.includes(match.lineup_2?.team_id);
  if (mine) return 0;
  const tournament = match.tournament_brackets?.[0]?.stage?.tournament;
  if (!tournament) return 3;
  return tournament.is_league ? 2 : 1;
}

const ordered = computed(() =>
  sortLiveMatches(matches.value)
    .map((match, index) => ({ match, index }))
    .sort((a, b) => rank(a.match) - rank(b.match) || a.index - b.index)
    .map(({ match }) => match),
);

const cells = computed(() =>
  ordered.value
    .slice(0, CAP)
    .map((match) =>
      tickerCell(match, { t, locale: locale.value, now: now.value }),
    ),
);
const rest = computed(() => Math.max(0, ordered.value.length - CAP));
// Matches still checking in or in veto show as cells, but only those in
// play count as live.
const liveCount = computed(
  () => ordered.value.filter((match) => match.status === "Live").length,
);

const linkClasses =
  "relative inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <section v-if="ordered.length" aria-labelledby="teams-live-label">
    <div
      class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <div class="flex items-center gap-3">
        <h2
          id="teams-live-label"
          :class="[tacticalSectionLabelClasses, '!mb-0']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.teams.playing_now.title") }}
        </h2>
        <span
          v-if="liveCount"
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span class="relative inline-flex size-2 shrink-0" aria-hidden="true">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full bg-destructive"
            ></span>
          </span>
          {{ $t("pages.teams.playing_now.live_count", { count: liveCount }) }}
        </span>
      </div>
      <NuxtLink to="/watch" :class="linkClasses">
        {{ $t("pages.teams.playing_now.all_live") }}
        <ChevronRight class="size-3.5" />
      </NuxtLink>
    </div>

    <HorizontalScrollRow>
      <div
        v-for="cell in cells"
        :key="cell.id"
        class="flex shrink-0 snap-start"
      >
        <WatchTickerCell :model="cell" />
      </div>
      <div v-if="rest" class="flex shrink-0 snap-start">
        <NuxtLink
          to="/watch"
          class="flex h-[6.875rem] w-44 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border px-3 text-center text-[13px] text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        >
          <span class="text-xl font-bold tabular-nums text-foreground"
            >+{{ rest }}</span
          >
          {{ $t("pages.teams.playing_now.more_on_watch") }}
        </NuxtLink>
      </div>
    </HorizontalScrollRow>
  </section>
</template>
