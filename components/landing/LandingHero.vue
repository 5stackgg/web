<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import ClipTile from "~/components/clips/ClipTile.vue";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import MatchHeader from "~/components/match/MatchHeader.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import { EXAMPLE_CLIP, EXAMPLE_CLIP_VIDEO } from "~/utilities/landing/demoClips";
import { useDemoFaces } from "~/utilities/landing/demoFaces";
import {
  DEMO_STATS_PLAYER,
  demoEloHistory,
} from "~/utilities/landing/demoStats";
import {
  demoMatch,
  demoPicks,
  demoRewindRounds,
  withDecider,
} from "~/utilities/demoMatch";

// Chart.js is the heaviest thing in the hero; it can arrive a beat later.
const PlayerEloChart = defineAsyncComponent(
  () => import("~/components/charts/PlayerEloChart.vue"),
);

const { dress, dressMatch } = useDemoFaces();

const picks = withDecider(demoPicks(8));
const match = dressMatch({
  ...demoMatch({ step: "live", picks, rounds: demoRewindRounds() }),
  is_organizer: false,
});

const player = dress(DEMO_STATS_PLAYER);
// On the hour, so the server and the browser draw the same days.
const history = demoEloHistory(new Date().setMinutes(0, 0, 0));

const eloChange = {
  elo_change: 24,
  current_elo: 6190,
  updated_elo: 6214,
  player_team_elo_avg: 6180,
  opponent_team_elo_avg: 6262,
  expected_score: 0.44,
  actual_score: 1,
  k_factor: 40,
  impact: 1.09,
  performance_multiplier: 1.09,
  series_multiplier: 1,
  map_wins: 1,
  map_losses: 0,
  kills: 27,
  deaths: 14,
  assists: 4,
  kda: 2.21,
  team_avg_kda: 1.32,
  damage: 2156,
  damage_percent: 24,
  type: "competitive",
  match_result: "win",
};
</script>

<template>
  <div class="grid gap-3.5">
    <div
      inert
      class="overflow-hidden rounded-xl border border-border bg-card shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]"
    >
      <MatchHeader :match="match">
        <template #actions><span></span></template>
        <template #veto><span></span></template>
      </MatchHeader>
    </div>
    <div class="grid gap-3.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <ClipTile inert :clip="EXAMPLE_CLIP" :preview="EXAMPLE_CLIP_VIDEO" />
      <div
        class="flex min-h-[200px] flex-col gap-2 rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.22),hsl(var(--muted)/0.06))] p-3.5"
      >
        <PlayerDisplay
          inert
          :player="player"
          :show-elo="false"
          :show-role="false"
          :show-online="false"
          :context-menu="false"
        >
          <template #elo-postfix>
            <PlayerElo :elo="player.elo" />
            <EloChangeBadge :elo-change="eloChange" />
          </template>
        </PlayerDisplay>
        <div class="relative min-h-0 flex-1">
          <PlayerEloChart class="absolute inset-0" :elo-history="history" />
        </div>
      </div>
    </div>
  </div>
</template>
