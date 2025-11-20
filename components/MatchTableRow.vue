<script setup lang="ts">
import { UserPlusIcon, UsersIcon, ChevronsDownIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { eloFields } from "~/graphql/eloFields";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import StreamEmbed from "~/components/StreamEmbed.vue";
</script>

<template>
  <div
    class="bg-muted/30 border border-border rounded-lg hover:shadow-lg hover:shadow-primary/10 hover:bg-muted/20 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
    @click="navigateToMatch(match.id, $event)"
  >
    <div class="p-6 flex flex-col gap-3">
      <!-- Match Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <Badge variant="secondary" class="text-xs">
            {{ match.options.type }}
          </Badge>
          <!-- Elo Change Display -->
          <TooltipProvider v-if="eloChange">
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  variant="outline"
                  :class="[
                    'text-xs font-semibold cursor-help',
                    eloChange.elo_change > 0
                      ? 'bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30'
                      : 'bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30',
                  ]"
                >
                  {{ formatEloChange(eloChange.elo_change) }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                <div>
                  <div class="font-semibold border-b border-border/50 pb-1">
                    Elo Change Details
                  </div>

                  <!-- Current Elo → Updated Elo -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Elo:</span>
                      <span class="font-medium">
                        {{ (eloChange.current_elo as number).toLocaleString() }}
                        →
                        {{ (eloChange.updated_elo as number).toLocaleString() }}
                      </span>
                    </div>
                  </div>

                  <!-- Team Elo Averages -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Team Elo Avg:</span>
                      <span class="font-medium">
                        {{
                          (
                            eloChange.player_team_elo_avg as number
                          ).toLocaleString()
                        }}
                        vs
                        {{
                          (
                            eloChange.opponent_team_elo_avg as number
                          ).toLocaleString()
                        }}
                      </span>
                    </div>
                  </div>

                  <!-- Performance Multiplier -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground"
                        >Performance Multiplier:</span
                      >
                      <span class="font-medium"
                        >{{
                          parseFloat(eloChange.performance_multiplier).toFixed(
                            5,
                          )
                        }}%</span
                      >
                    </div>
                  </div>

                  <!-- K/D/A -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground"
                        >Kills / Deaths / Assists:</span
                      >
                      <span class="font-medium">
                        {{ eloChange.kills }} / {{ eloChange.deaths }} /
                        {{ eloChange.assists }}
                      </span>
                    </div>
                  </div>

                  <!-- KDA -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground"
                        >Kills + Assits / Deaths Ratio:</span
                      >
                      <span class="font-medium">{{
                        parseFloat(eloChange.kda).toFixed(2)
                      }}</span>
                    </div>
                  </div>

                  <!-- Team Avg KDA -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground"
                        >Team Avg Kills + Assits / Deaths Ratio:</span
                      >
                      <span class="font-medium">{{
                        parseFloat(eloChange.team_avg_kda).toFixed(2)
                      }}</span>
                    </div>
                  </div>

                  <!-- Damage -->
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">Damage:</span>
                      <span class="font-medium">
                        {{ eloChange.damage }}
                        <span>
                          ({{ Math.round(eloChange.damage_percent * 100) }}% of
                          teams damage)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="flex items-center space-x-4">
          <!-- Join Button - Prominent Position -->
          <Button
            v-if="
              match.status === e_match_status_enum.PickingPlayers &&
              match.options.lobby_access === e_lobby_access_enum.Open &&
              !match.lineup_1.is_on_lineup &&
              !match.lineup_2.is_on_lineup
            "
            variant="default"
            size="sm"
            class="flex items-center space-x-2"
            @click.stop="navigateToMatch(match.id, $event)"
          >
            <UserPlusIcon class="h-4 w-4" />
            <span>{{ $t("match.options.table.join") }}</span>
          </Button>

          <!-- moved player toggle below maps -->
          <div
            class="flex items-center space-x-2 text-sm text-muted-foreground"
          >
            <div v-if="match.streams?.length > 0">
              <StreamEmbed
                :streams="match.streams"
                :show-title="false"
                :preview="true"
              />
            </div>

            <Badge variant="outline" class="text-xs">
              {{ match.e_match_status.description }}
            </Badge>

            <TimeAgo
              :date="match.started_at || match.scheduled_at || match.created_at"
            ></TimeAgo>
            <template v-if="match.ended_at">
              <span>•</span>
              <span>Duration: {{ getMatchDuration(match) }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Team Names + Score (no player tables) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <!-- Team 1 name -->
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <div
              class="uppercase w-10 h-10 bg-gradient-to-br from-primary via-primary/90 to-primary/70 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg border-2 border-primary/20"
            >
              {{ getTeamInitials(match.lineup_1.name) }}
            </div>
          </div>
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
        <div class="flex items-center justify-center">
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

        <!-- Team 2 name -->
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
          <div class="flex-shrink-0">
            <div
              class="uppercase w-10 h-10 bg-gradient-to-br from-destructive via-destructive/90 to-destructive/70 rounded-xl flex items-center justify-center text-destructive-foreground font-bold text-lg shadow-lg border-2 border-destructive/20"
            >
              {{ getTeamInitials(match.lineup_2.name) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Maps Section: lineup1 picks | deciders | lineup2 picks -->
      <div
        class="border-t border-border py-2"
        v-if="match.match_maps.length > 0"
      >
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <!-- Lineup 1 Picks -->
          <div class="flex flex-col items-start justify-start gap-2">
            <div
              class="hidden lg:block text-xs uppercase tracking-wide text-muted-foreground"
            >
              Picks
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(match_map, index) in getLineupPicks(match.lineup_1.id)"
                :key="`l1-${index}`"
                class="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2 border border-border"
                :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
              >
                <img
                  :src="match_map.map.patch"
                  :alt="match_map.map.name"
                  class="w-6 h-6"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span class="text-sm font-medium first-letter:uppercase">{{
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
            class="flex items-center justify-center lg:border-x lg:border-border/60 lg:px-4"
          >
            <div class="flex flex-col items-center gap-2 w-full">
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Decider
              </div>
              <div class="flex flex-wrap gap-2 justify-center">
                <div
                  v-for="(match_map, index) in getDeciderMaps()"
                  :key="`dec-${index}`"
                  class="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2 border border-border"
                  :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
                >
                  <img
                    :src="match_map.map.patch"
                    :alt="match_map.map.name"
                    class="w-6 h-6"
                    @error="
                      ($event.target as HTMLImageElement).style.display = 'none'
                    "
                  />
                  <span class="text-sm font-medium first-letter:uppercase">{{
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
          <div class="flex flex-col items-end justify-start gap-2">
            <div
              class="hidden lg:block text-xs uppercase tracking-wide text-muted-foreground"
            >
              Picks
            </div>
            <div class="flex flex-wrap gap-2 justify-end">
              <div
                v-for="(match_map, index) in getLineupPicks(match.lineup_2.id)"
                :key="`l2-${index}`"
                class="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2 border border-border"
                :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
              >
                <img
                  :src="match_map.map.patch"
                  :alt="match_map.map.name"
                  class="w-6 h-6"
                  @error="
                    ($event.target as HTMLImageElement).style.display = 'none'
                  "
                />
                <span class="text-sm font-medium first-letter:uppercase">{{
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
        class="grid grid-cols-1 lg:grid-cols-2 items-stretch overflow-hidden transition-all duration-300 ease-out"
        :class="
          showPlayers
            ? 'gap-6 border-t border-border pt-4 opacity-100 translate-y-0 max-h-[2000px]'
            : 'gap-0 border-0 pt-0 opacity-0 -translate-y-1 max-h-0'
        "
      >
        <!-- Team 1 players -->
        <div class="space-y-2">
          <div
            v-if="matchStats.lineup_1"
            class="bg-muted/50 rounded-lg p-4 border border-border min-h-[200px] h-full flex flex-col"
          >
            <h5 class="text-sm font-semibold text-foreground mb-3">
              {{ matchStats.lineup_1.name }} Stats
            </h5>
            <div class="overflow-x-auto flex-1">
              <table class="w-full text-xs min-w-[400px] h-full">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 px-3 font-medium">Player</th>
                    <th class="text-center py-2 px-3 font-medium w-12">K</th>
                    <th class="text-center py-2 px-3 font-medium w-12">D</th>
                    <th class="text-center py-2 px-3 font-medium w-12">A</th>
                    <th class="text-center py-2 px-3 font-medium w-16">DMG</th>
                    <th class="text-center py-2 px-3 font-medium w-12">K/D</th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="lineupPlayer in matchStats.lineup_1.lineup_players"
                    :key="lineupPlayer.steam_id"
                  >
                    <tr
                      class="border-b border-border/50 last:border-b-0"
                      :class="{
                        'bg-primary/10 border-l-2 border-l-primary':
                          player &&
                          lineupPlayer.player?.steam_id === player.steam_id,
                      }"
                    >
                      <td class="py-3 px-3">
                        <PlayerDisplay
                          :player="lineupPlayer.player"
                        ></PlayerDisplay>
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.kills_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.deaths_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.assists_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          Math.round(
                            lineupPlayer.player.damage_dealt_aggregate
                              ?.aggregate?.sum?.damage || 0,
                          )
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          getKDRatio(
                            lineupPlayer.player.kills_aggregate?.aggregate
                              ?.count || 0,
                            lineupPlayer.player.deaths_aggregate?.aggregate
                              ?.count || 0,
                          )
                        }}
                      </td>
                    </tr>
                  </template>
                  <!-- Empty rows to maintain consistent height -->
                  <template
                    v-for="i in Math.max(
                      0,
                      5 -
                        (matchStats.lineup_1?.lineup_players?.length ||
                          match.lineup_1?.lineup_players?.length ||
                          0),
                    )"
                    :key="`empty-${i}`"
                  >
                    <tr class="border-b border-border/50 last:border-b-0">
                      <td class="py-3 px-3">
                        <PlayerDisplay
                          :show-flag="false"
                          :show-role="false"
                          :show-elo="false"
                          :linkable="false"
                          :player="{
                            name: `Slot ${(matchStats.lineup_1?.lineup_players?.length || match.lineup_1?.lineup_players?.length || 0) + i}`,
                          }"
                        />
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
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
            v-if="matchStats.lineup_2"
            class="bg-muted/50 rounded-lg p-4 border border-border min-h-[200px] h-full flex flex-col"
          >
            <h5 class="text-sm font-semibold text-foreground mb-3">
              {{ matchStats.lineup_2.name }} Stats
            </h5>
            <div class="overflow-x-auto flex-1">
              <table class="w-full text-xs min-w-[400px] h-full">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 px-3 font-medium">Player</th>
                    <th class="text-center py-2 px-3 font-medium w-12">K</th>
                    <th class="text-center py-2 px-3 font-medium w-12">D</th>
                    <th class="text-center py-2 px-3 font-medium w-12">A</th>
                    <th class="text-center py-2 px-3 font-medium w-16">DMG</th>
                    <th class="text-center py-2 px-3 font-medium w-12">K/D</th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="lineupPlayer in matchStats.lineup_2.lineup_players"
                    :key="lineupPlayer.steam_id"
                  >
                    <tr
                      class="border-b border-border/50 last:border-b-0"
                      :class="{
                        'bg-primary/10 border-l-2 border-l-primary':
                          player &&
                          lineupPlayer.player?.steam_id === player.steam_id,
                      }"
                    >
                      <td class="py-3 px-3">
                        <PlayerDisplay
                          :player="lineupPlayer.player"
                        ></PlayerDisplay>
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.kills_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.deaths_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          lineupPlayer.player.assists_aggregate?.aggregate
                            ?.count || 0
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          Math.round(
                            lineupPlayer.player.damage_dealt_aggregate
                              ?.aggregate?.sum?.damage || 0,
                          )
                        }}
                      </td>
                      <td class="text-center py-3 px-3">
                        {{
                          getKDRatio(
                            lineupPlayer.player.kills_aggregate?.aggregate
                              ?.count || 0,
                            lineupPlayer.player.deaths_aggregate?.aggregate
                              ?.count || 0,
                          )
                        }}
                      </td>
                    </tr>
                  </template>
                  <!-- Empty rows to maintain consistent height -->
                  <template
                    v-for="i in Math.max(
                      0,
                      5 -
                        (matchStats.lineup_2?.lineup_players?.length ||
                          match.lineup_2?.lineup_players?.length ||
                          0),
                    )"
                    :key="`empty-${i}`"
                  >
                    <tr class="border-b border-border/50 last:border-b-0">
                      <td class="py-3 px-3">
                        <PlayerDisplay
                          :show-flag="false"
                          :show-role="false"
                          :show-elo="false"
                          :linkable="false"
                          :player="{
                            name: `Slot ${(matchStats.lineup_2?.lineup_players?.length || match.lineup_2?.lineup_players?.length || 0) + i}`,
                          }"
                        />
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
                        -
                      </td>
                      <td class="text-center py-3 px-3 text-muted-foreground">
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
        class="flex justify-center transition-all duration-300 ease-out"
        @click.stop="toggleShowPlayers"
        :class="{ '-mt-2': !showPlayers, 'mt-2': showPlayers }"
      >
        <Separator class="relative">
          <span
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-[2px] text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm hover:bg-muted/60 hover:text-foreground transition-colors"
            role="button"
            tabindex="0"
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
          </span>
        </Separator>
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
  },
  data() {
    return {
      matchStats: {},
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
      const {
        data: { matches_by_pk },
      } = await this.$apollo.query({
        variables: {
          matchId: this.match.id,
        },
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
    },
    async toggleShowPlayers() {
      this.showPlayers = !this.showPlayers;
      await this.getMatchStats();
    },
    navigateToMatch(matchId: string, event: Event) {
      const target = event.target as HTMLElement;
      const isToggleButton = target.closest("button");

      if (isToggleButton) {
        return;
      }

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
    formatEloChange(change: number): string {
      if (change === null || change === undefined) {
        return "";
      }
      const sign = change > 0 ? "+" : "";
      return `${sign}${change.toLocaleString()}`;
    },
  },
  computed: {
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
  },
};
</script>
