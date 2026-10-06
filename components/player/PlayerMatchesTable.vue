<script setup lang="ts">
import PlayerMatchRow from "~/components/player/PlayerMatchRow.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import { useMediaQuery } from "@vueuse/core";
import { RotateCcw } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { dateLocale } from "~/utilities/dateLocale";
import {
  withSeasonBreaks,
  type Season,
  type SeasonRecap,
  type SeasonRow,
} from "~/utilities/seasonPace";

const props = defineProps<{
  matches: any[];
  player?: any | null;
  // Forces the stacked 2-line layout (right hub). Mobile auto-collapses too.
  compact?: boolean;
  // match_id -> rank info for external Valve matches (Premier/Competitive/Wingman).
  rankByMatch?: Record<
    string,
    { rankType: number; rank: number; change: number }
  > | null;
  // match_id -> FACEIT ELO / level / change for imported FACEIT matches.
  faceitByMatch?: Record<
    string,
    { elo: number; level: number | null; change: number }
  > | null;
  // match_id -> canonical HLTV rating (backend), overrides the row's estimate.
  ratingByMatch?: Map<string, number> | null;
  // match_id -> focus player's aggregate stats, batched by the page so each
  // collapsed row doesn't fire its own matches_by_pk query.
  statsByMatch?: Map<string, any> | null;
  // Season ranges for the reset dividers; empty when seasons are off.
  seasons?: Season[];
  // season id -> how that season went, for the break between seasons.
  seasonRecaps?: Record<string, SeasonRecap>;
  // match id -> season label for the match that set that season's best.
  seasonBest?: Record<string, string>;
  // Team mode: rows read from this team's lineup, and the RANK column lists
  // who played instead.
  teamId?: string | null;
  // Neutral mode (event, tournament lists): rows show both lineups, and the
  // stats maps carry each match's top player, named in the last column.
  neutral?: boolean;
  topPlayerByMatch?: Map<string, any> | null;
}>();

const { t } = useI18n();

const rows = computed(() =>
  withSeasonBreaks(
    props.matches,
    props.seasons ?? [],
    (match: any) => match.ended_at ?? match.created_at,
  ),
);

function seasonDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function breakTitle(row: Extract<SeasonRow<any>, { kind: "season" }>) {
  if (row.began) {
    return t("player_match.season_break.began", {
      number: row.began.number,
      date: seasonDate(row.began.starts_at),
    });
  }
  return t("player_match.season_break.ended", {
    number: row.ended?.number,
    date: row.ended?.ends_at ? seasonDate(row.ended.ends_at) : "",
  });
}

function breakNote(row: Extract<SeasonRow<any>, { kind: "season" }>) {
  const recap = row.ended ? props.seasonRecaps?.[row.ended.id] : null;
  const summary = recap
    ? t("player_match.season_break.recap", {
        number: row.ended?.number,
        final: recap.final.toLocaleString(),
        peak: recap.peak.toLocaleString(),
        wins: recap.wins,
        losses: recap.losses,
      })
    : "";
  if (!row.began) return summary;
  const reset = t("player_match.season_break.reset");
  return summary ? `${reset} · ${summary}` : reset;
}

function breakRatings(row: Extract<SeasonRow<any>, { kind: "season" }>) {
  const final = row.ended ? props.seasonRecaps?.[row.ended.id]?.final : null;
  const start = row.began ? props.seasonRecaps?.[row.began.id]?.start : null;
  if (final == null || start == null) return "";
  return `${final.toLocaleString()} → ${start.toLocaleString()}`;
}

// Below md the dense table can't fit its tracks — fall back to the
// stacked card layout (also what the narrow right-hub always uses).
const isMobile = useMediaQuery("(max-width: 767px)");

