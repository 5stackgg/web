<script setup lang="ts">
import {
  ChevronsDownIcon,
  GitBranch,
  Trophy,
  UserPlusIcon,
  UsersIcon,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { eloFields } from "~/graphql/eloFields";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
</script>

<template>
  <div
    v-if="
      alwaysShow || !compact || match.status === e_match_status_enum.Finished
    "
    class="bg-muted/30 border border-border rounded-lg hover:shadow-lg hover:shadow-primary/10 hover:bg-muted/20 hover:border-primary/30 transition-all duration-300 cursor-pointer group overflow-hidden"
    @click="navigateToMatch(match.id, $event)"
  >
    <div
      :class="[
        'flex flex-col gap-3',
        // Tighter padding to keep content from overflowing; in compact mode keep padding small on all breakpoints
        compact ? 'p-2' : 'p-2 sm:p-3 md:p-4',
      ]"
    >
      <!-- Mobile Header: Tags at opposite ends -->
      <div class="flex sm:hidden items-start justify-between gap-2">
        <!-- Left: Type + ELO -->
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span :class="matchTypePillClasses">
            {{ match.options.type }}
          </span>

          <span v-if="isTournamentMatch" :class="tournamentPillClasses">
            <Trophy class="h-3 w-3 shrink-0" />
            <span class="max-w-24 truncate">{{ tournamentLabel }}</span>
          </span>

          <!-- Elo Change Display -->
          <EloChangeBadge :elo-change="eloChange" size="xs" />
        </div>

        <!-- Right: Status + Time -->
        <div
          class="flex shrink-0 items-center space-x-2 text-[10px] text-muted-foreground"
        >
          <MatchStatus v-if="!compact" :match="match" />
          <TimeAgo
            :date="match.started_at || match.scheduled_at || match.created_at"
          ></TimeAgo>
        </div>
      </div>

      <!-- Desktop Header -->
      <div
        class="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      >
        <div class="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1">
          <span :class="matchTypePillClasses">
            {{ match.options.type }}
          </span>

          <span
            v-if="isTournamentMatch"
            :class="tournamentPillClasses"
            :title="tournamentName"
          >
            <Trophy class="h-3 w-3 shrink-0" />
            <span class="max-w-[16rem] truncate">{{ tournamentLabel }}</span>
          </span>

          <span
            v-if="!compact && isTournamentMatch && tournamentRoundLabel"
            :class="roundPillClasses"
          >
            <GitBranch class="h-3 w-3 shrink-0" />
            {{ tournamentRoundLabel }}
          </span>

          <!-- Elo Change Display -->
          <EloChangeBadge :elo-change="eloChange" />
        </div>
        <div class="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1">
          <!-- Join Button - Prominent Position -->
          <button
            v-if="canJoinMatch"
            type="button"
            class="group/join relative inline-flex items-center isolate px-[0.7rem] py-[0.28rem] font-sans text-[0.68rem] font-bold tracking-[0.16em] uppercase text-[hsl(0_0%_8%)] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] border border-[hsl(var(--tac-amber))] [clip-path:polygon(8px_0,100%_0,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,0_100%,0_8px)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35),0_4px_14px_-4px_hsl(var(--tac-amber)/0.5)] [transition:transform_180ms_cubic-bezier(0.4,0,0.2,1),box-shadow_180ms_ease] cursor-pointer overflow-hidden whitespace-nowrap hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.55),0_10px_24px_-4px_hsl(var(--tac-amber)/0.7),0_0_20px_hsl(var(--tac-amber)/0.3)] active:translate-y-0"
            @click.stop="navigateToMatch(match.id, $event)"
          >
            <span class="relative z-[1] inline-flex items-center gap-[0.45rem]">
              <UserPlusIcon class="h-3 w-3" />
              <span>{{ $t("match.options.table.join") }}</span>
            </span>
            <span
              class="absolute inset-0 [background:linear-gradient(90deg,transparent_0%,hsl(0_0%_100%/0.35)_50%,transparent_100%)] -translate-x-full [transition:transform_600ms_cubic-bezier(0.4,0,0.2,1)] pointer-events-none z-0 group-hover/join:translate-x-full"
              aria-hidden="true"
            ></span>
          </button>

          <!-- moved player toggle below maps -->
          <div
            class="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground"
          >
            <StreamEmbed
              :streams="match.streams"
              :show-title="false"
              :set-global-stream-only="true"
              v-if="match.streams?.length > 0"
            />

            <MatchStatus v-if="!compact" :match="match" />

            <TimeAgo
              :date="match.started_at || match.scheduled_at || match.created_at"
            ></TimeAgo>
            <template v-if="!compact && match.ended_at">
              <span class="hidden sm:inline">•</span>
              <span class="hidden sm:inline"
                >Duration: {{ getMatchDuration(match) }}</span
              >
            </template>
          </div>
        </div>
      </div>

      <!-- Teams + score: vertical layout in compact mode, responsive split layout otherwise -->
      <!-- Compact: Teams stacked vertically (all breakpoints) -->
      <div v-if="compact" class="flex flex-col items-center gap-2">
        <!-- Team 1 -->
        <div class="flex items-center space-x-2">
          <h3 class="font-semibold text-foreground text-sm">
            <span
              :class="{
                'border-b border-primary/40':
                  playerLineup === match.lineup_1_id,
              }"
            >
              {{ match.lineup_1.name }}
            </span>
          </h3>
        </div>

        <!-- Score -->
        <div class="text-2xl font-bold">
          <span :class="getScoreColorClasses(match.lineup_1.id)">{{
            getTeamScore(match, match.lineup_1.id)
          }}</span>
          <span class="mx-2 text-muted-foreground">-</span>
          <span :class="getScoreColorClasses(match.lineup_2.id)">{{
            getTeamScore(match, match.lineup_2.id)
          }}</span>
        </div>

        <!-- Team 2 -->
        <div class="flex items-center space-x-2">
          <h3 class="font-semibold text-foreground text-sm">
            <span
              :class="{
                'border-b border-primary/40':
                  playerLineup === match.lineup_2_id,
              }"
            >
              {{ match.lineup_2.name }}
            </span>
          </h3>
        </div>
      </div>

      <!-- Full (non-compact): Desktop 3-column grid, mobile version above -->
      <div
        v-else
        class="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6 items-center"
      >
        <!-- Team 1 -->
        <div class="flex items-center space-x-2 lg:space-x-3">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-foreground truncate">
              <span
                :class="{
                  'border-b border-primary/40':
                    playerLineup === match.lineup_1_id,
                }"
              >
                {{ match.lineup_1.name }}
              </span>
            </h3>
            <div
              v-if="match.status === e_match_status_enum.PickingPlayers"
              class="flex items-center space-x-2 mt-1"
            >
              <UsersIcon class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">
                {{ match.lineup_counts.lineup_1_count }}/{{
                  match.max_players_per_lineup
                }}
                players
              </span>
            </div>
          </div>
        </div>

        <!-- Center score -->
        <div
          class="flex items-center justify-center order-first lg:order-none py-2 lg:py-0"
        >
          <div class="text-2xl md:text-3xl font-bold">
            <span :class="getScoreColorClasses(match.lineup_1.id)">{{
              getTeamScore(match, match.lineup_1.id)
            }}</span>
            <span class="mx-2 text-muted-foreground">-</span>
            <span :class="getScoreColorClasses(match.lineup_2.id)">{{
              getTeamScore(match, match.lineup_2.id)
            }}</span>
          </div>
        </div>

        <!-- Team 2 -->
        <div class="flex items-center space-x-3 justify-end">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-foreground truncate text-right">
              <span
                :class="{
                  'border-b border-primary/40':
                    playerLineup === match.lineup_2_id,
                }"
              >
                {{ match.lineup_2.name }}
              </span>
            </h3>
            <div
              v-if="match.status === e_match_status_enum.PickingPlayers"
              class="flex items-center space-x-2 mt-1 justify-end"
            >
              <UsersIcon class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">
                {{ match.lineup_counts.lineup_2_count }}/{{
                  match.max_players_per_lineup
                }}
                players
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Maps Section: lineup1 picks | deciders | lineup2 picks -->
      <div
        class="border-t border-border py-2"
        v-if="match.match_maps.length > 0"
      >
        <div
          :class="[
            'grid grid-cols-1 gap-4 items-start',
            // In non-compact mode, restore 3-column desktop layout
            !compact && 'lg:grid-cols-3',
          ]"
        >
          <!-- Lineup 1 Picks -->
          <div
            v-if="!compact || getLineupPicks(match.lineup_1.id).length"
            class="flex flex-col items-start justify-start gap-2"
          >
            <div
              class="text-xs uppercase tracking-wide text-muted-foreground"
              :class="compact ? '' : 'hidden lg:block'"
            >
              Picks
            </div>
            <div class="flex flex-wrap gap-1.5">
              <div
                v-for="(match_map, index) in getLineupPicks(match.lineup_1.id)"
                :key="`l1-${index}`"
                class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
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
                <div class="flex items-center space-x-1 text-xs">
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
            </div>
          </div>

          <!-- Deciders (middle) -->
          <div
            v-if="!compact || getDeciderMaps().length"
            class="flex items-center justify-center lg:border-x lg:border-border/60 lg:px-4"
          >
            <div class="flex flex-col items-center gap-2 w-full">
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Decider
              </div>
              <div class="flex flex-wrap gap-1.5 justify-center">
                <div
                  v-for="(match_map, index) in getDeciderMaps()"
                  :key="`dec-${index}`"
                  class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                  :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
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
                  <div class="flex items-center space-x-1 text-xs">
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
              </div>
            </div>
          </div>

          <!-- Lineup 2 Picks -->
          <div
            v-if="!compact || getLineupPicks(match.lineup_2.id).length"
            class="flex flex-col items-end justify-start gap-2"
          >
            <div
              class="text-xs uppercase tracking-wide text-muted-foreground"
              :class="compact ? '' : 'hidden lg:block'"
            >
              Picks
            </div>
            <div class="flex flex-wrap gap-1.5 justify-end">
              <div
                v-for="(match_map, index) in getLineupPicks(match.lineup_2.id)"
                :key="`l2-${index}`"
                class="flex items-center space-x-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
                :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
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
                <div class="flex items-center space-x-1 text-xs">
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
            </div>
          </div>
        </div>
      </div>

      <!-- Players Section (tables only) now below maps -->
      <div
        :class="[
          'grid grid-cols-1 items-stretch overflow-hidden transition-all duration-300 ease-out',
          // In compact mode, always stack teams vertically; otherwise use 2 columns on large screens
          !compact && 'lg:grid-cols-2',
          showPlayers
            ? 'gap-6 border-t border-border pt-4 opacity-100 translate-y-0 max-h-[2000px]'
            : 'gap-0 border-0 pt-0 opacity-0 -translate-y-1 max-h-0',
        ]"
      >
        <!-- Team 1 players -->
        <div class="space-y-2">
          <div
            v-if="displayedMatchStats.lineup_1"
            :class="[
              'bg-muted/50 rounded-lg border border-border min-h-[200px] h-full flex flex-col',
              // Reduce padding overall; in compact mode keep it tight on all sizes
              compact ? 'p-2' : 'p-3 sm:p-4',
            ]"
          >
            <h5 class="text-sm font-semibold text-foreground mb-3">
              {{
                $t("match.team_stats_heading", {
                  name: displayedMatchStats.lineup_1.name,
                })
              }}
            </h5>
            <div class="overflow-x-auto flex-1 -mx-4 px-4">
              <table
                class="w-full text-xs min-w-[320px] sm:min-w-[360px] h-full"
              >
                <thead>
                  <tr class="border-b border-border">
                    <th
                      class="text-left py-1.5 px-2 sm:py-2 sm:px-3 font-medium"
                    >
                      Player
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      K
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      D
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      A
                    </th>
                    <th
                      v-if="!compact"
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-12 sm:w-14"
                    >
                      DMG
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      K/D
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="(lineupPlayer, index) in lineup1Players"
                    :key="
                      lineupPlayer.steam_id ||
                      lineupPlayer.placeholder_name ||
                      `lineup-1-${index}`
                    "
                  >
                    <tr
                      class="border-b border-border/50 last:border-b-0"
                      :class="{
                        'bg-primary/10 border-l-2 border-l-primary':
                          player &&
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            ?.steam_id === player.steam_id,
                      }"
                    >
                      <td class="py-2 px-2 sm:py-3 sm:px-3">
                        <PlayerDisplay
                          :player="getLineupPlayerDisplayPlayer(lineupPlayer)"
                          :size="compact ? 'xs' : 'sm'"
                          :compact="compact"
                        />
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .kills_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .deaths_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .assists_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td
                        v-if="!compact"
                        class="text-center py-2 px-1 sm:py-3 sm:px-2"
                      >
                        {{
                          Math.round(
                            getLineupPlayerDisplayPlayer(lineupPlayer)
                              .damage_dealt_aggregate
                              ?.aggregate?.sum?.damage || 0,
                          )
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
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
                  </template>
                  <!-- Empty rows to maintain consistent height (only while picking players) -->
                  <template
                    v-if="match.status === e_match_status_enum.PickingPlayers"
                    v-for="i in Math.max(
                      0,
                      maxPlayersPerLineup - lineup1Players.length,
                    )"
                    :key="`empty-${i}`"
                  >
                    <tr class="border-b border-border/50 last:border-b-0">
                      <td class="py-2 px-2 sm:py-3 sm:px-3">
                        <PlayerDisplay
                          :show-flag="false"
                          :show-role="false"
                          :show-elo="false"
                          :linkable="false"
                          :size="compact ? 'xs' : 'sm'"
                          :compact="compact"
                          :player="{
                            name: `Slot ${lineup1Players.length + i}`,
                          }"
                        />
                      </td>
                      <td
                        v-if="!compact"
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Team 2 players -->
        <div class="space-y-2">
          <div
            v-if="displayedMatchStats.lineup_2"
            :class="[
              'bg-muted/50 rounded-lg border border-border min-h-[150px] sm:min-h-[200px] h-full flex flex-col',
              compact ? 'p-2' : 'p-3 sm:p-4',
            ]"
          >
            <h5
              class="text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3"
            >
              {{
                $t("match.team_stats_heading", {
                  name: displayedMatchStats.lineup_2.name,
                })
              }}
            </h5>
            <div class="overflow-x-auto flex-1 -mx-2 sm:-mx-4 px-2 sm:px-4">
              <table
                class="w-full text-xs min-w-[320px] sm:min-w-[360px] h-full"
              >
                <thead>
                  <tr class="border-b border-border">
                    <th
                      class="text-left py-1.5 px-2 sm:py-2 sm:px-3 font-medium"
                    >
                      Player
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      K
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      D
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      A
                    </th>
                    <th
                      v-if="!compact"
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-12 sm:w-14"
                    >
                      DMG
                    </th>
                    <th
                      class="text-center py-1.5 px-1 sm:py-2 sm:px-2 font-medium w-8 sm:w-10"
                    >
                      K/D
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="(lineupPlayer, index) in lineup2Players"
                    :key="
                      lineupPlayer.steam_id ||
                      lineupPlayer.placeholder_name ||
                      `lineup-2-${index}`
                    "
                  >
                    <tr
                      class="border-b border-border/50 last:border-b-0"
                      :class="{
                        'bg-primary/10 border-l-2 border-l-primary':
                          player &&
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            ?.steam_id === player.steam_id,
                      }"
                    >
                      <td class="py-2 px-2 sm:py-3 sm:px-3">
                        <PlayerDisplay
                          :player="getLineupPlayerDisplayPlayer(lineupPlayer)"
                          :size="compact ? 'xs' : 'sm'"
                          :compact="compact"
                        />
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .kills_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .deaths_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
                        {{
                          getLineupPlayerDisplayPlayer(lineupPlayer)
                            .assists_aggregate?.aggregate?.count || 0
                        }}
                      </td>
                      <td
                        v-if="!compact"
                        class="text-center py-2 px-1 sm:py-3 sm:px-2"
                      >
                        {{
                          Math.round(
                            getLineupPlayerDisplayPlayer(lineupPlayer)
                              .damage_dealt_aggregate
                              ?.aggregate?.sum?.damage || 0,
                          )
                        }}
                      </td>
                      <td class="text-center py-2 px-1 sm:py-3 sm:px-2">
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
                  </template>
                  <!-- Empty rows to maintain consistent height (only while picking players) -->
                  <template
                    v-if="match.status === e_match_status_enum.PickingPlayers"
                    v-for="i in Math.max(
                      0,
                      maxPlayersPerLineup - lineup2Players.length,
                    )"
                    :key="`empty-${i}`"
                  >
                    <tr class="border-b border-border/50 last:border-b-0">
                      <td class="py-2 px-2 sm:py-3 sm:px-3">
                        <PlayerDisplay
                          :show-flag="false"
                          :show-role="false"
                          :show-elo="false"
                          :linkable="false"
                          :size="compact ? 'xs' : 'sm'"
                          :compact="compact"
                          :player="{
                            name: `Slot ${lineup2Players.length + i}`,
                          }"
                        />
                      </td>
                      <td
                        v-if="!compact"
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                      <td
                        class="text-center py-2 px-1 sm:py-3 sm:px-2 text-muted-foreground"
                      >
                        -
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div
        class="relative flex items-center justify-center transition-all duration-300 ease-out"
        :class="{ '-mt-2': !showPlayers, 'mt-2': showPlayers }"
      >
        <Separator class="absolute inset-x-0 top-1/2" />
        <button
          type="button"
          class="relative z-[1] inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-[2px] text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          :aria-expanded="showPlayers"
          :aria-busy="matchStatsLoading"
          @click.stop="toggleShowPlayers"
        >
          <ChevronsDownIcon
            class="h-3 w-3 transition-transform"
            :class="{ 'rotate-180': showPlayers }"
          />
          <span>{{
            showPlayers ? $t("match.hide_players") : $t("match.show_players")
          }}</span>
          <ChevronsDownIcon
            class="h-3 w-3 transition-transform"
            :class="{ 'rotate-180': showPlayers }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchLineupStats } from "~/graphql/matchLineupStats";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    player: {
      type: Object,
      required: false,
      default: null,
    },
    compact: {
      type: Boolean,
      default: false,
    },
    alwaysShow: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      matchStats: null as any | null,
      matchStatsLoading: false,
      showPlayers: false,
    };
  },
  methods: {
    getLineupPicks(lineupId: string) {
      if (
        !this.match?.match_maps?.length ||
        this.match.match_maps.length === 1
      ) {
        return [];
      }

      return this.match.match_maps.filter((match) => {
        const pick = match.vetos?.find?.((veto) => {
          return veto.type === "Pick";
        });
        return pick && pick.match_lineup_id === lineupId;
      });
    },
    getDeciderMaps() {
      if (!this.match?.match_maps?.length) {
        return [];
      }

      if (this.match.match_maps.length === 1) {
        return this.match.match_maps;
      }

      return this.match.match_maps.filter((match) => {
        // Consider deciders as maps without a 'Pick' veto
        const hasPick = match.vetos?.some?.((veto) => {
          return veto.type === "Pick";
        });
        return !hasPick;
      });
    },
    hasMapStarted(matchMap: any): boolean {
      return matchMap.lineup_1_score === 0 && matchMap.lineup_2_score === 0;
    },
    async getMatchStats() {
      this.matchStatsLoading = true;

      try {
        const {
          data: { matches_by_pk },
        } = await this.$apollo.query({
          variables: {
            matchId: this.match.id,
          },
          fetchPolicy: "network-only",
          query: generateQuery({
            matches_by_pk: [
              {
                id: this.match.id,
              },
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
    async toggleShowPlayers() {
      const shouldShow = !this.showPlayers;
      this.showPlayers = shouldShow;

      if (shouldShow) {
        try {
          await this.getMatchStats();
        } catch (error) {
          console.error("Failed to load match player stats", error);
        }
      }
    },
    getLineupPlayerDisplayPlayer(lineupPlayer: any) {
      return (
        lineupPlayer.player || {
          name:
            lineupPlayer.placeholder_name ||
            (lineupPlayer.steam_id ? `Player ${lineupPlayer.steam_id}` : "Slot"),
          steam_id: lineupPlayer.steam_id,
        }
      );
    },
    navigateToMatch(matchId: string) {
      this.$router.push({ name: "matches-id", params: { id: matchId } });
    },
    getTeamInitials(teamName: string): string {
      return teamName
        .split(" ")
        .map((word: string) => word.charAt(0))
        .join("")
        .slice(0, 2);
    },
    getTeamScore(match: any, lineupId: string): string | number {
      if (match.status !== e_match_status_enum.Finished) {
        return "";
      }

      const totalScore = match.match_maps.reduce((total: number, map: any) => {
        if (map.winning_lineup_id === lineupId) {
          return total + 1;
        }
        return total;
      }, 0);

      return totalScore;
    },
    getMatchDuration(match: any): string {
      if (!match.ended_at || !match.started_at) {
        return "N/A";
      }

      const start = new Date(match.started_at);
      const end = new Date(match.ended_at);
      const durationMs = end.getTime() - start.getTime();

      const minutes = Math.floor(durationMs / 60000);

      if (minutes > 0) {
        return `${minutes}m`;
      }
      return "0m";
    },
    getKDRatio(kills: number, deaths: number): string {
      if (deaths === 0) {
        return kills > 0 ? kills.toFixed(1) : "0.0";
      }
      return (kills / deaths).toFixed(2);
    },
    isMatchLive(): boolean {
      return this.match.status === e_match_status_enum.Live;
    },
    didTeamWin(lineupId: string): boolean {
      if (this.playerLineup === lineupId) {
        if (this.match.winning_lineup_id === lineupId) {
          return true;
        }
        return false;
      }

      if (this.match.winning_lineup_id === lineupId) {
        return true;
      }
      return false;
    },
    getScoreColorClasses(lineupId: string): string {
      if (this.isMatchLive()) {
        return "text-foreground";
      }

      if (this.match.status === e_match_status_enum.Finished) {
        if (this.playerLineup) {
          if (this.playerLineup === lineupId) {
            return this.didTeamWin(lineupId)
              ? "text-green-500"
              : "text-red-500";
          }
          return "text-foreground";
        }
        if (this.didTeamWin(lineupId)) {
          return "text-green-500";
        } else {
          return "text-red-500";
        }
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

      if (!matchMap.winning_lineup_id) {
        return "text-foreground";
      }

      if (matchMap.winning_lineup_id === lineupId) {
        return "text-green-500";
      } else {
        return "text-red-500";
      }
    },
  },
  computed: {
    isTournamentMatch(): boolean {
      return Boolean(
        this.match?.is_tournament_match || this.match?.tournament_brackets?.length,
      );
    },
    tournamentBracket(): any {
      return this.match?.tournament_brackets?.[0] ?? null;
    },
    tournamentName(): string {
      return this.tournamentBracket?.stage?.tournament?.name || "";
    },
    tournamentLabel(): string {
      return this.tournamentName || "Tournament Match";
    },
    tournamentRoundLabel(): string {
      const stage = this.tournamentBracket?.stage;
      const stageLabel = stage?.e_tournament_stage_type?.description;
      const round = this.tournamentBracket?.round;
      const matchNumber = this.tournamentBracket?.match_number;

      if (stageLabel && round && matchNumber) {
        return `${stageLabel} R${round} M${matchNumber}`;
      }

      if (stageLabel && round) {
        return `${stageLabel} R${round}`;
      }

      if (round && matchNumber) {
        return `R${round} M${matchNumber}`;
      }

      return stageLabel || "";
    },
    matchTypePillClasses(): string {
      return "inline-flex min-w-0 items-center rounded-md border border-border/70 bg-muted/35 px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none text-foreground";
    },
    tournamentPillClasses(): string {
      return "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.10)] px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none text-[hsl(var(--tac-amber))]";
    },
    roundPillClasses(): string {
      return "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/35 px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none text-muted-foreground";
    },
    maxPlayersPerLineup() {
      return this.match.max_players_per_lineup;
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
    eloChange(): typeof eloFields {
      return this.match.elo_changes?.at(0);
    },
    playerLineup(): string | null {
      if (!this.eloChange?.player_steam_id) {
        return null;
      }
      const playerSteamId = this.eloChange.player_steam_id;

      const inLineup1 = this.match.lineup_1?.lineup_players?.some(
        (lp: any) => lp.player?.steam_id === playerSteamId,
      );

      if (inLineup1) {
        return this.match.lineup_1_id;
      }

      const inLineup2 = this.match.lineup_2?.lineup_players?.some(
        (lp: any) => lp.player?.steam_id === playerSteamId,
      );

      if (inLineup2) {
        return this.match.lineup_2_id;
      }

      return null;
    },
    canJoinMatch(): boolean {
      const hasAvailableSpot =
        (this.match.lineup_counts?.lineup_1_count ?? 0) <
          this.match.max_players_per_lineup ||
        (this.match.lineup_counts?.lineup_2_count ?? 0) <
          this.match.max_players_per_lineup;

      return (
        this.match.status === e_match_status_enum.PickingPlayers &&
        this.match.options.lobby_access === e_lobby_access_enum.Open &&
        !this.match.lineup_1.is_on_lineup &&
        !this.match.lineup_2.is_on_lineup &&
        hasAvailableSpot
      );
    },
  },
};
</script>
