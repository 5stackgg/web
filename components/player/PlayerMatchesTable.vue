<script setup lang="ts">
import PlayerMatchRow from "~/components/player/PlayerMatchRow.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import { useMediaQuery } from "@vueuse/core";

defineProps<{
  matches: any[];
  player?: any | null;
  // Forces the stacked 2-line layout (right hub). Mobile auto-collapses too.
  compact?: boolean;
  // match_id -> rank info for external Valve matches (Premier/Competitive/Wingman).
  rankByMatch?: Record<
    string,
    { rankType: number; rank: number; change: number }
  > | null;
  // match_id -> canonical HLTV rating (backend), overrides the row's estimate.
  ratingByMatch?: Map<string, number> | null;
  // match_id -> focus player's aggregate stats, batched by the page so each
  // collapsed row doesn't fire its own matches_by_pk query.
  statsByMatch?: Map<string, any> | null;
}>();

// Below md the dense table can't fit its tracks — fall back to the
// stacked card layout (also what the narrow right-hub always uses).
const isMobile = useMediaQuery("(max-width: 767px)");

// MUST stay in sync with `wideGrid` in PlayerMatchRow.vue.
const wideGrid =
  "grid grid-cols-[2.5rem_5rem_6.75rem_8.5rem_minmax(4.5rem,1fr)_3rem_4rem_4.5rem_2.75rem_3.25rem_6rem_2.5rem] items-center gap-x-2";
</script>

<template>
  <div>
    <Empty v-if="matches.length === 0">
      <slot name="none-found">
        {{ $t("match.options.table.no_matches_found") }}
      </slot>
    </Empty>

    <!-- Compact (right hub / mobile): plain stacked cards, no header. -->
    <div v-else-if="compact || isMobile" class="space-y-1.5">
      <PlayerMatchRow
        v-for="(match, index) of matches"
        :key="match.id"
        :match="match"
        :player="player"
        :rank-by-match="rankByMatch"
        :canonical-rating="ratingByMatch?.get(String(match.id)) ?? null"
        :collapsed-agg="statsByMatch?.get(String(match.id)) ?? null"
        compact
        :style="{ animationDelay: `${index * 40}ms` }"
        class="animate-in fade-in slide-in-from-bottom-2"
      />
    </div>

    <!-- Wide table — header + rows share one min-width inside a horizontal
         scroll guard so every row's MAP (1fr) column resolves identically
         and the columns stay aligned no matter the surrounding width. -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-[56.5rem]">
        <div
          :class="[
            wideGrid,
            'px-3 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground/70',
          ]"
        >
          <span />
          <span>{{ $t("player_match.headers.date") }}</span>
          <span class="text-center">{{ $t("player_match.headers.type") }}</span>
          <span>{{ $t("player_match.headers.result") }}</span>
          <span>{{ $t("player_match.headers.map") }}</span>
          <span />
          <span
            ><StatLabel
              stat="hltv"
              :label="$t('player_match.headers.rating')"
          /></span>
          <span>K / D / A</span>
          <span><StatLabel stat="kd" label="K/D" /></span>
          <span><StatLabel stat="adr" label="ADR" /></span>
          <span class="text-right">{{ $t("player_match.headers.elo") }}</span>
          <span />
        </div>

        <div class="space-y-1.5">
          <PlayerMatchRow
            v-for="(match, index) of matches"
            :key="match.id"
            :match="match"
            :player="player"
            :rank-by-match="rankByMatch"
            :canonical-rating="ratingByMatch?.get(String(match.id)) ?? null"
            :collapsed-agg="statsByMatch?.get(String(match.id)) ?? null"
            :style="{ animationDelay: `${index * 40}ms` }"
            class="animate-in fade-in slide-in-from-bottom-2"
          />
        </div>
      </div>
    </div>
  </div>
</template>