// MUST stay in sync with `wideGrid` in PlayerMatchRow.vue.
const wideGrid =
  "grid grid-cols-[2.5rem_5rem_6.75rem_8.5rem_minmax(4.5rem,1fr)_3rem_6rem_4.5rem_2.75rem_3.25rem_10rem_2.5rem] items-center gap-x-2";
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
      <template v-for="(row, index) of rows">
        <div
          v-if="row.kind === 'season'"
          :key="row.key"
          class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 py-2 text-xs"
        >
          <RotateCcw
            class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <span class="font-semibold text-foreground">{{
            breakTitle(row)
          }}</span>
          <span
            v-if="breakRatings(row)"
            class="ml-auto font-mono text-[0.65rem] tabular-nums text-[hsl(var(--tac-amber))]"
            >{{ breakRatings(row) }}</span
          >
          <span v-if="breakNote(row)" class="w-full text-muted-foreground">{{
            breakNote(row)
          }}</span>
        </div>
        <PlayerMatchRow
          v-else
          :key="row.match.id"
          :match="row.match"
          :player="player"
          :rank-by-match="rankByMatch"
          :faceit-by-match="faceitByMatch"
          :season-best="seasonBest?.[String(row.match.id)] ?? null"
          :canonical-rating="ratingByMatch?.get(String(row.match.id)) ?? null"
          :collapsed-agg="statsByMatch?.get(String(row.match.id)) ?? null"
          :team-id="teamId ?? null"
          :neutral="neutral"
          :top-player="topPlayerByMatch?.get(String(row.match.id)) ?? null"
          compact
          :style="{ animationDelay: `${index * 40}ms` }"
          class="animate-in fade-in slide-in-from-bottom-2"
        />
      </template>
    </div>

    <!-- Wide table — header + rows share one min-width inside a horizontal
         scroll guard so every row's MAP (1fr) column resolves identically
         and the columns stay aligned no matter the surrounding width. -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-[62.5rem]">
        <div
          :class="[
            wideGrid,
            'px-3 pb-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground/70',
          ]"
        >
          <span />
          <span>{{ $t("player_match.headers.date") }}</span>
          <span>{{ $t("player_match.headers.type") }}</span>
          <span>{{ $t("player_match.headers.result") }}</span>
          <span>{{ $t("player_match.headers.map") }}</span>
          <span />
          <span class="text-center"
            ><StatLabel
              stat="hltv"
              header
              :label="$t('player_match.headers.rating')"
          /></span>
          <span>K / D / A</span>
          <span><StatLabel stat="kd" header label="K/D" /></span>
          <span><StatLabel stat="adr" header label="ADR" /></span>
          <span class="text-right">{{
            neutral
              ? $t("awards.mvp")
              : teamId
                ? $t("team.hero.roster")
                : $t("player_match.headers.rank")
          }}</span>
          <span />
        </div>

        <div class="space-y-1.5">
          <template v-for="(row, index) of rows">
            <div
              v-if="row.kind === 'season'"
              :key="row.key"
              :class="[wideGrid, 'px-3 py-2.5']"
            >
              <div
                class="col-span-10 flex min-w-0 items-center gap-2.5 text-xs"
              >
                <RotateCcw
                  class="ml-3 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                />
                <span class="shrink-0 font-semibold text-foreground">{{
                  breakTitle(row)
                }}</span>
                <span
                  v-if="breakNote(row)"
                  class="truncate text-muted-foreground"
                  >{{ breakNote(row) }}</span
                >
                <span
                  class="h-px min-w-6 flex-1 bg-[hsl(var(--tac-amber)/0.35)]"
                />
              </div>
              <span
                class="text-right font-mono text-[0.65rem] tabular-nums text-[hsl(var(--tac-amber))]"
                >{{ breakRatings(row) }}</span
              >
              <span />
            </div>
            <PlayerMatchRow
              v-else
              :key="row.match.id"
              :match="row.match"
              :player="player"
              :rank-by-match="rankByMatch"
              :faceit-by-match="faceitByMatch"
              :season-best="seasonBest?.[String(row.match.id)] ?? null"
              :canonical-rating="
                ratingByMatch?.get(String(row.match.id)) ?? null
              "
              :collapsed-agg="statsByMatch?.get(String(row.match.id)) ?? null"
              :team-id="teamId ?? null"
              :neutral="neutral"
              :top-player="topPlayerByMatch?.get(String(row.match.id)) ?? null"
              :style="{ animationDelay: `${index * 40}ms` }"
              class="animate-in fade-in slide-in-from-bottom-2"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
