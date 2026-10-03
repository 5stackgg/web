<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Shield, Swords, Trophy } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayWayCard from "~/components/play/PlayWayCard.vue";
import PlayServerTile, {
  type PlayServerTileModel,
} from "~/components/play/PlayServerTile.vue";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";
import {
  dropInColumns,
  formatDay,
  formatDayAndTime,
  MAX_SERVER_TILES,
  pickServerTiles,
  wayCardColumns,
} from "~/utilities/playMoreWays";
import { loginLinks } from "~/utilities/loginLinks";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

export type PlayWaysTournament = {
  id: string;
  name: string;
  start: string | null;
  location: string | null;
  teams: number;
  maxTeams: number | null;
};

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
  tournament: PlayWaysTournament | null;
  league: PlayWaysLeague | null;
  scrims: PlayWaysScrims | null;
  servers: PlayServerTileModel[];
  practiceEnabled: boolean;
}>();

const { locale } = useI18n();

const cardCount = computed(
  () =>
    Number(!!props.tournament) +
    Number(!!props.league) +
    Number(!!props.scrims),
);
// Literal class names so Tailwind generates them.
const cardColumnClasses: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};
const cardGridClass = computed(
  () => cardColumnClasses[wayCardColumns(cardCount.value)],
);

const serverTiles = computed(() => pickServerTiles(props.servers));
const tileCount = computed(
  () => serverTiles.value.length + Number(props.practiceEnabled),
);
const dropInColumnClasses: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};
const dropInGridClass = computed(
  () => dropInColumnClasses[dropInColumns(tileCount.value)],
);
const playing = computed(() =>
  props.servers.reduce((sum, server) => sum + server.players, 0),
);

const hasAnything = computed(() => cardCount.value > 0 || tileCount.value > 0);

const tournamentLine = computed(() => {
  const tournament = props.tournament;
  if (!tournament) return "";
  const parts: string[] = [];
  if (tournament.start)
    parts.push(formatDayAndTime(tournament.start, locale.value));
  if (tournament.location) parts.push(tournament.location);
  return parts.join(" · ");
});

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
    <h2 id="play-more-ways-label" :class="tacticalSectionLabelClasses">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.play.more_ways.title") }}
    </h2>

    <div v-if="cardCount > 0" :class="['grid gap-3', cardGridClass]">
      <PlayWayCard
        v-if="tournament"
        :icon="Trophy"
        :title="$t('pages.play.more_ways.tournaments.title')"
      >
        <p class="m-0 text-[13.5px] text-foreground/90">
          {{ tournament.name }}
        </p>
        <p class="m-0 text-[12.5px] text-muted-foreground">
          {{ tournamentLine }}
          <template v-if="tournament.maxTeams">
            <template v-if="tournamentLine"> · </template>
            <span class="tabular-nums">{{
              $t("pages.play.more_ways.tournaments.teams_of", {
                count: tournament.teams,
                max: tournament.maxTeams,
              })
            }}</span>
          </template>
        </p>
        <template #actions>
          <Button
            v-if="guest"
            size="sm"
            variant="outline"
            :class="actionClasses"
            @click="signIn"
          >
            {{ $t("pages.play.more_ways.tournaments.sign_in") }}
          </Button>
          <Button
            v-else
            as-child
            size="sm"
            variant="outline"
            :class="actionClasses"
          >
            <NuxtLink :to="`/tournaments/${tournament.id}`">
              {{ $t("pages.play.more_ways.tournaments.register") }}
            </NuxtLink>
          </Button>
          <Button as-child size="sm" variant="ghost" :class="secondaryClasses">
            <NuxtLink to="/tournaments">
              {{ $t("pages.play.more_ways.tournaments.all") }}
            </NuxtLink>
          </Button>
        </template>
      </PlayWayCard>

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
    </div>

    <div v-if="tileCount > 0" :class="{ 'mt-6': cardCount > 0 }">
      <div
        class="mb-2.5 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 class="m-0 text-sm font-bold">
            {{ $t("pages.play.more_ways.drop_in.title") }}
          </h3>
          <span
            v-if="servers.length === 0"
            class="text-[12.5px] text-muted-foreground"
          >
            {{ $t("pages.play.more_ways.drop_in.none") }}
          </span>
          <span v-else class="text-[12.5px] text-muted-foreground">
            <b class="font-semibold tabular-nums text-foreground">{{
              playing
            }}</b>
            {{ $t("pages.play.more_ways.drop_in.playing", playing) }}
          </span>
        </div>
        <NuxtLink
          v-if="servers.length > MAX_SERVER_TILES"
          to="/public-servers"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {{
            $t("pages.play.more_ways.drop_in.all_servers", {
              count: servers.length,
            })
          }}
          <ArrowRight class="size-3" />
        </NuxtLink>
      </div>

      <div :class="['grid gap-3', dropInGridClass]">
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
