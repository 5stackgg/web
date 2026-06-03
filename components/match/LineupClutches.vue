<script lang="ts" setup>
import { computed } from "vue";
import ClutchTeamPanel from "~/components/match/ClutchTeamPanel.vue";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import { useMatchSide } from "~/composables/useMatchSide";

type ClutchOutcome = "won" | "lost" | "saved";

type Clutch = {
  outcome: ClutchOutcome;
  round: number;
  match_map_id: string;
  clutcher_steam_id: string;
  against_count: number;
  kills_in_clutch: number;
};

const props = defineProps<{
  match: any;
  lineup1: any;
  lineup2: any;
  selectedMapId?: string | null;
}>();

const side = useMatchSide();

const filteredMatchMaps = computed(() => {
  if (!props.selectedMapId) return props.match.match_maps;
  return props.match.match_maps.filter(
    (m: any) => m.id === props.selectedMapId,
  );
});

const lineup1AvatarOverride = computed(() =>
  buildLineupAvatarOverride(props.lineup1),
);
const lineup2AvatarOverride = computed(() =>
  buildLineupAvatarOverride(props.lineup2),
);

function sideMatches(roundSide: string | null | undefined): boolean {
  if (side.value === "all") return true;
  if (side.value === "CT") return roundSide === "CT";
  if (side.value === "T") return roundSide === "TERRORIST" || roundSide === "T";
  return true;
}

const clutchesByLineup = computed<Record<string, Clutch[]>>(() => {
  const result: Record<string, Clutch[]> = {
    [props.lineup1.id]: [],
    [props.lineup2.id]: [],
  };
  const lineup1Ids = new Set(
    props.lineup1.lineup_players.map((p: any) => String(p.steam_id)),
  );

  for (const match_map of filteredMatchMaps.value) {
    for (const round of match_map.rounds) {
      if (round.round === 0) continue;
      const detected = detectClutch(round, match_map.id, lineup1Ids);
      if (detected) {
        const lineupId = lineup1Ids.has(detected.clutcher_steam_id)
          ? props.lineup1.id
          : props.lineup2.id;
        result[lineupId].push(detected);
      }
    }
  }
  return result;
});

// The selected side filters by the side the clutcher was playing that round —
// "CT" keeps only CT clutches, "T" only T-side clutches.
function detectClutch(
  round: any,
  match_map_id: string,
  lineup1Ids: Set<string>,
): Clutch | null {
  const alive: [Set<string>, Set<string>] = [
    new Set(props.lineup1.lineup_players.map((p: any) => String(p.steam_id))),
    new Set(props.lineup2.lineup_players.map((p: any) => String(p.steam_id))),
  ];

  let clutchStarted = false;
  let clutcherTeam: 0 | 1 | null = null;
  let clutcherSteamId: string | null = null;
  let killsInClutch = 0;
  let againstCount = 0;
  let killedAllOpponents = false;

  for (const kill of round.kills) {
    const victimSteamId = String(kill.attacked_player.steam_id);
    const killerSteamId = kill.player?.steam_id
      ? String(kill.player.steam_id)
      : null;

    if (alive[0].has(victimSteamId)) alive[0].delete(victimSteamId);
    else if (alive[1].has(victimSteamId)) alive[1].delete(victimSteamId);

    if (clutchStarted && clutcherSteamId && killerSteamId === clutcherSteamId) {
      killsInClutch++;
    }

    if (
      !clutchStarted &&
      (alive[0].size === 1 || alive[1].size === 1) &&
      alive[0].size > 0 &&
      alive[1].size > 0
    ) {
      clutchStarted = true;
      clutcherTeam = alive[0].size === 1 ? 0 : 1;
      clutcherSteamId = [...alive[clutcherTeam]][0];
      againstCount = alive[1 - clutcherTeam].size;
    }

    if (clutchStarted && clutcherTeam !== null) {
      if (alive[1 - clutcherTeam].size === 0) {
        killedAllOpponents = true;
        break;
      }
      if (alive[clutcherTeam].size === 0) break;
    }
  }

  if (!clutchStarted || !clutcherSteamId || clutcherTeam === null) return null;

  const clutcherLineupSide: "lineup_1" | "lineup_2" = lineup1Ids.has(
    clutcherSteamId,
  )
    ? "lineup_1"
    : "lineup_2";
  const clutcherSide =
    clutcherLineupSide === "lineup_1"
      ? round.lineup_1_side
      : round.lineup_2_side;

  if (!sideMatches(clutcherSide)) return null;

  const clutcherTeamWonRound = round.winning_side === clutcherSide;

  let outcome: ClutchOutcome;
  if (killedAllOpponents) outcome = "won";
  else if (clutcherTeamWonRound) outcome = "saved";
  else outcome = "lost";

  return {
    outcome,
    round: round.round,
    match_map_id,
    clutcher_steam_id: clutcherSteamId,
    against_count: againstCount,
    kills_in_clutch: killsInClutch,
  };
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <ClutchTeamPanel
      :lineup="lineup1"
      :clutches="clutchesByLineup[lineup1.id] || []"
      :avatar-override="lineup1AvatarOverride"
    />
    <ClutchTeamPanel
      :lineup="lineup2"
      :clutches="clutchesByLineup[lineup2.id] || []"
      :avatar-override="lineup2AvatarOverride"
    />
  </div>
</template>
