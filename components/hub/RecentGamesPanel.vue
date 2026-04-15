<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 pt-3 pb-3 flex-shrink-0 border-b border-border">
      <div class="flex items-center justify-between gap-2">
        <div class="hub-panel-label">
          <span class="hub-panel-tick"></span>
          {{ $t("layouts.recent_games.title") }}
        </div>
        <span
          v-if="summaryStats.total > 0"
          class="text-[10px] font-mono tracking-[0.12em] text-muted-foreground tabular-nums"
        >
          {{
            $t("layouts.recent_games.last_matches", {
              count: summaryStats.total,
            })
          }}
        </span>
      </div>

      <div
        v-if="summaryStats.total > 0"
        class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
      >
        <!-- Performance (Record + Win Rate) -->
        <div
          class="rounded-md border border-border bg-card/50 px-3 py-2.5 flex flex-col gap-1.5 h-full"
        >
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("layouts.recent_games.performance") }}
          </span>
          <div class="flex-1 flex items-center">
            <div class="grid grid-cols-2 gap-4 items-end w-full">
              <!-- Record -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-2xl font-semibold text-emerald-400 leading-tight"
                >
                  {{ summaryStats.wins }}-{{ summaryStats.losses }}
                </span>
                <div
                  class="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5"
                >
                  <span>
                    <span class="text-emerald-400 font-medium">
                      {{ summaryStats.wins }}
                    </span>
                    {{ $t("common.stats.wins") }}
                  </span>
                  <span>
                    <span class="text-rose-400 font-medium">
                      {{ summaryStats.losses }}
                    </span>
                    {{ $t("common.stats.losses") }}
                  </span>
                  <span v-if="summaryStats.draws">
                    <span class="text-amber-300 font-medium">
                      {{ summaryStats.draws }}
                    </span>
                    {{ $t("layouts.recent_games.draws_label") }}
                  </span>
                </div>
              </div>

              <!-- Win Rate -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-xs font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {{ $t("common.stats.win_rate") }}
                </span>
                <span class="text-2xl font-semibold text-sky-300 leading-tight">
                  {{ summaryStats.winRate }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Most Played Maps -->
        <div
          class="rounded-md border border-border bg-card/50 px-3 py-2.5 flex flex-col gap-1.5 h-full"
        >
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("layouts.recent_games.most_played_maps") }}
          </span>
          <div
            v-if="summaryStats.mostPlayedMaps.length"
            class="mt-1 flex flex-col gap-1.5"
          >
            <div
              v-for="map in summaryStats.mostPlayedMaps"
              :key="map.name"
              class="relative w-full h-7 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center"
            >
              <div
                class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber)/0.15)]"
                :style="{ width: barWidth(map) }"
              />
              <div
                class="relative z-10 flex items-center justify-between px-2 text-[11px]"
              >
                <span class="first-letter:uppercase truncate mr-2">
                  {{ cleanMapName(map.name) }}
                </span>
                <span class="text-muted-foreground text-[10px]">
                  ×{{ map.count }}
                </span>
              </div>
            </div>
          </div>
          <p v-else class="text-[11px] text-muted-foreground">
            {{ $t("layouts.recent_games.no_maps") }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-3 space-y-2">
        <div
          v-for="i in 5"
          :key="i"
          class="h-14 rounded-lg bg-muted/50 animate-pulse"
        />
      </div>
      <div v-else-if="!matches.length" class="px-4 py-6 h-full flex flex-col">
        <Empty>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">
              {{ $t("layouts.recent_games.no_recent_matches_title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("layouts.recent_games.no_recent_matches_description") }}
            </p>
          </div>
        </Empty>
      </div>
      <div v-else class="p-2">
        <MatchesTable :matches="matches" :player="me" compact />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { eloFields } from "~/graphql/eloFields";

export default {
  data() {
    return {
      matches: [] as any[],
      loading: true,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    summaryStats() {
      const stats = {
        total: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        mostPlayedMaps: [] as { name: string; count: number }[],
      };

      const mySteamId = (this as any).me?.steam_id;
      const matches = (this as any).matches || [];

      if (!mySteamId || !matches.length) {
        return stats;
      }

      const mapCounts: Record<string, number> = {};
      let countedMatches = 0;

      for (const match of matches) {
        if (!match) continue;

        // Determine which lineup the player was on
        const inLineup1 =
          match.lineup_1?.lineup_players?.some?.(
            (lp: any) => lp.player?.steam_id === mySteamId,
          ) ?? false;
        const inLineup2 =
          match.lineup_2?.lineup_players?.some?.(
            (lp: any) => lp.player?.steam_id === mySteamId,
          ) ?? false;

        let playerLineupId: string | null = null;
        if (inLineup1) {
          playerLineupId = match.lineup_1_id;
        } else if (inLineup2) {
          playerLineupId = match.lineup_2_id;
        }

        const winningLineupId = match.winning_lineup_id;

        if (playerLineupId) {
          countedMatches += 1;

          if (!winningLineupId) {
            stats.draws += 1;
          } else if (winningLineupId === playerLineupId) {
            stats.wins += 1;
          } else {
            stats.losses += 1;
          }
        }

        // Collect map counts
        if (Array.isArray(match.match_maps)) {
          for (const mm of match.match_maps) {
            const name = mm?.map?.name;
            if (!name) continue;
            mapCounts[name] = (mapCounts[name] || 0) + 1;
          }
        }
      }

      stats.total = countedMatches;
      if (countedMatches > 0) {
        stats.winRate = Math.round((stats.wins / countedMatches) * 100);
      }

      stats.mostPlayedMaps = Object.entries(mapCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      return stats;
    },
  },
  methods: {
    barWidth(map: { name: string; count: number }) {
      const max = (this as any).summaryStats?.mostPlayedMaps?.[0]?.count || 1;
      const clamped = Math.max(0, Math.min(map.count, max));
      const percentage = (clamped / max) * 100;
      return `${percentage}%`;
    },
  },
  apollo: {
    $subscribe: {
      matches: {
        query: typedGql("subscription")({
          matches: [
            {
              limit: 10,
              where: {
                is_in_lineup: { _eq: true },
                status: { _eq: e_match_status_enum.Finished },
              },
              order_by: [{}, { created_at: order_by.desc }],
            },
            {
              ...simpleMatchFields,
              elo_changes: [
                {
                  where: {
                    player_steam_id: { _eq: $("steamId", "bigint!") },
                  },
                },
                eloFields,
              ],
            },
          ],
        }),
        variables() {
          return { steamId: (this as any).me?.steam_id };
        },
        skip() {
          return !(this as any).me?.steam_id;
        },
        result({ data }: { data: any }) {
          (this as any).matches = data.matches;
          (this as any).loading = false;
        },
      },
    },
  },
};
</script>

<style scoped>
.hub-panel-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Oxanium", monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.hub-panel-tick {
  width: 8px;
  height: 2px;
  background: hsl(var(--tac-amber));
}
</style>
