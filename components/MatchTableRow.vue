<script setup lang="ts">
import {
  ArrowUpRight,
  ExternalLink,
  Film,
  GitBranch,
  ListChecks,
  Radio,
  Trophy,
  UserPlusIcon,
  UsersIcon,
  X,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { eloFields } from "~/graphql/eloFields";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import YouTubeIcon from "~/components/icons/YouTubeIcon.vue";
import KickIcon from "~/components/icons/KickIcon.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchSourceBadge from "~/components/MatchSourceBadge.vue";
import { ref } from "vue";
import MatchPlayerDetailsPanel from "~/components/match/MatchPlayerDetailsPanel.vue";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";

const highlightsScrollRef = ref<InstanceType<
  typeof HorizontalScrollRow
> | null>(null);
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
  <div
    v-if="
      alwaysShow || !compact || match.status === e_match_status_enum.Finished
    "
    :class="[
      'transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col h-full',
      embedded
        ? 'bg-transparent'
        : 'bg-muted/30 border border-border rounded-lg hover:shadow-lg hover:shadow-primary/10 hover:bg-muted/20 hover:border-primary/30',
    ]"
    @click="navigateToMatch(match.id, $event)"
  >
    <div
      :class="[
        'flex flex-col gap-3 flex-1',
        compact ? 'p-2' : 'p-2 sm:p-3 md:p-4',
      ]"
    >
      <div class="flex sm:hidden items-start justify-between gap-2">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span v-if="!compact" :class="matchTypePillClasses">
            {{ match.options.type }}
          </span>

          <MatchSourceBadge :source="match.source" />

          <span v-if="match.options?.best_of" :class="matchTypePillClasses">
            BO{{ match.options.best_of }}
          </span>

          <span
            v-if="isTournamentMatch && !compact"
            :class="tournamentPillClasses"
          >
            <Trophy class="h-3 w-3 shrink-0" />
            <span class="max-w-24 truncate">{{ tournamentLabel }}</span>
          </span>

          <span v-if="clipCount > 0" :class="clipPillClasses">
            <Film class="h-3 w-3 shrink-0" />
            <span class="tabular-nums">{{ clipCount }}</span>
          </span>

          <EloChangeBadge :elo-change="eloChange" size="xs" />
        </div>

        <div
          class="flex shrink-0 items-center space-x-2 text-[10px] text-muted-foreground"
        >
          <template
            v-if="
              !hideStreamButton &&
              match.streams?.length > 0 &&
              !match.is_in_lineup &&
              !match.is_coach &&
              isStreamableStatus
            "
          >
            <button
              v-for="stream in match.streams"
              :key="stream.id"
              type="button"
              :class="watchStreamPillClasses"
              :title="stream.title || stream.link"
              @click.stop="watchStream(stream)"
            >
              <Radio class="h-3 w-3" />
              <span>{{ $t("match.stream.watch") }}</span>
            </button>
          </template>
          <MatchStatus v-if="!compact" :match="match" />
          <TimeAgo
            :date="match.started_at || match.scheduled_at || match.created_at"
          ></TimeAgo>
        </div>
      </div>

      <div
        class="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      >
        <div class="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1">
          <span v-if="!compact" :class="matchTypePillClasses">
            {{ match.options.type }}
          </span>

          <MatchSourceBadge :source="match.source" />

          <span v-if="match.options?.best_of" :class="matchTypePillClasses">
            BO{{ match.options.best_of }}
          </span>

          <span v-if="clipCount > 0" :class="clipPillClasses">
            <Film class="h-3 w-3 shrink-0" />
            <span class="tabular-nums">{{ clipCount }}</span>
            <span
              v-if="!compact"
              class="hidden sm:inline normal-case tracking-normal font-normal text-muted-foreground"
            >
              {{ $t("clips.clip_count", clipCount) }}
            </span>
          </span>

          <EloChangeBadge :elo-change="eloChange" />
        </div>
        <div class="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1">
          <button
            v-if="canJoinMatch"
            type="button"
            class="group/join relative inline-flex items-center isolate px-[0.7rem] py-[0.28rem] font-sans text-[0.68rem] font-bold tracking-[0.16em] uppercase text-[hsl(0_0%_8%)] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] border border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35),0_4px_14px_-4px_hsl(var(--tac-amber)/0.5)] [transition:transform_180ms_cubic-bezier(0.4,0,0.2,1),box-shadow_180ms_ease] cursor-pointer overflow-hidden whitespace-nowrap hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.55),0_10px_24px_-4px_hsl(var(--tac-amber)/0.7),0_0_20px_hsl(var(--tac-amber)/0.3)] active:translate-y-0"
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

          <div
            class="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground"
          >
            <template
              v-if="
                !hideStreamButton &&
                match.streams?.length > 0 &&
                !match.is_in_lineup &&
                !match.is_coach &&
                isStreamableStatus
              "
            >
              <button
                v-for="stream in match.streams"
                :key="stream.id"
                type="button"
                :class="watchStreamPillClasses"
                :title="stream.title || stream.link"
                @click.stop="watchStream(stream)"
              >
                <Radio class="h-3 w-3" />
                <span>{{ $t("match.stream.watch") }}</span>
              </button>
            </template>

            <MatchStatus v-if="!compact" :match="match" />

            <TimeAgo
              :date="match.started_at || match.scheduled_at || match.created_at"
            ></TimeAgo>
            <template v-if="!compact && match.ended_at">
              <span class="hidden sm:inline">•</span>
              <span class="hidden sm:inline"
                >{{ $t("common.duration") }}:
                {{ getMatchDuration(match) }}</span
              >
            </template>
          </div>
        </div>
      </div>

      <div
        v-if="
          isTournamentMatch || (match.match_maps && match.match_maps.length > 0)
        "
        class="flex min-w-0 items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] leading-none"
        :title="
          [
            isTournamentMatch ? tournamentLabel : null,
            isTournamentMatch && tournamentRoundLabel
              ? tournamentRoundLabel
              : null,
            ...match.match_maps.map((mm) => mm.map?.label || mm.map?.name),
          ]
            .filter(Boolean)
            .join(' · ')
        "
      >
        <Trophy
          v-if="isTournamentMatch"
          class="h-3 w-3 shrink-0 text-[hsl(var(--tac-amber))]/85"
        />
        <ListChecks v-else class="h-3 w-3 shrink-0 opacity-50" />
        <span class="min-w-0 flex-1 truncate">
          <span
            v-if="isTournamentMatch"
            class="font-semibold text-[hsl(var(--tac-amber))]/90"
          >
            {{ tournamentLabel }}
          </span>
          <template
            v-if="isTournamentMatch && tournamentRoundLabel && !compact"
          >
            <span class="mx-1.5 text-muted-foreground/40">·</span>
            <span class="text-muted-foreground/85">
              {{ tournamentRoundLabel }}
            </span>
          </template>
          <span
            v-if="
              isTournamentMatch &&
              match.match_maps &&
              match.match_maps.length > 0
            "
            class="mx-1.5 text-muted-foreground/40"
          >
            ·
          </span>
          <template v-for="(mm, i) in match.match_maps" :key="mm.id || i">
            <span v-if="i > 0" class="text-muted-foreground/40"> · </span>
            <span class="text-muted-foreground">
              {{ cleanMapName(mm.map?.label || mm.map?.name || "") }}
            </span>
          </template>
        </span>
      </div>

      <div v-if="compact" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-3">
          <h3
            class="min-w-0 truncate text-sm font-semibold text-foreground"
            :class="{
              'text-[hsl(var(--tac-amber))]':
                focusPlayerLineupId === match.lineup_1_id,
            }"
            :title="match.lineup_1.name"
          >
            {{ match.lineup_1.name }}
          </h3>
          <div class="flex shrink-0 items-baseline gap-1.5">
            <span
              v-if="showSeriesScore"
              class="text-2xl font-bold tabular-nums"
              :class="getScoreColorClasses(match.lineup_1.id)"
            >
              {{ getTeamScore(match, match.lineup_1.id) }}
            </span>
            <span
              v-if="showMapRoundScore"
              class="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono font-bold leading-none tabular-nums text-foreground/85"
              :class="showSeriesScore ? 'text-xs' : 'text-xl'"
              :title="
                previewMatchMap?.map?.label || previewMatchMap?.map?.name || ''
              "
            >
              {{ previewMatchMap?.lineup_1_score ?? 0 }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between gap-3">
          <h3
            class="min-w-0 truncate text-sm font-semibold text-foreground"
            :class="{
              'text-[hsl(var(--tac-amber))]':
                focusPlayerLineupId === match.lineup_2_id,
            }"
            :title="match.lineup_2.name"
          >
            {{ match.lineup_2.name }}
          </h3>
          <div class="flex shrink-0 items-baseline gap-1.5">
            <span
              v-if="showSeriesScore"
              class="text-2xl font-bold tabular-nums"
              :class="getScoreColorClasses(match.lineup_2.id)"
            >
              {{ getTeamScore(match, match.lineup_2.id) }}
            </span>
            <span
              v-if="showMapRoundScore"
              class="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono font-bold leading-none tabular-nums text-foreground/85"
              :class="showSeriesScore ? 'text-xs' : 'text-xl'"
              :title="
                previewMatchMap?.map?.label || previewMatchMap?.map?.name || ''
              "
            >
              {{ previewMatchMap?.lineup_2_score ?? 0 }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6 items-center"
      >
        <div class="flex items-center space-x-2 lg:space-x-3">
          <div class="flex-1 min-w-0">
            <h3
              class="font-semibold text-foreground truncate"
              :class="{
                'text-[hsl(var(--tac-amber))]':
                  focusPlayerLineupId === match.lineup_1_id,
              }"
            >
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
                {{ $t("common.players") }}
              </span>
            </div>
          </div>
        </div>

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

        <div class="flex items-center space-x-3 justify-end">
          <div class="flex-1 min-w-0">
            <h3
              class="font-semibold text-foreground truncate text-right"
              :class="{
                'text-[hsl(var(--tac-amber))]':
                  focusPlayerLineupId === match.lineup_2_id,
              }"
            >
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
                {{ $t("common.players") }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="false" class="border-t border-border py-2">
        <div v-if="compact" class="grid grid-cols-2 gap-1.5">
          <div
            v-for="(match_map, index) in match.match_maps"
            :key="`compact-${index}`"
            class="flex min-w-0 items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border"
            :class="{ 'opacity-50 grayscale': hasMapStarted(match_map) }"
          >
            <img
              :src="match_map.map.patch"
              :alt="match_map.map.name"
              class="w-5 h-5 shrink-0"
              @error="
                ($event.target as HTMLImageElement).style.display = 'none'
              "
            />
            <span
              class="min-w-0 truncate text-xs font-medium first-letter:uppercase"
              >{{ cleanMapName(match_map.map.name) }}</span
            >
            <div
              class="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums"
            >
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

        <div
          v-else
          :class="['grid grid-cols-1 gap-4 items-start', 'lg:grid-cols-3']"
        >
          <div
            v-if="!compact || getLineupPicks(match.lineup_1.id).length"
            class="flex flex-col items-start justify-start gap-2"
          >
            <div
              class="text-xs uppercase tracking-wide text-muted-foreground"
              :class="compact ? '' : 'hidden lg:block'"
            >
              {{ $t("match.picks_label") }}
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

          <div
            v-if="!compact || getDeciderMaps().length"
            class="flex items-center justify-center lg:border-x lg:border-border/60 lg:px-4"
          >
            <div class="flex flex-col items-center gap-2 w-full">
              <div
                class="text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ $t("match.decider") }}
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

          <div
            v-if="!compact || getLineupPicks(match.lineup_2.id).length"
            class="flex flex-col items-end justify-start gap-2"
          >
            <div
              class="text-xs uppercase tracking-wide text-muted-foreground"
              :class="compact ? '' : 'hidden lg:block'"
            >
              {{ $t("match.picks_label") }}
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

      <div
        v-if="false"
        :class="[
          'grid grid-cols-1 items-stretch overflow-hidden transition-all duration-300 ease-out',
          !compact && 'lg:grid-cols-2',
          drawerOpen
            ? 'gap-6 border-t border-border pt-4 opacity-100 translate-y-0 max-h-[2000px]'
            : 'gap-0 border-0 pt-0 opacity-0 -translate-y-1 max-h-0',
        ]"
      >
        <div class="space-y-2">
          <div
            v-if="displayedMatchStats.lineup_1"
            :class="[
              'bg-muted/50 rounded-lg border border-border min-h-[200px] h-full flex flex-col',
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
                      {{ $t("common.player") }}
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
                          :avatar-override="
                            lineup1AvatarOverride(
                              getLineupPlayerDisplayPlayer(lineupPlayer)
                                ?.steam_id,
                            )
                          "
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
                              .damage_dealt_aggregate?.aggregate?.sum?.damage ||
                              0,
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
                      {{ $t("common.player") }}
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
                          :avatar-override="
                            lineup2AvatarOverride(
                              getLineupPlayerDisplayPlayer(lineupPlayer)
                                ?.steam_id,
                            )
                          "
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
                              .damage_dealt_aggregate?.aggregate?.sum?.damage ||
                              0,
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

      <!-- Quick overview + Open match buttons — only when no player-focus
           analysis area is attached. Otherwise the analysis area carries
           both actions together. The Open match button makes it explicit
           that a full details page exists (the row click is not obvious). -->
      <div
        v-if="!hasPlayerAnalysis && !hideOverview"
        class="mt-auto flex gap-2"
      >
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-background hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
          :aria-busy="matchStatsLoading"
          @click.stop="openDrawer"
        >
          <ListChecks class="h-3.5 w-3.5" />
          <span>{{ $t("ui_extras.quick_overview") }}</span>
        </button>
        <NuxtLink
          :to="`/matches/${match.id}`"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--tac-amber))] transition-colors hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
          @click.stop
        >
          <ExternalLink class="h-3.5 w-3.5" />
          <span>{{ $t("match.open_match") }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Player-focus analysis zone. Sits below the match info, sharing
         the same outer card frame but separated by a top border so it
         reads as a "connection area" — stats + highlights + actions
         live here together instead of being infused into the team rows. -->
    <div
      v-if="hasPlayerAnalysis"
      class="border-t border-border bg-card/40 px-2 py-2.5 space-y-2.5"
      :class="compact ? '' : 'sm:px-4 sm:py-3'"
      @click.stop
    >
      <MatchPlayerDetailsPanel
        :match="match"
        :focus-lineup="focusPlayerLineupDetailed"
        :loading="detailsStatsLoading"
        :active-tab="detailsTab"
        :selected-map-id="selectedMapId"
        @update:active-tab="(v) => (detailsTab = v)"
        @update:selected-map-id="(v) => (selectedMapId = v)"
      />

      <!-- Highlights below the tabs — every clip is a full hero card
           in a horizontal scroll row. Snap + arrows let users scrub
           through the queue without the page reshaping. click.capture
           seeds the modal's prev/next queue before any card opens. -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        leave-active-class="transition-opacity duration-150 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
        mode="out-in"
      >
        <div
          v-if="filteredPlayerClips.length > 0"
          :key="`clips-${selectedMapId ?? 'all'}`"
          class="space-y-2"
          @click.capture="seedPlayerClipQueue"
        >
          <div
            class="flex items-center justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span class="inline-flex items-center gap-1.5">
              <Film class="h-3 w-3 text-[hsl(var(--tac-amber))]/80" />
              {{ $t("common.highlights") }}
              <span class="text-foreground/70">·</span>
              <span class="text-foreground/80">
                {{ filteredPlayerClips.length }}
              </span>
            </span>
            <ScrollArrows
              v-if="filteredPlayerClips.length > 1"
              :can-left="highlightsScrollRef?.state?.canScrollLeft"
              :can-right="highlightsScrollRef?.state?.canScrollRight"
              @scroll="(d) => highlightsScrollRef?.scrollByDirection(d)"
            />
          </div>
          <HorizontalScrollRow ref="highlightsScrollRef">
            <HighlightCard
              v-for="clip in filteredPlayerClips"
              :key="clip.id"
              :clip="clip"
              :show-map="false"
              class="w-80 shrink-0 snap-start"
            />
          </HorizontalScrollRow>
        </div>
        <p
          v-else-if="playerClips.length > 0"
          key="no-clips"
          class="text-[0.65rem] text-muted-foreground"
        >
          No highlights from this map.
        </p>
      </Transition>
      <!-- Quick Overview + Open match buttons — anchor the bottom of the
           analysis zone. Open match is highlighted so the affordance to
           reach the full details page is obvious (row click is not). -->
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-background hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
          :aria-busy="matchStatsLoading"
          @click.stop="openDrawer"
        >
          <ListChecks class="h-3.5 w-3.5" />
          <span>{{ $t("ui_extras.quick_overview") }}</span>
        </button>
        <NuxtLink
          :to="`/matches/${match.id}`"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--tac-amber))] transition-colors hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
          @click.stop
        >
          <ExternalLink class="h-3.5 w-3.5" />
          <span>{{ $t("match.open_match") }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Match details drawer — full picks/deciders map breakdown + player
         stat tables. Triggered by the View details button. Renders to a
         portal so it doesn't perturb the card layout. Lives inside the
         card root so the component has a single top-level node and
         class fallthrough (h-full etc) keeps working. -->
    <Drawer v-model:open="drawerOpen">
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
                @click="drawerOpen = false"
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
                  {{ match.lineup_1.name }} Picks
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
                        ($event.target as HTMLImageElement).style.display =
                          'none'
                      "
                    />
                    <span class="text-xs font-medium first-letter:uppercase">{{
                      cleanMapName(match_map.map.name)
                    }}</span>
                    <div
                      class="flex items-center space-x-1 text-xs tabular-nums"
                    >
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
                        ($event.target as HTMLImageElement).style.display =
                          'none'
                      "
                    />
                    <span class="text-xs font-medium first-letter:uppercase">{{
                      cleanMapName(match_map.map.name)
                    }}</span>
                    <div
                      class="flex items-center space-x-1 text-xs tabular-nums"
                    >
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
                  {{ match.lineup_2.name }} Picks
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
                        ($event.target as HTMLImageElement).style.display =
                          'none'
                      "
                    />
                    <span class="text-xs font-medium first-letter:uppercase">{{
                      cleanMapName(match_map.map.name)
                    }}</span>
                    <div
                      class="flex items-center space-x-1 text-xs tabular-nums"
                    >
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
                v-if="displayedMatchStats.lineup_1"
                class="rounded-lg border border-border bg-muted/40 p-3 sm:p-4"
              >
                <h5 class="mb-3 text-sm font-semibold text-foreground">
                  {{
                    $t("match.team_stats_heading", {
                      name: displayedMatchStats.lineup_1.name,
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
                        <th class="text-center py-2 px-2 font-medium w-10">
                          K
                        </th>
                        <th class="text-center py-2 px-2 font-medium w-10">
                          D
                        </th>
                        <th class="text-center py-2 px-2 font-medium w-10">
                          A
                        </th>
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
                        v-for="(lineupPlayer, index) in lineup1Players"
                        :key="
                          lineupPlayer.steam_id ||
                          lineupPlayer.placeholder_name ||
                          `drawer-l1p-${index}`
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
                              lineup1AvatarOverride(
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
                                .damage_dealt_aggregate?.aggregate?.sum
                                ?.damage || 0,
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

              <div
                v-if="displayedMatchStats.lineup_2"
                class="rounded-lg border border-border bg-muted/40 p-3 sm:p-4"
              >
                <h5 class="mb-3 text-sm font-semibold text-foreground">
                  {{
                    $t("match.team_stats_heading", {
                      name: displayedMatchStats.lineup_2.name,
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
                        <th class="text-center py-2 px-2 font-medium w-10">
                          K
                        </th>
                        <th class="text-center py-2 px-2 font-medium w-10">
                          D
                        </th>
                        <th class="text-center py-2 px-2 font-medium w-10">
                          A
                        </th>
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
                        v-for="(lineupPlayer, index) in lineup2Players"
                        :key="
                          lineupPlayer.steam_id ||
                          lineupPlayer.placeholder_name ||
                          `drawer-l2p-${index}`
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
                              lineup2AvatarOverride(
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
                                .damage_dealt_aggregate?.aggregate?.sum
                                ?.damage || 0,
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
              Loading player stats…
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchLineupStats } from "~/graphql/matchLineupStats";
import { matchAllMapsStats } from "~/graphql/matchAllMapsStatsGraphql";
import { matchClipFields } from "~/graphql/matchClip";
import { $, order_by } from "~/generated/zeus";
import { useClipModal } from "~/composables/useClipModal";

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
    hideOverview: {
      type: Boolean,
      default: false,
    },
    embedded: {
      type: Boolean,
      default: false,
    },
    hideStreamButton: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      matchStats: null as any | null,
      matchStatsLoading: false,
      drawerOpen: false,
      playerClips: [] as any[],
      playerClipsLoading: false,
      detailsStats: null as any | null,
      detailsStatsLoading: false,
      detailsTab: "overview",
      // null = "All maps" — analysis zone aggregates across the match.
      // When set, the More Stats tabs filter to this map and the clip
      // strip narrows to clips from that map.
      selectedMapId: null as string | null,
    };
  },
  mounted() {
    if (
      (this.player as any)?.steam_id &&
      (this.match as any)?.status === e_match_status_enum.Finished
    ) {
      // Eager-load the full match_stats row (matchAllMapsStats). One
      // query, all fields — powers the inline Overview readout AND
      // the Utility/Trades/Aim tabs when the user expands. The drawer
      // still lazy-fetches its own matchLineupStats on open.
      if (!this.detailsStats && !this.detailsStatsLoading) {
        this.getDetailedStats().catch((err) => {
          console.error("Failed to eager-load player overview stats", err);
        });
      }
      if (this.playerClips.length === 0 && !this.playerClipsLoading) {
        this.getPlayerClips().catch((err) => {
          console.error("Failed to eager-load player clips", err);
        });
      }
    }
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
    async getPlayerClips() {
      const playerSteamId = (this.player as any)?.steam_id;
      if (!playerSteamId || !this.match?.id) return;
      this.playerClipsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: {
            matchId: this.match.id,
            playerId: String(playerSteamId),
          },
          query: generateQuery({
            // Pull the full clip shape so we can render a real
            // HighlightCard (with title link, score/round/duration
            // overlays, target metadata) for the focus player.
            match_clips: [
              {
                limit: 6,
                where: {
                  visibility: { _eq: "public" },
                  match_map: { match_id: { _eq: $("matchId", "uuid!") } },
                  _or: [
                    { user_steam_id: { _eq: $("playerId", "bigint!") } },
                    { target_steam_id: { _eq: $("playerId", "bigint!") } },
                  ],
                },
                order_by: [{}, { created_at: order_by.desc }],
              } as any,
              matchClipFields,
            ],
          } as any),
        });
        this.playerClips = (data as any)?.match_clips ?? [];
      } finally {
        this.playerClipsLoading = false;
      }
    },
    seedPlayerClipQueue() {
      // Click.capture handler: runs before HighlightCard's own
      // openClip on bubble. Seeds the modal queue with whichever clips
      // match the current map filter so prev/next can scrub through
      // them all. Scope is keyed to match + player + selected map so
      // switching contexts replaces the queue cleanly.
      const { setClipQueue } = useClipModal();
      const items = (this.filteredPlayerClips as any[]).map((c: any) => ({
        id: c.id,
        title: c.title ?? null,
        playerName: c.target?.name ?? c.user?.name ?? null,
        teamName: null,
        durationMs: c.duration_ms ?? null,
        thumbnailUrl: c.thumbnail_download_url ?? null,
        posterUrl: c.match_map?.map?.poster ?? null,
      }));
      const scope = `match-${this.match?.id}-player-${(this.player as any)?.steam_id}-map-${this.selectedMapId ?? "all"}`;
      setClipQueue(items, scope);
    },
    async getDetailedStats() {
      this.detailsStatsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: {
            matchId: this.match.id,
            order_by_name: order_by.asc,
          },
          query: generateQuery({
            matches_by_pk: [
              { id: this.match.id },
              {
                lineup_1: [{}, matchAllMapsStats],
                lineup_2: [{}, matchAllMapsStats],
              },
            ],
          }),
        });
        this.detailsStats = (data as any)?.matches_by_pk ?? null;
      } finally {
        this.detailsStatsLoading = false;
      }
    },
    async openDrawer() {
      this.drawerOpen = true;
      if (!this.matchStats && !this.matchStatsLoading) {
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
            (lineupPlayer.steam_id
              ? `Player ${lineupPlayer.steam_id}`
              : "Slot"),
          steam_id: lineupPlayer.steam_id,
        }
      );
    },
    navigateToMatch(matchId: string) {
      this.$router.push({ name: "matches-id", params: { id: matchId } });
    },
    watchStream(stream: any) {
      useApplicationSettingsStore().setGlobalStream({
        ...stream,
        match_id: this.match.id,
      });
    },
    getStreamPlatformIcon(link: string) {
      try {
        const hostname = new URL(link).hostname.toLowerCase();
        if (hostname.endsWith("twitch.tv")) return TwitchIcon;
        if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
          return YouTubeIcon;
        if (hostname.includes("kick.com")) return KickIcon;
      } catch {
        return null;
      }
      return null;
    },
    getTeamInitials(teamName: string): string {
      return teamName
        .split(" ")
        .map((word: string) => word.charAt(0))
        .join("")
        .slice(0, 2);
    },
    getTeamScore(match: any, lineupId: string): string | number {
      if (
        match.status !== e_match_status_enum.Finished &&
        match.status !== e_match_status_enum.Live
      ) {
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
        return this.$t("common.na");
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
        this.match?.is_tournament_match ||
          this.match?.tournament_brackets?.length,
      );
    },
    bestOf(): number {
      return this.match?.options?.best_of ?? 1;
    },
    previewMatchMap(): any | null {
      const maps = this.match?.match_maps ?? [];
      if (maps.length === 0) return null;
      const current = maps.find((mm: any) => mm.is_current_map);
      if (current) return current;
      // Fallback: first map without a winner yet, otherwise the last one.
      return (
        maps.find((mm: any) => !mm.winning_lineup_id) ?? maps[maps.length - 1]
      );
    },
    showSeriesScore(): boolean {
      // BO1 live: hide the meaningless 0/1 series score and show round
      // score in its place. Otherwise (BOX, or non-live BO1) keep the
      // standard series tally.
      if (this.bestOf > 1) return true;
      return this.match?.status !== e_match_status_enum.Live;
    },
    showMapRoundScore(): boolean {
      // Only meaningful while a map is being played.
      if (this.match?.status !== e_match_status_enum.Live) return false;
      return Boolean(this.previewMatchMap);
    },
    isStreamableStatus(): boolean {
      return ![
        e_match_status_enum.Finished,
        e_match_status_enum.Cancelled,
      ].includes(this.match.status);
    },
    clipCount(): number {
      return (this.match?.match_maps || []).reduce(
        (sum: number, mm: any) => sum + (mm.public_clips_count || 0),
        0,
      );
    },
    clipPillClasses(): string {
      return "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/35 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] leading-none text-foreground/80";
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
    watchStreamPillClasses(): string {
      return "inline-flex items-center gap-1.5 rounded-md border border-[hsl(0_85%_55%/0.55)] bg-[hsl(0_85%_50%/0.10)] px-2 py-1 text-xs font-medium leading-none whitespace-nowrap text-[hsl(0_90%_72%)] transition-colors cursor-pointer hover:border-[hsl(0_85%_55%)] hover:bg-[hsl(0_85%_50%/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(0_85%_55%/0.6)]";
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
    lineup1AvatarOverride() {
      return buildLineupAvatarOverride(this.displayedMatchStats.lineup_1);
    },
    lineup2AvatarOverride() {
      return buildLineupAvatarOverride(this.displayedMatchStats.lineup_2);
    },
    focusPlayerSteamId(): string | null {
      return String((this.player as any)?.steam_id ?? "") || null;
    },
    focusPlayerLineupId(): string | null {
      const sid = this.focusPlayerSteamId;
      if (!sid) return null;
      const onL1 = this.lineup1Players.some(
        (lp: any) =>
          String(this.getLineupPlayerDisplayPlayer(lp)?.steam_id ?? "") === sid,
      );
      if (onL1) return this.match.lineup_1_id;
      const onL2 = this.lineup2Players.some(
        (lp: any) =>
          String(this.getLineupPlayerDisplayPlayer(lp)?.steam_id ?? "") === sid,
      );
      if (onL2) return this.match.lineup_2_id;
      return null;
    },
    filteredPlayerClips(): any[] {
      const base = !this.selectedMapId
        ? this.playerClips
        : this.playerClips.filter(
            (c: any) => c.match_map?.id === this.selectedMapId,
          );
      // Best highlight first — most kills wins, shorter duration as
      // tiebreak. Drives which thumbnail surfaces in the single-card
      // strip; the modal queue follows the same order so navigating
      // forward scrubs from "best" to "rest".
      return [...base].sort((a: any, b: any) => {
        const ak = a.kills_count ?? 0;
        const bk = b.kills_count ?? 0;
        if (bk !== ak) return bk - ak;
        const ad = a.duration_ms ?? Number.MAX_SAFE_INTEGER;
        const bd = b.duration_ms ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    },
    hasPlayerAnalysis(): boolean {
      // Show the analysis zone only when this row is in player-focus
      // mode and we actually have stats to render. Otherwise the card
      // looks the same as before.
      return Boolean(
        (this.player as any)?.steam_id &&
          (this.match as any)?.status === e_match_status_enum.Finished,
      );
    },
    focusPlayerLineupDetailed(): any {
      // Returns the focus player's lineup from the detailed-stats fetch
      // with `lineup_players` narrowed to just that player. When a map
      // is selected we also narrow the per-map `match_map_stats` array
      // to ONLY that map's row — the existing Lineup* tabs call
      // `statsFor` which prefers match_map_stats over match_stats, so
      // they automatically render per-map numbers when a map is
      // selected and aggregate when "All" is selected.
      const sid = this.focusPlayerSteamId;
      if (!sid || !this.detailsStats) return null;
      const findPlayer = (lineup: any) =>
        (lineup?.lineup_players || []).find(
          (lp: any) => String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
        );
      const narrowMapStats = (lp: any) => {
        if (!lp?.player) return lp;
        if (!this.selectedMapId) {
          // Use `null` (not `[]`) — LineupOverviewRow.statsFor uses
          // nullish coalescing, so an empty array would override the
          // aggregate `match_stats` fallback and show nothing.
          return {
            ...lp,
            player: { ...lp.player, match_map_stats: null },
          };
        }
        const mapRow = (lp.player?.match_map_stats || []).find(
          (s: any) => s.match_map_id === this.selectedMapId,
        );
        return {
          ...lp,
          player: {
            ...lp.player,
            match_map_stats: mapRow ? [mapRow] : null,
          },
        };
      };
      for (const key of ["lineup_1", "lineup_2"]) {
        const lineup = (this.detailsStats as any)?.[key];
        const player = findPlayer(lineup);
        if (player) {
          return {
            ...lineup,
            lineup_players: [narrowMapStats(player)],
          };
        }
      }
      return null;
    },
    focusPlayerStats(): null | {
      name: string;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      kd: string;
      hsPct: number | null;
      adr: number | null;
    } {
      // Reads from matchAllMapsStats (detailsStats) so we get the full
      // Overview-tier row — kills, deaths, assists, damage, hs%, ADR —
      // from a single fetch. Falls back to matchLineupStats aggregates
      // if detailsStats hasn't loaded yet but the drawer has been
      // opened (which loads matchLineupStats).
      const sid = this.focusPlayerSteamId;
      if (!sid) return null;

      // When a map is selected, prefer that map's row from
      // match_map_stats; otherwise use the aggregate match_stats row.
      const detailedLineups = [
        (this.detailsStats as any)?.lineup_1,
        (this.detailsStats as any)?.lineup_2,
      ];
      for (const lineup of detailedLineups) {
        const lp = (lineup?.lineup_players || []).find(
          (lp: any) => String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
        );
        if (!lp) continue;
        const p = lp.player;
        let s: any | null = null;
        if (this.selectedMapId) {
          s =
            (p?.match_map_stats || []).find(
              (row: any) => row.match_map_id === this.selectedMapId,
            ) || null;
        } else {
          s = (p?.match_stats || [])[0] || null;
        }
        if (!s) continue;
        const kills = s.kills ?? 0;
        const deaths = s.deaths ?? 0;
        const assists = s.assists ?? 0;
        const damage = Math.round(s.damage ?? 0);
        const rounds = s.rounds_played ?? 0;
        const hsPct = kills > 0 ? Math.round((s.hs_kills / kills) * 100) : null;
        const adr = rounds > 0 ? Math.round(damage / rounds) : null;
        if (kills === 0 && deaths === 0 && assists === 0 && damage === 0) {
          return null;
        }
        return {
          name: p?.name ?? "",
          kills,
          deaths,
          assists,
          damage,
          kd: this.getKDRatio(kills, deaths),
          hsPct,
          adr,
        };
      }

      // Fallback to matchLineupStats aggregates (drawer-loaded).
      const findIn = (players: any[]) =>
        players.find(
          (lp: any) =>
            String(this.getLineupPlayerDisplayPlayer(lp)?.steam_id ?? "") ===
            sid,
        );
      const lp = findIn(this.lineup1Players) || findIn(this.lineup2Players);
      if (!lp) return null;
      const p = this.getLineupPlayerDisplayPlayer(lp);
      const kills = p?.kills_aggregate?.aggregate?.count ?? 0;
      const deaths = p?.deaths_aggregate?.aggregate?.count ?? 0;
      const assists = p?.assists_aggregate?.aggregate?.count ?? 0;
      const damage = Math.round(
        p?.damage_dealt_aggregate?.aggregate?.sum?.damage ?? 0,
      );
      if (kills === 0 && deaths === 0 && assists === 0 && damage === 0) {
        return null;
      }
      return {
        name: p?.name ?? "",
        kills,
        deaths,
        assists,
        damage,
        kd: this.getKDRatio(kills, deaths),
        hsPct: null,
        adr: null,
      };
    },
    eloChange(): typeof eloFields {
      const matchType = this.match.options?.type;
      return (
        this.match.elo_changes?.find((ec: any) => ec.type === matchType) ??
        this.match.elo_changes?.at(0)
      );
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
