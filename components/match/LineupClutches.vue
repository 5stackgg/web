<script lang="ts" setup>
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
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

<script lang="ts">
import ClutchTeamPanel from "~/components/match/ClutchTeamPanel.vue";

type ClutchOutcome = "won" | "lost" | "saved";

type Clutch = {
  outcome: ClutchOutcome;
  round: number;
  match_map_id: string;
  clutcher_steam_id: string;
  against_count: number;
  kills_in_clutch: number;
};

export default {
  components: { ClutchTeamPanel },
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup1: {
      required: true,
      type: Object,
    },
    lineup2: {
      required: true,
      type: Object,
    },
    selectedMapId: {
      type: String as () => string | null,
      default: null,
    },
  },
  computed: {
    filteredMatchMaps() {
      if (!this.selectedMapId) return this.match.match_maps;
      return this.match.match_maps.filter(
        (m: any) => m.id === this.selectedMapId,
      );
    },
    lineup1AvatarOverride() {
      return buildLineupAvatarOverride(this.lineup1);
    },
    lineup2AvatarOverride() {
      return buildLineupAvatarOverride(this.lineup2);
    },
    clutchesByLineup(): Record<string, Clutch[]> {
      const result: Record<string, Clutch[]> = {
        [this.lineup1.id]: [],
        [this.lineup2.id]: [],
      };
      const lineup1Ids = new Set(
        this.lineup1.lineup_players.map((p: any) => String(p.steam_id)),
      );

      for (const match_map of this.filteredMatchMaps) {
        for (const round of match_map.rounds) {
          if (round.round === 0) continue;
          const detected = this.detectClutch(round, match_map.id, lineup1Ids);
          if (detected) {
            const lineupId = lineup1Ids.has(detected.clutcher_steam_id)
              ? this.lineup1.id
              : this.lineup2.id;
            result[lineupId].push(detected);
          }
        }
      }
      return result;
    },
  },
  methods: {
    detectClutch(
      round: any,
      match_map_id: string,
      lineup1Ids: Set<string>,
    ): Clutch | null {
      const alive: [Set<string>, Set<string>] = [
        new Set(
          this.lineup1.lineup_players.map((p: any) => String(p.steam_id)),
        ),
        new Set(
          this.lineup2.lineup_players.map((p: any) => String(p.steam_id)),
        ),
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

        if (
          clutchStarted &&
          clutcherSteamId &&
          killerSteamId === clutcherSteamId
        ) {
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

      if (!clutchStarted || !clutcherSteamId || clutcherTeam === null)
        return null;

      const clutcherLineupSide: "lineup_1" | "lineup_2" = lineup1Ids.has(
        clutcherSteamId,
      )
        ? "lineup_1"
        : "lineup_2";
      const clutcherSide =
        clutcherLineupSide === "lineup_1"
          ? round.lineup_1_side
          : round.lineup_2_side;
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
    },
  },
};
</script>
