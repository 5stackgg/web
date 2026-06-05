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
    <TableCell>
      <span class="tabular-nums"><AnimatedStat :value="attempts" /></span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums"><AnimatedStat :value="attemptsPct + '%'" /></span>
      <StatChevron :level="attemptsLevel" class="ml-0.5" />
    </TableCell>
    <TableCell>
      <span class="tabular-nums"><AnimatedStat :value="success" /></span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums"><AnimatedStat :value="successPct + '%'" /></span>
      <StatChevron :level="successLevel" class="ml-0.5" />
    </TableCell>
    <TableCell v-if="duelsVis.traded !== false">
      <span class="tabular-nums"><AnimatedStat :value="traded" /></span>
      <span class="text-muted-foreground"> · </span>
      <span class="tabular-nums"><AnimatedStat :value="tradedPct + '%'" /></span>
      <StatChevron :level="tradedLevel" class="ml-0.5" />
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
          >(<AnimatedStat :value="mostKilled.count" />)</span
        >
      </div>
      <span v-else>—</span>
    </TableCell>
    <TableCell
      v-if="duelsVis.best_weapon !== false"
      class="hidden md:table-cell whitespace-nowrap"
    >
      <span v-if="bestWeapon" class="inline-flex items-center gap-1.5">
        <img
          v-if="bestWeaponMeta && bestWeaponMeta.icon"
          :src="bestWeaponMeta.icon"
          :alt="bestWeaponMeta.label"
          :title="bestWeaponMeta.label"
          class="h-5 w-8 object-contain shrink-0"
          @error="onWeaponIconError"
        />
        <span v-else class="font-medium">{{
          bestWeaponMeta ? bestWeaponMeta.label : bestWeapon.name
        }}</span>
        <span class="text-muted-foreground">
          (<AnimatedStat :value="bestWeapon.count" />)
        </span>
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
          >(<AnimatedStat :value="mostDiedTo.count" />)</span
        >
      </div>
      <span v-else>—</span>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import { statLevelFor, type StatLevel } from "~/utils/statTiers";
import { resolveWeapon } from "~/utilities/weaponIcon";
import { useMatchSide } from "~/composables/useMatchSide";
import { useOpeningDuelsColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

export default {
  components: { LineupMember, PlayerDisplay, AnimatedStat, StatChevron },
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
    // Backend opening-duel record for this player (map + side filtered).
    opening: {
      type: Object as () => {
        attempts: number;
        success: number;
        deaths: number;
        tradedDeaths: number;
      },
      required: true,
    },
    // Lineup's total rounds (map + side filtered) — attempt% denominator.
    lineupRounds: {
      type: Number,
      default: 0,
    },
    // Kill-matchup breakdown for this player (map + side filtered) from the
    // backend kill-pairs view: victims/killers by steam_id, weapons by name.
    killBreakdown: {
      type: Object as () => {
        victims: Record<string, number>;
        killers: Record<string, number>;
        weapons: Record<string, number>;
      },
      required: true,
    },
  },
  computed: {
    totalRounds(): number {
      return this.lineupRounds;
    },
    attempts(): number {
      return this.opening.attempts;
    },
    success(): number {
      return this.opening.success;
    },
    traded(): number {
      return this.opening.tradedDeaths;
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
      if (this.opening.deaths === 0) return 0;
      return Math.round((this.traded / this.opening.deaths) * 100);
    },
    attemptsLevel(): StatLevel | null {
      if (this.totalRounds === 0) return null;
      return statLevelFor(
        { dir: "high", cuts: [30, 20, 12, 6] },
        this.attemptsPct,
      );
    },
    successLevel(): StatLevel | null {
      if (this.attempts === 0) return null;
      return statLevelFor(
        { dir: "high", cuts: [70, 55, 40, 25] },
        this.successPct,
      );
    },
    tradedLevel(): StatLevel | null {
      if (this.opening.deaths === 0) return null;
      return statLevelFor(
        { dir: "high", cuts: [40, 25, 15, 5] },
        this.tradedPct,
      );
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
    bestWeaponMeta() {
      return this.bestWeapon ? resolveWeapon(this.bestWeapon.name) : null;
    },
  },
  methods: {
    onWeaponIconError(event: Event) {
      (event.target as HTMLImageElement).style.display = "none";
    },
  },
};
</script>
