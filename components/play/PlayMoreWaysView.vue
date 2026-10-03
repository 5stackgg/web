<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Shield, Swords } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayWayCard from "~/components/play/PlayWayCard.vue";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import PlayServerTile, {
  type PlayServerTileModel,
} from "~/components/play/PlayServerTile.vue";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";
import {
  formatDay,
  MAX_SERVER_TILES,
  pickServerTiles,
  waysLayout,
} from "~/utilities/playMoreWays";
import { loginLinks } from "~/utilities/loginLinks";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

export type PlayWaysLeague = {
  id: string;
  name: string;
  signupClosesAt: string | null;
  teams: number;
};

export type PlayWaysScrims = {
  teamsToday: number;
  // null for guests: "manages a team" only means something signed in.
  managesTeam: boolean | null;
};

const props = defineProps<{
  guest: boolean;
  // A row selected with tournamentCardFields.
  tournament: any | null;
  league: PlayWaysLeague | null;
  scrims: PlayWaysScrims | null;
  servers: PlayServerTileModel[];
  practiceEnabled: boolean;
}>();

const { locale } = useI18n();

const serverTiles = computed(() => pickServerTiles(props.servers));
const tileCount = computed(
  () =>
    Number(!!props.league) +
    Number(!!props.scrims) +
    serverTiles.value.length +
    Number(props.practiceEnabled),
);
const layout = computed(() => waysLayout(!!props.tournament, tileCount.value));

// Literal class names so Tailwind generates them.
const tileColumnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};
const gridClass = computed(() => {
  const current = layout.value;
  if (current.kind === "wide") return "sm:grid-cols-2 lg:grid-cols-3";
  if (current.kind === "feature") return "lg:grid-cols-2";
  return tileColumnClasses[current.columns];
});
// Outside the feature rail the tiles sit straight in the grid. An odd last
// tile in a two-column rail takes the full row so the rail ends square.
const tilesClass = computed(() => {
  const current = layout.value;
  if (current.kind !== "feature") return "contents";
  return current.railColumns === 1
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
    : "grid gap-3 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2";
});

const playing = computed(() =>
  props.servers.reduce((sum, server) => sum + server.players, 0),
);

const hasAnything = computed(() => !!props.tournament || tileCount.value > 0);

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
const actionClasses = ["h-8", touchTarget];
const secondaryClasses = [
  "h-8 text-muted-foreground hover:text-foreground",
  touchTarget,
];
</script>

<template>
  <section v-if="hasAnything" aria-labelledby="play-more-ways-label">
    <div
      class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
    >
      <h2
        id="play-more-ways-label"
        :class="[tacticalSectionLabelClasses, '!mb-0']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.play.more_ways.title") }}
      </h2>
      <div
        v-if="servers.length > 0"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
      >
        <span>
          <b class="font-semibold tabular-nums text-foreground">{{
            playing
          }}</b>
          {{ $t("pages.play.more_ways.drop_in.playing", playing) }}
        </span>
        <NuxtLink
          v-if="servers.length > MAX_SERVER_TILES"
          to="/public-servers"
          class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          {{
            $t("pages.play.more_ways.drop_in.all_servers", {
              count: servers.length,
            })
          }}
          <ArrowRight class="size-3" />
        </NuxtLink>
      </div>
    </div>

    <div :class="['grid gap-3', gridClass]">
      <WatchTournamentCard
        v-if="tournament"
        :tournament="tournament"
        :stacked="layout.kind === 'feature'"
        :class="{ 'sm:col-span-2': layout.kind === 'wide' }"
      >
        <template #actions>
          <Button as-child size="sm" variant="ghost" :class="secondaryClasses">
            <NuxtLink to="/tournaments">
              {{ $t("pages.play.more_ways.tournaments.all") }}
            </NuxtLink>
          </Button>
        </template>
      </WatchTournamentCard>

      <div v-if="tileCount > 0" :class="tilesClass">
        <PlayWayCard
          v-if="league"
          :icon="Shield"
          :title="$t('pages.play.more_ways.league.title')"
        >
          <p class="m-0 text-[13.5px] text-foreground/90">{{ league.name }}</p>
          <p class="m-0 text-[12.5px] text-muted-foreground">
            <template v-if="league.signupClosesAt">
              {{
                $t("pages.play.more_ways.league.open_until", {
                  date: formatDay(league.signupClosesAt, locale),
                })
              }}
            </template>
            <template v-else>
              {{ $t("pages.play.more_ways.league.open") }}
            </template>
            ·
            <span class="tabular-nums">{{
              $t(
                "pages.play.more_ways.league.teams_in",
                { count: league.teams },
                league.teams,
              )
            }}</span>
          </p>
          <template #actions>
            <Button
              v-if="guest"
              size="sm"
              variant="outline"
              :class="actionClasses"
              @click="signIn"
            >
              {{ $t("pages.play.more_ways.league.sign_in") }}
            </Button>
            <Button
              v-else
              as-child
              size="sm"
              variant="outline"
              :class="actionClasses"
            >
              <NuxtLink
                :to="{
                  name: 'league-seasons-seasonId',
                  params: { seasonId: league.id },
                }"
              >
                {{ $t("pages.play.more_ways.league.register") }}
              </NuxtLink>
            </Button>
          </template>
        </PlayWayCard>

        <PlayWayCard
          v-if="scrims"
          :icon="Swords"
          :title="$t('pages.play.more_ways.scrims.title')"
        >
          <p class="m-0 text-[13.5px] text-foreground/90">
            <template v-if="scrims.teamsToday > 0">
              <b class="font-bold tabular-nums">{{ scrims.teamsToday }}</b>
              {{
                $t("pages.play.more_ways.scrims.teams_today", scrims.teamsToday)
              }}
            </template>
            <template v-else>
              {{ $t("pages.play.more_ways.scrims.none_today") }}
            </template>
          </p>
          <p class="m-0 text-[12.5px] text-muted-foreground">
            {{
              scrims.managesTeam === false
                ? $t("pages.play.more_ways.scrims.needs_team")
                : $t("pages.play.more_ways.scrims.post_hint")
            }}
          </p>
          <template #actions>
            <Button as-child size="sm" variant="outline" :class="actionClasses">
              <NuxtLink to="/scrims">
                {{
                  scrims.teamsToday > 0
                    ? $t("pages.play.more_ways.scrims.find")
                    : $t("pages.play.more_ways.scrims.post")
                }}
              </NuxtLink>
            </Button>
          </template>
        </PlayWayCard>

        <PlayServerTile
          v-for="server in serverTiles"
          :key="server.id"
          :server="server"
        />
        <PlayPracticeTile v-if="practiceEnabled" />
      </div>
    </div>
  </section>
</template>
