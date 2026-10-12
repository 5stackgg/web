<script setup lang="ts">
import type { ReplayRoundAnalysis } from "~/composables/useReplayAnalysis";
import type { FlashTally } from "~/utilities/replayAnalysis/flashes";

const props = defineProps<{
  analysis: ReplayRoundAnalysis;
  ctHex: string;
  tHex: string;
}>();

const SIDES = ["ct", "t"] as const;
const sideHex = (side: "ct" | "t") =>
  side === "ct" ? props.ctHex : props.tHex;
const traded = (side: "ct" | "t") => {
  const c = props.analysis.trades[side];
  return c.deaths ? `${c.traded}/${c.deaths}` : "–";
};
const blinded = (f: FlashTally) =>
  f.enemies ? `${f.enemies} · ${f.enemySec.toFixed(1)}s` : "0";
</script>

<template>
  <div class="ra">
    <div class="ra-grid">
      <span />
      <span
        v-for="side in SIDES"
        :key="side"
        class="ra-h"
        :style="{ color: sideHex(side) }"
        >{{ side === "ct" ? "CT" : "T" }}</span
      >
      <span class="ra-l">{{ $t("match.replay.analysis.traded_deaths") }}</span>
      <span v-for="side in SIDES" :key="side" class="ra-v">{{
        traded(side)
      }}</span>
      <template v-if="analysis.flashes.blinds">
        <span class="ra-l">{{
          $t("match.replay.analysis.enemies_flashed")
        }}</span>
        <span v-for="side in SIDES" :key="side" class="ra-v">{{
          blinded(analysis.flashes[side])
        }}</span>
        <span class="ra-l">{{ $t("match.replay.analysis.team_flashes") }}</span>
        <span
          v-for="side in SIDES"
          :key="side"
          class="ra-v"
          :class="{ warn: analysis.flashes[side].teammates > 0 }"
          >{{ analysis.flashes[side].teammates }}</span
        >
      </template>
      <span class="ra-l">{{ $t("match.replay.analysis.flash_assists") }}</span>
      <span v-for="side in SIDES" :key="side" class="ra-v">{{
        analysis.flashes[side].assists
      }}</span>
    </div>
    <div
      v-if="analysis.flashes.players.length"
      class="ra-players"
      :class="{ 'ra-players--assists': !analysis.flashes.blinds }"
    >
      <span class="ra-l">{{
        analysis.flashes.blinds
          ? $t("match.replay.analysis.flashes_by_player")
          : $t("match.replay.analysis.flash_assists")
      }}</span>
      <template v-if="analysis.flashes.blinds">
        <span class="ra-ph">{{ $t("match.replay.analysis.col_blinded") }}</span>
        <span class="ra-ph">{{ $t("match.replay.analysis.col_team") }}</span>
      </template>
      <span class="ra-ph">{{ $t("match.replay.analysis.col_assists") }}</span>
      <template v-for="p in analysis.flashes.players" :key="p.sid">
        <span class="ra-name" :title="p.name"
          ><span class="bar" :style="{ background: sideHex(p.side) }" /><span
            class="nm"
            >{{ p.name }}</span
          ></span
        >
        <template v-if="analysis.flashes.blinds">
          <span class="ra-v">{{ blinded(p) }}</span>
          <span class="ra-v" :class="{ warn: p.teammates > 0 }">{{
            p.teammates
          }}</span>
        </template>
        <span class="ra-v">{{ p.assists }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 7px;
  padding: 0 8px 7px;
  border-bottom: 1px solid var(--line, rgba(120, 140, 165, 0.18));
  font-size: 11px;
}
.ra-grid {
  display: grid;
  grid-template-columns: 1fr 58px 58px;
  row-gap: 2px;
  align-items: baseline;
}
.ra-players {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 32px 40px;
  column-gap: 8px;
  row-gap: 2px;
  align-items: baseline;
  padding-top: 6px;
  border-top: 1px solid var(--line, rgba(120, 140, 165, 0.18));
}
.ra-players--assists {
  grid-template-columns: minmax(0, 1fr) 40px;
}
.ra-h {
  font-size: 10px;
  font-weight: 700;
  text-align: right;
}
.ra-l {
  color: #7f8fa0;
  white-space: nowrap;
}
.ra-ph {
  font-size: 10px;
  color: #6b7785;
  text-align: right;
}
.ra-v {
  color: #cfe0f2;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ra-v.warn {
  color: hsl(var(--destructive) / 0.9);
}
.ra-players .ra-l,
.ra-name .nm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ra-name {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #d6e0ea;
}
.ra-name .bar {
  flex-shrink: 0;
  width: 2px;
  height: 10px;
  border-radius: 1px;
}
</style>
