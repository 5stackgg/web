<template>
  <TableRow :class="['group', rowClass(member)]">
    <TableCell
      :class="[
        'w-[110px] md:w-[220px] sticky left-0 z-10 border-r border-border [transform:translateZ(0)]',
        stickyCellClass(member) ||
          'bg-card group-hover:bg-muted shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]',
      ]"
    >
      <lineup-member :member="member" :lineup_id="lineup.id"></lineup-member>
    </TableCell>
    <TableCell :class="attemptsTierClass">
      <span class="tabular-nums">{{ attempts }}</span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums">{{ attemptsPct }}%</span>
    </TableCell>
    <TableCell :class="successTierClass">
      <span class="tabular-nums">{{ success }}</span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums">{{ successPct }}%</span>
    </TableCell>
    <TableCell v-if="duelsVis.traded !== false" :class="tradedTierClass">
      <span class="tabular-nums">{{ traded }}</span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums">{{ tradedPct }}%</span>
    </TableCell>
    <TableCell
      v-if="duelsVis.most_killed !== false"
      class="hidden md:table-cell whitespace-nowrap"
    >
      <div
        v-if="mostKilled?.member?.player"
        class="inline-flex items-center gap-2"
      >
        <PlayerDisplay
          :player="mostKilled.member.player"
          :show-flag="false"
          :show-role="false"
          :show-online="false"
          size="xs"
          compact
        />
        <span class="text-muted-foreground tabular-nums"
          >({{ mostKilled.count }})</span
        >
      </div>
      <span v-else>—</span>
    </TableCell>
    <TableCell
      v-if="duelsVis.best_weapon !== false"
      class="hidden md:table-cell whitespace-nowrap"
    >
      <span v-if="bestWeapon">
        {{ bestWeapon.name }}
        <span class="text-muted-foreground"> ({{ bestWeapon.count }}) </span>
      </span>
      <span v-else>—</span>
    </TableCell>
    <TableCell
      v-if="duelsVis.most_died_to !== false"
      class="hidden md:table-cell whitespace-nowrap"
    >
      <div
        v-if="mostDiedTo?.member?.player"
        class="inline-flex items-center gap-2"
      >
        <PlayerDisplay
          :player="mostDiedTo.member.player"
          :show-flag="false"
          :show-role="false"
          :show-online="false"
          size="xs"
          compact
        />
        <span class="text-muted-foreground tabular-nums"
          >({{ mostDiedTo.count }})</span
        >
      </div>
      <span v-else>—</span>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { statTierClass } from "~/utils/statTiers";
