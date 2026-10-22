<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Shield } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayWayCard from "~/components/play/PlayWayCard.vue";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import PlayServerTile, {
  type PlayServerTileModel,
} from "~/components/play/PlayServerTile.vue";
import PlayScrimsTile, {
  type PlayWaysScrims,
} from "~/components/play/PlayScrimsTile.vue";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";
import { busiestServer, formatDay, playWays } from "~/utilities/playMoreWays";
import { signInWithSteam } from "~/utilities/loginLinks";
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

const props = defineProps<{
  guest: boolean;
  // A row selected with tournamentCardFields.
  tournament: any | null;
  league: PlayWaysLeague | null;
  scrims: PlayWaysScrims | null;
  servers: PlayServerTileModel[];
  practiceEnabled: boolean;
}>();

// One public server shows: the busiest. The rest are a link away.
const server = computed(() => busiestServer(props.servers));
const ways = computed(() =>
  playWays({
    serverPlayers: server.value?.players ?? null,
    scrimsToday: props.scrims?.teamsToday ?? null,
    practice: props.practiceEnabled,
  }),
);

const hasAnything = computed(
  () => !!props.tournament || !!props.league || !!ways.value.featured,
);

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
const actionClasses = ["h-8", touchTarget];
const secondaryClasses = [
  "h-8 text-muted-foreground hover:text-foreground",
  touchTarget,
];
</script>

<template>
  <section
    v-if="hasAnything"
    class="play-ways"
    aria-labelledby="play-more-ways-label"
  >
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
      <NuxtLink
        v-if="servers.length > 1"
        to="/public-servers"
        class="relative inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] [@media(pointer:fine)]:after:hidden"
      >
        {{
          $t("pages.play.more_ways.drop_in.all_servers", {
            count: servers.length,
          })
        }}
        <ArrowRight class="size-3" />
      </NuxtLink>
    </div>

    <!-- The liveliest way is the big card; the others share one panel
         beside it (under it on phones), each previewing what's inside. -->
    <div
      v-if="ways.featured"
      class="ways-row"
      :class="{ 'ways-row-split': ways.others.length }"
    >
      <PlayServerTile v-if="ways.featured === 'server'" :server="server!" />
      <PlayScrimsTile
        v-else-if="ways.featured === 'scrims'"
        :scrims="scrims!"
      />
      <PlayPracticeTile v-else />

      <div
        v-if="ways.others.length"
        class="flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-border bg-muted/20 [&>*+*]:border-t [&>*+*]:border-border"
      >
        <template v-for="way in ways.others" :key="way">
          <PlayServerTile
            v-if="way === 'server'"
            :server="server!"
            layout="peek"
          />
          <PlayScrimsTile
            v-else-if="way === 'scrims'"
            :scrims="scrims!"
            layout="peek"
          />
          <PlayPracticeTile v-else layout="peek" />
        </template>
      </div>
    </div>

    <div
      v-if="tournament || league"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      :class="{ 'mt-3': ways.featured }"
    >
      <WatchTournamentCard
        v-if="tournament"
        :tournament="tournament"
        class="sm:col-span-2"
      >
        <template #actions>
          <Button as-child size="sm" variant="ghost" :class="secondaryClasses">
            <NuxtLink to="/tournaments">
              {{ $t("pages.play.more_ways.tournaments.all") }}
            </NuxtLink>
          </Button>
        </template>
      </WatchTournamentCard>

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
                date: formatDay(league.signupClosesAt),
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
            @click="signInWithSteam"
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
    </div>
  </section>
</template>

<style scoped>
.play-ways {
  container: ways / inline-size;
}
.ways-row {
  display: grid;
  gap: 10px;
}
@container ways (min-width: 720px) {
  .ways-row-split {
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 20px;
  }
}
</style>
