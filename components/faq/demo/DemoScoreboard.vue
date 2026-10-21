<script setup lang="ts">
import { computed } from "vue";
import LineupOverview from "~/components/match/LineupOverview.vue";
import { Card, CardContent } from "~/components/ui/card";
import { e_match_status_enum } from "~/generated/zeus";
import { DEMO_LINEUPS } from "~/utilities/demoMatch";
import {
  playersAtStartOf,
  type RewindPlayer,
  type RewindRounds,
} from "~/utilities/rewind";

const props = defineProps<{ data: RewindRounds }>();

const played = computed(() => Math.max(1, props.data.live_round - 1));

function member(player: RewindPlayer, index: number) {
  const rounds = played.value;
  const adr = Math.round((player.kills * 92 + player.deaths * 11) / rounds);
  return {
    steam_id: `7656119000000${player.lineup}${index}`,
    captain: index === 0,
    player: {
      steam_id: `7656119000000${player.lineup}${index}`,
      name: player.name,
      country: null,
      avatar_url: null,
      elo: null,
      match_stats: [
        {
          kills: player.kills,
          deaths: player.deaths,
          assists: Math.round(player.kills / 3),
          damage: adr * rounds,
          hs_kills: Math.round(player.kills * 0.46),
          rounds_played: rounds,
          two_kill_rounds: Math.round(player.kills / 8),
          three_kill_rounds: Math.round(player.kills / 24),
          four_kill_rounds: 0,
          five_kill_rounds: 0,
          team_damage: 0,
          knife_kills: 0,
          zeus_kills: 0,
        },
      ],
      match_map_hltv: [
        {
          kast_pct: 60 + ((player.kills * 7) % 22),
          rounds_played: rounds,
        },
      ],
    },
  };
}

const lineups = computed(() => {
  const players = playersAtStartOf(props.data, props.data.live_round);
  return ([1, 2] as const).map((lineup) => ({
    id: `00000000-0000-0000-0000-00000000000${lineup}`,
    name: DEMO_LINEUPS[lineup].name,
    can_update_lineup: false,
    lineup_players: players
      .filter((player) => player.lineup === lineup)
      .map(member),
  }));
});

const match = computed(() => ({
  id: "00000000-0000-0000-0000-000000000000",
  status: props.data.finished
    ? e_match_status_enum.Finished
    : e_match_status_enum.Live,
  min_players_per_lineup: 5,
  max_players_per_lineup: 5,
  lineup_1: lineups.value[0],
  lineup_2: lineups.value[1],
  match_maps: [],
}));
</script>

<template>
  <Card class="overflow-x-auto overscroll-x-none bg-card/20">
    <CardContent class="p-1 sm:p-2" inert>
      <LineupOverview
        :match="match"
        :lineup="lineups[0]"
        :combine-with="lineups[1]"
      />
    </CardContent>
  </Card>
</template>