import { useMatchSide } from "~/composables/useMatchSide";
import { useOpeningDuelsColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

export default {
  components: { LineupMember, PlayerDisplay },
  setup() {
    const { visibility: duelsVis } = useOpeningDuelsColumns();
    const { rowClass, stickyCellClass } = useCurrentUserRow();
    return { side: useMatchSide(), duelsVis, rowClass, stickyCellClass };
  },
  props: {
    match: {
      required: true,
      type: Object,
    },
    member: {
      required: true,
      type: Object,
    },
    lineup: {
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
        (match_map: any) => match_map.id === this.selectedMapId,
      );
    },
    isPlayerOnLineup1() {
      return this.lineup.id === this.match.lineup_1_id;
    },
    roundOnSide() {
      return (round: any) => {
        if (this.side === "all") return true;
        const playerSide = this.isPlayerOnLineup1
          ? round.lineup_1_side
          : round.lineup_2_side;
        if (this.side === "CT") return playerSide === "CT";
        if (this.side === "T")
          return playerSide === "TERRORIST" || playerSide === "T";
        return true;
      };
    },
    totalRounds() {
      let rounds = 0;
      for (const m of this.filteredMatchMaps) {
        for (const round of m.rounds || []) {
          if (round.round === 0) continue;
          if (!this.roundOnSide(round)) continue;
          rounds++;
        }
      }
      return rounds;
    },
    duelStats() {
      let attempts = 0;
      let success = 0;
      let deaths = 0;
      let tradedDeaths = 0;
      const steamId = String(this.member.steam_id);

      for (const match_map of this.filteredMatchMaps) {
        for (const round of match_map.rounds) {
          if (!this.roundOnSide(round)) continue;
          const firstKill = round.kills.find(
            (k: any) =>
              k.player && k.player.steam_id !== k.attacked_player.steam_id,
          );
          if (!firstKill) continue;

          const isKiller = String(firstKill.player?.steam_id) === steamId;
          const isVictim =
            String(firstKill.attacked_player?.steam_id) === steamId;
          if (!isKiller && !isVictim) continue;

          attempts++;
          if (isKiller) success++;
          if (isVictim) {
            deaths++;
            const traderKill = round.kills.find(
              (k: any) =>
                k.player &&
                String(k.attacked_player?.steam_id) ===
                  String(firstKill.player?.steam_id) &&
                String(k.player?.steam_id) !==
                  String(firstKill.attacked_player?.steam_id),
            );
            if (traderKill) tradedDeaths++;
          }
        }
      }
      return { attempts, success, deaths, tradedDeaths };
    },
    attempts(): number {
      return this.duelStats.attempts;
    },
    success(): number {
      return this.duelStats.success;
    },
    traded(): number {
      return this.duelStats.tradedDeaths;
    },
    attemptsPct(): number {
      if (this.totalRounds === 0) return 0;
      return Math.round((this.attempts / this.totalRounds) * 100);
    },
    successPct(): number {
      if (this.attempts === 0) return 0;
      return Math.round((this.success / this.attempts) * 100);
    },
    tradedPct(): number {
      if (this.duelStats.deaths === 0) return 0;
      return Math.round((this.traded / this.duelStats.deaths) * 100);
    },
    attemptsTierClass(): string {
      if (this.totalRounds === 0) return "";
      return statTierClass(
        { dir: "high", cuts: [25, 14, 0] },
        this.attemptsPct,
      );
    },
    successTierClass(): string {
      if (this.attempts === 0) return "";
      return statTierClass({ dir: "high", cuts: [75, 25, 1] }, this.successPct);
    },
    tradedTierClass(): string {
      if (this.duelStats.deaths === 0) return "";
      return statTierClass({ dir: "high", cuts: [30, 1, 0] }, this.tradedPct);
    },
    killBreakdown() {
      const steamId = String(this.member.steam_id);
      const victims: Record<string, number> = {};
      const killers: Record<string, number> = {};
      const weapons: Record<string, number> = {};

      for (const match_map of this.filteredMatchMaps) {
        for (const round of match_map.rounds) {
          if (!this.roundOnSide(round)) continue;
          for (const k of round.kills || []) {
            const attackerId = String(k.player?.steam_id || "");
            const victimId = String(k.attacked_player?.steam_id || "");
            if (attackerId === steamId && victimId && victimId !== steamId) {
              victims[victimId] = (victims[victimId] ?? 0) + 1;
              if (k.with) weapons[k.with] = (weapons[k.with] ?? 0) + 1;
            }
            if (victimId === steamId && attackerId && attackerId !== steamId) {
              killers[attackerId] = (killers[attackerId] ?? 0) + 1;
            }
          }
        }
      }
      return { victims, killers, weapons };
    },
    playersByIds() {
      const map: Record<string, any> = {};
      for (const side of ["lineup_1", "lineup_2"]) {
        const lineup = this.match?.[side];
        if (!lineup?.lineup_players) continue;
        for (const m of lineup.lineup_players) {
          map[String(m.steam_id)] = m;
        }
      }
      return map;
    },
    mostKilled() {
      const entries = Object.entries(this.killBreakdown.victims);
      if (entries.length === 0) return null;
      entries.sort((a, b) => b[1] - a[1]);
      const [id, count] = entries[0];
      return { member: this.playersByIds[id], count };
    },
    mostDiedTo() {
      const entries = Object.entries(this.killBreakdown.killers);
      if (entries.length === 0) return null;
      entries.sort((a, b) => b[1] - a[1]);
      const [id, count] = entries[0];
      return { member: this.playersByIds[id], count };
    },
    bestWeapon() {
      const entries = Object.entries(this.killBreakdown.weapons);
      if (entries.length === 0) return null;
      entries.sort((a, b) => b[1] - a[1]);
      const [name, count] = entries[0];
      return { name, count };
    },
  },
};
</script>
