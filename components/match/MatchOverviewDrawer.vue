<script setup lang="ts">
import { ExternalLink, Trophy, X } from "lucide-vue-next";
import cleanMapName from "~/utilities/cleanMapName";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "~/components/ui/drawer";
</script>

<template>
  <Drawer :open="open" @update:open="(v) => $emit('update:open', v)">
    <DrawerContent class="max-h-[70vh]">
      <DrawerHeader class="px-4 pt-3 pb-2 text-left">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <DrawerTitle class="truncate text-base">
              {{ match.lineup_1?.name }} vs {{ match.lineup_2?.name }}
            </DrawerTitle>
            <DrawerDescription
              class="mt-0.5 inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[0.62rem] uppercase tracking-[0.16em]"
            >
              <span>{{ match.options.type }}</span>
              <span
                v-if="isTournamentMatch"
                class="inline-flex items-center gap-1 text-[hsl(var(--tac-amber))]"
              >
                <Trophy class="h-3 w-3" />
                {{ tournamentLabel }}
              </span>
              <MatchStatus :match="match" />
            </DrawerDescription>
          </div>
          <div class="inline-flex shrink-0 items-center gap-1.5">
            <NuxtLink
              :to="`/matches/${match.id}`"
              class="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-background hover:text-[hsl(var(--tac-amber))]"
              @click="$emit('update:open', false)"
            >
              <ExternalLink class="h-3 w-3" />
              {{ $t("match.full_page") }}
            </NuxtLink>
            <DrawerClose as-child>
              <button
                type="button"
                :aria-label="$t('common.close')"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground/80 transition-colors hover:border-destructive/60 hover:bg-background hover:text-destructive"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </DrawerClose>
          </div>
        </div>
      </DrawerHeader>

      <div class="overflow-y-auto px-4 pb-4 space-y-4">
        <div class="flex items-center justify-center gap-4">
          <span
            class="truncate text-sm text-muted-foreground"
            :title="match.lineup_1.name"
          >
            {{ match.lineup_1.name }}
          </span>
          <span
            class="text-3xl font-bold tabular-nums"
            :class="getScoreColorClasses(match.lineup_1.id)"
          >
            {{ getTeamScore(match, match.lineup_1.id) }}
          </span>
          <span class="text-xl font-bold text-muted-foreground">–</span>
          <span
            class="text-3xl font-bold tabular-nums"
            :class="getScoreColorClasses(match.lineup_2.id)"
          >
            {{ getTeamScore(match, match.lineup_2.id) }}
          </span>
          <span
            class="truncate text-sm text-muted-foreground"
            :title="match.lineup_2.name"
          >
            {{ match.lineup_2.name }}
          </span>
        </div>

        <div v-if="match.match_maps.length > 0">
          <h4
            class="mb-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Maps
          </h4>
          <div class="grid grid-cols-1 gap-4 items-start lg:grid-cols-3">
            <div class="flex flex-col items-start gap-2">
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ match.lineup_1.name }} {{ $t("match.picks_label") }}
              </div>
              <div class="flex flex-wrap gap-1.5">
                <div
                  v-for="(match_map, index) in getLineupPicks(
                    match.lineup_1.id,
                  )"
                  :key="`drawer-l1-${index}`"
                  class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                  :class="{
                    'opacity-50 grayscale': hasMapStarted(match_map),
                  }"
                >
                  <img
                    :src="match_map.map.patch"
                    :alt="match_map.map.name"
                    class="w-5 h-5"
                    @error="
                      ($event.target as HTMLImageElement).style.display = 'none'
                    "
                  />
                  <span class="text-xs font-medium first-letter:uppercase">{{
                    cleanMapName(match_map.map.name)
                  }}</span>
                  <div class="flex items-center space-x-1 text-xs tabular-nums">
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_1.id),
                      ]"
                      >{{ match_map.lineup_1_score }}</span
                    >
                    <span class="text-muted-foreground">-</span>
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_2.id),
                      ]"
                      >{{ match_map.lineup_2_score }}</span
                    >
                  </div>
                </div>
                <span
                  v-if="getLineupPicks(match.lineup_1.id).length === 0"
                  class="text-xs text-muted-foreground"
                >
                  —
                </span>
              </div>
            </div>

            <div
              class="flex flex-col items-center gap-2 lg:border-x lg:border-border/60 lg:px-4"
            >
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ $t("match.decider") }}
              </div>
              <div class="flex flex-wrap gap-1.5 justify-center">
                <div
                  v-for="(match_map, index) in getDeciderMaps()"
                  :key="`drawer-dec-${index}`"
                  class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                  :class="{
                    'opacity-50 grayscale': hasMapStarted(match_map),
                  }"
                >
                  <img
                    :src="match_map.map.patch"
                    :alt="match_map.map.name"
                    class="w-5 h-5"
                    @error="
                      ($event.target as HTMLImageElement).style.display = 'none'
                    "
                  />
                  <span class="text-xs font-medium first-letter:uppercase">{{
                    cleanMapName(match_map.map.name)
                  }}</span>
                  <div class="flex items-center space-x-1 text-xs tabular-nums">
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_1.id),
                      ]"
                      >{{ match_map.lineup_1_score }}</span
                    >
                    <span class="text-muted-foreground">-</span>
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_2.id),
                      ]"
                      >{{ match_map.lineup_2_score }}</span
                    >
                  </div>
                </div>
                <span
                  v-if="getDeciderMaps().length === 0"
                  class="text-xs text-muted-foreground"
                >
                  —
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-2">
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ match.lineup_2.name }} {{ $t("match.picks_label") }}
              </div>
              <div class="flex flex-wrap gap-1.5 justify-end">
                <div
                  v-for="(match_map, index) in getLineupPicks(
                    match.lineup_2.id,
                  )"
                  :key="`drawer-l2-${index}`"
                  class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                  :class="{
                    'opacity-50 grayscale': hasMapStarted(match_map),
                  }"
                >
                  <img
                    :src="match_map.map.patch"
                    :alt="match_map.map.name"
                    class="w-5 h-5"
                    @error="
                      ($event.target as HTMLImageElement).style.display = 'none'
                    "
                  />
                  <span class="text-xs font-medium first-letter:uppercase">{{
                    cleanMapName(match_map.map.name)
                  }}</span>
                  <div class="flex items-center space-x-1 text-xs tabular-nums">
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_2.id),
                      ]"
                      >{{ match_map.lineup_2_score }}</span
                    >
                    <span class="text-muted-foreground">-</span>
                    <span
                      :class="[
                        'font-semibold',
                        getMapScoreColorClasses(match_map, match.lineup_1.id),
                      ]"
                      >{{ match_map.lineup_1_score }}</span
                    >
                  </div>
                </div>
                <span
                  v-if="getLineupPicks(match.lineup_2.id).length === 0"
                  class="text-xs text-muted-foreground"
                >
                  —
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4
            class="mb-3 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("pages.matches.players") }}
          </h4>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              v-for="lineup of [
                {
                  side: 'lineup_1',
                  players: lineup1Players,
                  override: lineup1AvatarOverride,
                },
                {
                  side: 'lineup_2',
                  players: lineup2Players,
                  override: lineup2AvatarOverride,
                },
              ]"
              :key="lineup.side"
              v-show="displayedMatchStats[lineup.side]"
              class="rounded-lg border border-border bg-muted/40 p-3 sm:p-4"
            >
              <h5 class="mb-3 text-sm font-semibold text-foreground">
                {{
                  $t("match.team_stats_heading", {
                    name: displayedMatchStats[lineup.side]?.name,
                  })
                }}
              </h5>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[360px] text-xs">
                  <thead>
                    <tr class="border-b border-border">
                      <th class="text-left py-2 px-3 font-medium">
                        {{ $t("common.player") }}
                      </th>
                      <th class="text-center py-2 px-2 font-medium w-10">K</th>
                      <th class="text-center py-2 px-2 font-medium w-10">D</th>
                      <th class="text-center py-2 px-2 font-medium w-10">A</th>
                      <th class="text-center py-2 px-2 font-medium w-14">
                        DMG
                      </th>
                      <th class="text-center py-2 px-2 font-medium w-10">
                        K/D
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(lineupPlayer, index) in lineup.players"
                      :key="
                        lineupPlayer.steam_id ||
                        lineupPlayer.placeholder_name ||
                        `drawer-${lineup.side}-${index}`
                      "
                      class="border-b border-border/50 last:border-b-0"
                      :class="{
                        'bg-primary/10 border-l-2 border-l-primary':
                          player &&
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            ?.steam_id === player.steam_id,
                      }"
                    >
                      <td class="py-2 px-3">
                        <PlayerDisplay
                          :player="getLineupPlayerDisplayPlayer(lineupPlayer)"
                          :avatar-override="
                            lineup.override(
                              getLineupPlayerDisplayPlayer(lineupPlayer)
                                ?.steam_id,
                            )
                          "
                          size="sm"
                        />
                      </td>
                      <td class="text-center py-2 px-2 tabular-nums">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .kills_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-2 tabular-nums">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .deaths_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-2 tabular-nums">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .assists_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-2 tabular-nums">
                        {{
                          Math.round(
                            getLineupPlayerDisplayPlayer(lineupPlayer)
                              .damage_dealt_aggregate?.aggregate?.sum?.damage ||
                              0,
                          )
                        }}
                      </td>
                      <td class="text-center py-2 px-2 tabular-nums">
                        {{
                          getKDRatio(
                            getLineupPlayerDisplayPlayer(lineupPlayer)
                              .kills_aggregate?.aggregate?.count || 0,
                            getLineupPlayerDisplayPlayer(lineupPlayer)
                              .deaths_aggregate?.aggregate?.count || 0,
                          )
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div
            v-if="matchStatsLoading"
            class="mt-2 text-center text-xs text-muted-foreground"
          >
            {{ $t("common.loading") }}
          </div>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchLineupStats } from "~/graphql/matchLineupStats";
import { e_match_status_enum } from "~/generated/zeus";

export default {
  props: {
    match: { type: Object, required: true },
    player: { type: Object, required: false, default: null },
    open: { type: Boolean, default: false },
  },
  emits: ["update:open"],
  data() {
    return {
      matchStats: null as any | null,
      matchStatsLoading: false,
    };
  },
  watch: {
    open(isOpen: boolean) {
      if (isOpen && !this.matchStats && !this.matchStatsLoading) {
        this.getMatchStats().catch((err) => {
          console.error("Failed to load match player stats", err);
        });
      }
    },
  },
  computed: {
    isTournamentMatch(): boolean {
      return Boolean(
        this.match?.is_tournament_match ||
          this.match?.tournament_brackets?.length,
      );
    },
    tournamentLabel(): string {
      return (
        this.match?.tournament_brackets?.[0]?.stage?.tournament?.name ||
        this.$t("player_match.tournament")
      );
    },
    displayedMatchStats(): any {
      return (
        this.matchStats || {
          lineup_1: this.match.lineup_1,
          lineup_2: this.match.lineup_2,
        }
      );
    },
    lineup1Players(): any[] {
      return this.displayedMatchStats.lineup_1?.lineup_players ?? [];
    },
    lineup2Players(): any[] {
      return this.displayedMatchStats.lineup_2?.lineup_players ?? [];
    },
    lineup1AvatarOverride() {
      return buildLineupAvatarOverride(this.displayedMatchStats.lineup_1);
    },
    lineup2AvatarOverride() {
      return buildLineupAvatarOverride(this.displayedMatchStats.lineup_2);
    },
    // Focus player's lineup — drives the win/loss score coloring so the
    // player's own result is green/red and the opponent stays neutral.
    playerLineup(): string | null {
      const sid = String((this.player as any)?.steam_id ?? "");
      if (!sid) return null;
      const onL1 = this.match?.lineup_1?.lineup_players?.some(
        (lp: any) => String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
      );
      if (onL1) return this.match.lineup_1_id;
      const onL2 = this.match?.lineup_2?.lineup_players?.some(
        (lp: any) => String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
      );
      if (onL2) return this.match.lineup_2_id;
      return null;
    },
  },
  methods: {
    async getMatchStats() {
      this.matchStatsLoading = true;
      try {
        const {
          data: { matches_by_pk },
        } = await this.$apollo.query({
          variables: { matchId: this.match.id },
          fetchPolicy: "network-only",
          query: generateQuery({
            matches_by_pk: [
              { id: this.match.id },
              {
                lineup_1: [{}, matchLineupStats],
                lineup_2: [{}, matchLineupStats],
              },
            ],
          }),
        });
        this.matchStats = matches_by_pk;
      } finally {
        this.matchStatsLoading = false;
      }
    },
    getLineupPicks(lineupId: string) {
      if (
        !this.match?.match_maps?.length ||
        this.match.match_maps.length === 1
      ) {
        return [];
      }
      return this.match.match_maps.filter((mm: any) => {
        const pick = mm.vetos?.find?.((veto: any) => veto.type === "Pick");
        return pick && pick.match_lineup_id === lineupId;
      });
    },
    getDeciderMaps() {
      if (!this.match?.match_maps?.length) return [];
      if (this.match.match_maps.length === 1) return this.match.match_maps;
      return this.match.match_maps.filter((mm: any) => {
        const hasPick = mm.vetos?.some?.((veto: any) => veto.type === "Pick");
        return !hasPick;
      });
    },
    hasMapStarted(matchMap: any): boolean {
      return matchMap.lineup_1_score === 0 && matchMap.lineup_2_score === 0;
    },
    getLineupPlayerDisplayPlayer(lineupPlayer: any) {
      return (
        lineupPlayer.player || {
          name:
            lineupPlayer.placeholder_name ||
            (lineupPlayer.steam_id
              ? `Player ${lineupPlayer.steam_id}`
              : "Slot"),
          steam_id: lineupPlayer.steam_id,
        }
      );
    },
    getKDRatio(kills: number, deaths: number): string {
      if (deaths === 0) return kills > 0 ? kills.toFixed(1) : "0.0";
      return (kills / deaths).toFixed(2);
    },
    getTeamScore(match: any, lineupId: string): string | number {
      if (
        match.status !== e_match_status_enum.Finished &&
        match.status !== e_match_status_enum.Live
      ) {
        return "";
      }
      return match.match_maps.reduce((total: number, map: any) => {
        return map.winning_lineup_id === lineupId ? total + 1 : total;
      }, 0);
    },
    isMatchLive(): boolean {
      return this.match.status === e_match_status_enum.Live;
    },
    didTeamWin(lineupId: string): boolean {
      return this.match.winning_lineup_id === lineupId;
    },
    getScoreColorClasses(lineupId: string): string {
      if (this.isMatchLive()) return "text-foreground";
      if (this.match.status === e_match_status_enum.Finished) {
        if (this.playerLineup) {
          if (this.playerLineup === lineupId) {
            return this.didTeamWin(lineupId)
              ? "text-green-500"
              : "text-red-500";
          }
          return "text-foreground";
        }
        return this.didTeamWin(lineupId) ? "text-green-500" : "text-red-500";
      }
      return "text-foreground";
    },
    getMapScoreColorClasses(matchMap: any, lineupId: string): string {
      if (this.playerLineup) {
        if (this.playerLineup === lineupId) {
          return matchMap.winning_lineup_id === lineupId
            ? "text-green-500"
            : "text-red-500";
        }
        return "text-foreground";
      }
      if (!matchMap.winning_lineup_id) return "text-foreground";
      return matchMap.winning_lineup_id === lineupId
        ? "text-green-500"
        : "text-red-500";
    },
  },
};
</script>
