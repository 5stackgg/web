<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { ChevronDown, ExternalLink, Play, Trophy } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MatchRankBadge from "~/components/MatchRankBadge.vue";
import MatchSourceBadge from "~/components/MatchSourceBadge.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import PlayerMatchScoreboard from "~/components/player/PlayerMatchScoreboard.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import { kdColor, hltvColor } from "~/utils/statTiers";

// Shared grid track template — MUST stay in sync with the header row in
// PlayerMatchesTable.vue so columns line up across every row. Every track
// is a fixed width except MAP (1fr) so the flexible column resolves to the
// same size on every row, keeping the stat columns aligned. The highlight
// thumbnail gets its own fixed column right before RATING, and the chevron
// gets its own slim trailing column.
// OPEN · DATE · TYPE · RESULT · MAP · CLIP · RATING · K/D/A · K/D · ADR · RANK · VIEW
const wideGrid =
  "grid grid-cols-[2.5rem_5rem_6.75rem_8.5rem_minmax(4.5rem,1fr)_3rem_6rem_4.5rem_2.75rem_3.25rem_10rem_2.5rem] items-center gap-x-2";
</script>

<template>
  <div
    :class="[
      'group/row relative overflow-hidden rounded-lg border transition-colors duration-200',
      embedded
        ? 'border-transparent bg-transparent'
        : 'border-border bg-muted/20',
      !embedded &&
        (isFinished
          ? 'cursor-pointer hover:bg-muted/30 hover:border-[hsl(var(--tac-amber)/0.35)]'
          : ''),
    ]"
    :data-scroll-anchor="`match-${match.id}`"
    @click="onRowClick($event)"
    @pointerdown="onRowPointerDown($event)"
  >
    <!-- ===================== WIDE ===================== -->
    <div v-if="!compact" :class="[wideGrid, 'px-3 py-2.5']">
      <!-- OPEN MATCH — explicit jump to the full match page (the row click
           itself only toggles the inline quick overview). Always shown so
           non-finished matches (scheduled/cancelled) remain reachable. -->
      <NuxtLink
        :to="`/matches/${match.id}`"
        class="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]"
        :title="$t('match.open_match')"
        @click.stop
      >
        <ExternalLink class="h-4 w-4" />
      </NuxtLink>

      <!-- DATE -->
      <div class="flex flex-col leading-tight">
        <span class="text-[0.7rem] font-medium text-foreground/90">
          {{ dateLabel }}
        </span>
        <span
          class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
        >
          {{ timeLabel }}
        </span>
      </div>

      <!-- TYPE — full mode name pill; external/imported matches get the
           source (VALVE/FACEIT) tucked into the pill's top-right corner as a
           sub-badge so it reads as "comp, but from Valve" without competing
           for column width. -->
      <div class="flex min-w-0 items-center justify-center">
        <span
          v-if="matchTypeLabel"
          class="relative inline-flex max-w-full items-center rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-foreground/80"
          :title="
            isExternal
              ? $t('player_match.imported_from', {
                  type: matchType,
                  source: sourceLabel,
                })
              : matchType
          "
        >
          <span class="truncate">{{ matchTypeLabel }}</span>
          <span
            v-if="isExternal"
            class="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex items-center rounded-sm border border-[hsl(200_95%_55%/0.5)] bg-[hsl(200_95%_55%/0.18)] px-1 py-px font-mono text-[0.42rem] font-bold uppercase leading-none tracking-[0.06em] text-[hsl(200_95%_72%)] [text-shadow:0_1px_2px_hsl(var(--background)),0_0_2px_hsl(var(--background))]"
          >
            {{ sourceLabel }}
          </span>
        </span>
        <span v-else class="text-muted-foreground">—</span>
      </div>

      <!-- Neutral lists (event, tournament): both sides, each with its score. -->
      <div v-if="neutral" class="grid min-w-0 gap-1">
        <span
          v-for="lineup in lineups"
          :key="lineup.id"
          class="flex min-w-0 items-center gap-1.5 text-[0.7rem] leading-none"
        >
          <img
            v-if="lineupAvatar(lineup)"
            :src="lineupAvatar(lineup)!"
            alt=""
            class="h-3 w-3 shrink-0 rounded-sm object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span
            class="min-w-0 flex-1 truncate font-semibold"
            :class="
              lineupLost(lineup) ? 'text-muted-foreground' : 'text-foreground'
            "
            >{{ lineup.team?.name || lineup.name }}</span
          >
          <MatchLineupScoreDisplay
            v-if="hasScore"
            :match="match"
            :lineup="lineup"
            :halves="false"
            class="font-mono tabular-nums"
          />
        </span>
      </div>

      <!-- RESULT + SCORE — finished matches show the W/L/T badge + score;
           anything else (scheduled/cancelled/live) shows only the status. The
           opponent TEAM (real teams only — never pugs) tucks under the score. -->
      <div v-else class="flex min-w-0 flex-col justify-center gap-0.5">
        <span
          v-if="isFinished"
          class="font-mono text-sm font-bold leading-none tabular-nums"
        >
          <span :class="scoreClass">{{ score.player }}</span>
          <span class="mx-1 text-muted-foreground/60">:</span>
          <span class="text-muted-foreground/90">{{ score.opponent }}</span>
        </span>
        <MatchStatus v-else :match="match" class="self-start" />
        <span
          v-if="opponentTeam"
          class="flex min-w-0 items-center gap-1"
          :title="$t('common.vs_team', { name: opponentTeam.name })"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-muted-foreground/50"
            >{{ $t("common.vs") }}</span
          >
          <img
            v-if="opponentTeam.avatarSrc"
            :src="opponentTeam.avatarSrc"
            alt=""
            class="h-3 w-3 shrink-0 rounded-sm object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span class="min-w-0 truncate text-[0.6rem] text-foreground/75">{{
            opponentTeam.name
          }}</span>
        </span>
      </div>

      <!-- MAP -->
      <div class="flex min-w-0 items-center gap-2">
        <img
          v-if="mapInfo.patch"
          :src="mapInfo.patch"
          :alt="mapInfo.name"
          class="h-5 w-5 shrink-0"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span class="min-w-0 truncate text-xs text-foreground/85">
          {{ mapInfo.label }}
        </span>
        <Trophy
          v-if="isTournamentMatch"
          class="h-3 w-3 shrink-0 text-[hsl(var(--tac-amber))]/80"
          :title="tournamentLabel"
        />
      </div>

      <!-- HIGHLIGHT — own fixed column, sits right beside the rating. -->
      <button
        v-if="bestClip"
        type="button"
        class="group/clip relative h-7 w-full overflow-hidden rounded-md border border-border/70 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)]"
        :title="bestClip.title || $t('common.highlights')"
        @click.stop="openBestClip"
      >
        <img
          v-if="bestClip.thumbnail_download_url"
          :src="bestClip.thumbnail_download_url"
          alt=""
          class="h-full w-full object-cover"
        />
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover/clip:bg-black/15"
        >
          <Play class="h-3 w-3 fill-white text-white" />
        </span>
        <span
          v-if="playerClips.length > 1"
          class="absolute right-0 top-0 bg-black/70 px-0.5 font-mono text-[0.5rem] font-bold leading-none text-white"
        >
          {{ playerClips.length }}
        </span>
      </button>
      <span v-else />

      <!-- A neutral row's unfinished match has no stats: its status sits
           where they would. -->
      <div v-if="neutral && !isFinished" class="col-span-4 flex justify-center">
        <MatchStatus :match="match" />
      </div>
      <template v-else>
        <!-- RATING (HLTV) — the headline per-match number, so it runs a touch
             larger than the other stats and is centered in its column to sit
             evenly between the clip thumbnail and the K/D/A block. -->
        <span
          v-if="isFinished && rating !== null"
          class="font-mono text-base font-bold tabular-nums inline-flex items-center justify-center gap-0.5"
          :style="{ color: hltvColor(rating) }"
        >
          {{ rating.toFixed(2) }}
        </span>
        <span v-else class="text-center text-muted-foreground">—</span>

        <!-- K / D / A -->
        <div
          v-if="isFinished && stats"
          class="font-mono text-xs tabular-nums text-foreground/90"
        >
          {{ stats.kills }}<span class="mx-0.5 text-muted-foreground/50">/</span
          >{{ stats.deaths
          }}<span class="mx-0.5 text-muted-foreground/50">/</span
          >{{ stats.assists }}
        </div>
        <span v-else class="text-muted-foreground">—</span>

        <!-- K/D -->
        <span
          v-if="isFinished && kd !== null"
          class="font-mono text-xs font-semibold tabular-nums inline-flex items-center gap-0.5"
          :style="{ color: kdColor(kd) }"
        >
          {{ kd.toFixed(2) }}
        </span>
        <span v-else class="text-muted-foreground">—</span>

        <!-- ADR -->
        <span
          v-if="isFinished && adr !== null"
          class="font-mono text-xs tabular-nums text-foreground/85"
        >
          {{ adr.toFixed(1) }}
        </span>
        <span v-else class="text-muted-foreground">—</span>
      </template>

      <!-- MVP — whose line the stat columns show in a neutral list. -->
      <div
        v-if="neutral"
        class="flex min-w-0 items-center justify-end gap-1.5"
        :title="topPlayer?.name"
      >
        <template v-if="isFinished && topPlayer">
          <img
            v-if="topPlayer.avatar_url"
            :src="topPlayer.avatar_url"
            alt=""
            class="h-6 w-6 shrink-0 rounded-full object-cover"
          />
          <span class="min-w-0 truncate text-xs font-medium text-foreground/90">
            {{ topPlayer.name }}
          </span>
        </template>
        <span v-else class="text-muted-foreground">—</span>
      </div>

      <!-- RANK — the rank this match moved, in its own system (5Stack ELO
           tier, Premier, FACEIT, Valve skill group). -->
      <div v-else-if="teamId" class="flex items-center justify-end gap-1.5">
        <span v-if="teamPlayers.length" class="flex -space-x-1.5">
          <template
            v-for="teamPlayer in teamPlayers.slice(0, 5)"
            :key="teamPlayer.steam_id"
          >
            <img
              v-if="teamPlayer.avatar_url"
              :src="teamPlayer.avatar_url"
              :alt="teamPlayer.name"
              :title="teamPlayer.name"
              class="h-6 w-6 rounded-full object-cover ring-2 ring-background"
            />
            <span
              v-else
              :title="teamPlayer.name"
              class="inline-grid h-6 w-6 place-items-center rounded-full bg-muted text-[0.6rem] font-bold uppercase ring-2 ring-background"
              >{{ teamPlayer.name?.slice(0, 1) }}</span
            >
          </template>
        </span>
        <span
          v-if="teamPlayers.length > 5"
          class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >+{{ teamPlayers.length - 5 }}</span
        >
        <span v-if="!teamPlayers.length" class="text-muted-foreground">—</span>
      </div>
      <div v-else class="flex items-center justify-end">
        <MatchRankBadge
          v-if="rankMove"
          :kind="rankMove.kind"
          :value="rankMove.value"
          :change="rankMove.change"
          :faceit-level="rankMove.faceitLevel"
          :elo-change="rankMove.eloChange"
        />
        <span v-else class="text-muted-foreground">—</span>
      </div>

      <!-- QUICK VIEW — explicit toggle for the inline stats overview
           (clicking anywhere on the row also toggles it). -->
      <button
        v-if="isFinished"
        type="button"
        class="flex h-9 w-9 flex-col items-center justify-center gap-0.5 justify-self-end rounded-md border transition-colors"
        :class="
          expanded
            ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
            : 'border-border/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]'
        "
        :title="$t('ui_extras.quick_overview')"
        :aria-expanded="expanded"
        @pointerdown="prefetchDetails"
        @click.stop="toggleExpanded()"
      >
        <ChevronDown
          class="h-3.5 w-3.5 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
          :class="{ 'rotate-180': expanded }"
        />
        <span
          class="font-mono text-[0.45rem] font-bold uppercase tracking-[0.1em] leading-none"
        >
          {{ $t("player_match.view_short") }}
        </span>
      </button>
      <span v-else />
    </div>

    <!-- ===================== COMPACT ===================== -->
    <div v-else class="px-3 py-2.5">
      <div class="flex items-center gap-2">
        <div v-if="neutral" class="grid min-w-0 flex-1 gap-1.5">
          <span
            v-for="lineup in lineups"
            :key="lineup.id"
            class="flex min-w-0 items-center gap-1.5 text-sm leading-none"
          >
            <img
              v-if="lineupAvatar(lineup)"
              :src="lineupAvatar(lineup)!"
              alt=""
              class="h-4 w-4 shrink-0 rounded-sm object-cover"
              @error="
                ($event.target as HTMLImageElement).style.display = 'none'
              "
            />
            <span
              class="min-w-0 truncate font-semibold"
              :class="
                lineupLost(lineup) ? 'text-muted-foreground' : 'text-foreground'
              "
              >{{ lineup.team?.name || lineup.name }}</span
            >
            <MatchLineupScoreDisplay
              v-if="hasScore"
              :match="match"
              :lineup="lineup"
              :halves="false"
              class="font-mono tabular-nums"
            />
          </span>
        </div>
        <template v-else-if="isFinished">
          <span class="font-mono text-base font-bold leading-none tabular-nums">
            <span :class="scoreClass">{{ score.player }}</span>
            <span class="mx-0.5 text-muted-foreground/60">:</span>
            <span class="text-muted-foreground/90">{{ score.opponent }}</span>
          </span>
          <!-- Rank this match moved, paired with the score as the outcome. -->
          <MatchRankBadge
            v-if="rankMove"
            :kind="rankMove.kind"
            :value="rankMove.value"
            :change="rankMove.change"
            :faceit-level="rankMove.faceitLevel"
            :elo-change="rankMove.eloChange"
          />
        </template>
        <MatchStatus v-else :match="match" />

        <div
          class="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground"
        >
          <MatchStatus v-if="neutral && !isFinished" :match="match" />
          <MatchSourceBadge :source="match.source" />
          <Trophy
            v-if="isTournamentMatch"
            class="h-3 w-3 text-[hsl(var(--tac-amber))]/80"
          />
          <TimeAgo
            class="font-mono text-[0.6rem] tracking-[0.04em]"
            :date="matchDate"
          />
        </div>
      </div>

      <!-- Opponent TEAM — real teams only (pugs render nothing here). -->
      <div
        v-if="opponentTeam"
        class="mt-1.5 flex min-w-0 items-center gap-1.5"
        :title="$t('common.vs_team', { name: opponentTeam.name })"
      >
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/50"
          >{{ $t("common.vs") }}</span
        >
        <img
          v-if="opponentTeam.avatarSrc"
          :src="opponentTeam.avatarSrc"
          alt=""
          class="h-4 w-4 shrink-0 rounded-sm object-cover"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span class="min-w-0 truncate text-xs font-medium text-foreground/85">{{
          opponentTeam.name
        }}</span>
      </div>

      <div class="mt-2 flex items-center gap-2">
        <img
          v-if="mapInfo.patch"
          :src="mapInfo.patch"
          :alt="mapInfo.name"
          class="h-6 w-6 shrink-0"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span class="min-w-0 truncate text-sm font-medium text-foreground/85">
          {{ mapInfo.label }}
        </span>
        <button
          v-if="bestClip"
          type="button"
          class="group/clip relative ml-auto h-9 w-16 shrink-0 overflow-hidden rounded-md border border-border/70 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)]"
          :title="bestClip.title || $t('common.highlights')"
          @click.stop="openBestClip"
        >
          <img
            v-if="bestClip.thumbnail_download_url"
            :src="bestClip.thumbnail_download_url"
            alt=""
            class="h-full w-full object-cover"
          />
          <span
            class="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover/clip:bg-black/15"
          >
            <Play class="h-3.5 w-3.5 fill-white text-white" />
          </span>
          <span
            v-if="playerClips.length > 1"
            class="absolute right-0 top-0 bg-black/70 px-0.5 font-mono text-[0.5rem] font-bold leading-none text-white"
          >
            {{ playerClips.length }}
          </span>
        </button>
      </div>

      <div
        v-if="neutral && isFinished && stats && topPlayer"
        class="mt-2.5 flex min-w-0 items-center gap-1.5"
      >
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/60"
          >{{ $t("awards.mvp") }}</span
        >
        <img
          v-if="topPlayer.avatar_url"
          :src="topPlayer.avatar_url"
          alt=""
          class="h-4 w-4 shrink-0 rounded-full object-cover"
        />
        <span class="min-w-0 truncate text-xs font-medium text-foreground/85">{{
          topPlayer.name
        }}</span>
      </div>

      <!-- Performance readout — a divided gauge strip so the per-match stats
           read at a glance instead of as a muted sentence. Labels sit small
           above bold, tone-colored values (RTG/K-D inherit the app ramp). -->
      <div
        v-if="isFinished && stats"
        class="mt-2.5 grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border/50 bg-border/40"
      >
        <div
          class="flex flex-col items-center justify-center gap-0.5 bg-card/60 py-1.5"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground/60"
            ><StatLabel stat="hltv"
              ><span class="-mx-3 -my-2 px-3 py-2">RTG</span></StatLabel
            ></span
          >
          <span
            class="font-mono text-sm font-bold tabular-nums"
            :style="rating !== null ? { color: hltvColor(rating) } : undefined"
            >{{ rating !== null ? rating.toFixed(2) : "—" }}</span
          >
        </div>
        <div
          class="flex flex-col items-center justify-center gap-0.5 bg-card/60 py-1.5"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground/60"
            >K/D/A</span
          >
          <span
            class="font-mono text-[0.8rem] font-semibold tabular-nums text-foreground/90"
            >{{ stats.kills }}<span class="text-muted-foreground/40">/</span
            >{{ stats.deaths }}<span class="text-muted-foreground/40">/</span
            >{{ stats.assists }}</span
          >
        </div>
        <div
          class="flex flex-col items-center justify-center gap-0.5 bg-card/60 py-1.5"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground/60"
            ><StatLabel stat="kd"
              ><span class="-mx-3 -my-2 px-3 py-2">K/D</span></StatLabel
            ></span
          >
          <span
            class="font-mono text-sm font-bold tabular-nums"
            :style="kd !== null ? { color: kdColor(kd) } : undefined"
            >{{ kd !== null ? kd.toFixed(2) : "—" }}</span
          >
        </div>
        <div
          class="flex flex-col items-center justify-center gap-0.5 bg-card/60 py-1.5"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground/60"
            ><StatLabel stat="adr"
              ><span class="-mx-3 -my-2 px-3 py-2">ADR</span></StatLabel
            ></span
          >
          <span
            class="font-mono text-sm font-bold tabular-nums text-foreground/85"
            >{{ adr !== null ? adr.toFixed(0) : "—" }}</span
          >
        </div>
      </div>

      <div v-if="isFinished" class="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] transition-colors"
          :class="
            expanded
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
              : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]'
          "
          :aria-expanded="expanded"
          @pointerdown="prefetchDetails"
          @click.stop="toggleExpanded()"
        >
          <ChevronDown
            class="h-3.5 w-3.5 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
            :class="{ 'rotate-180': expanded }"
          />
          {{ expanded ? $t("common.close") : $t("ui_extras.quick_overview") }}
        </button>
        <NuxtLink
          :to="`/matches/${match.id}`"
          class="inline-flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]"
          @click.stop
        >
          <ExternalLink class="h-3.5 w-3.5" />
          {{ $t("match.open_match") }}
        </NuxtLink>
      </div>
      <div v-else class="mt-2.5">
        <NuxtLink
          :to="`/matches/${match.id}`"
          class="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]"
          @click.stop
        >
          <ExternalLink class="h-3.5 w-3.5" />
          {{ $t("match.open_match") }}
        </NuxtLink>
      </div>
    </div>

    <!-- ===================== EXPANDED DETAIL ===================== -->
    <!-- Opens at full height in one frame and reveals with opacity/transform
         only (compositor work), while the page scrolls the row into view — a
         height tween over a freshly mounting lobby table stutters. Closing
         folds the height shut: nothing mounts then. -->
    <Transition
      enter-active-class="unfurl-enter"
      leave-active-class="unfurl-leave"
      leave-to-class="unfurl-closed"
    >
      <div
        v-if="expanded && isFinished"
        class="grid grid-cols-[minmax(0,1fr)] grid-rows-[1fr]"
      >
        <div class="unfurl-cell min-h-0 min-w-0">
          <div
            class="border-t border-border bg-card/40 px-3 py-3"
            :class="compact ? '' : 'sm:px-4'"
            @click.stop
          >
            <PlayerMatchScoreboard
              :match="scoreboardMatch"
              :focus-steam-id="playerSteamId"
              :focus-lineup-id="teamId ? focusLineupId : null"
              :loading="detailsStatsLoading"
              :active-tab="detailsTab"
              :selected-map-id="selectedMapId"
              :match-ranks="matchRanks"
              :rank-move="rankMove"
              :season-best="seasonBest"
              :score="score"
              :result="result"
              :type-label="matchTypeLabel"
              :source-label="sourceLabel || $t('player_match.source.internal')"
              :clips-count="playerClips.length"
              :compact="compact"
              @update:active-tab="(v) => (detailsTab = v)"
              @update:selected-map-id="(v) => (selectedMapId = v)"
              @open-clips="openBestClip"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchAllMapsStatsWithoutElo } from "~/graphql/matchAllMapsStatsGraphql";
import { eloFields } from "~/graphql/eloFields";
import { matchClipFields } from "~/graphql/matchClip";
import { $, order_by } from "~/generated/zeus";
import { useClipModal } from "~/composables/useClipModal";
import mapLabel from "~/utilities/mapLabel";
import { csRankKind } from "~/utilities/csRank";
import type { MatchRankMove } from "~/components/MatchRankBadge.vue";
import {
  EXPANDED_MATCH_ROWS,
  type ExpandedMatchRows,
} from "~/composables/useExpandedMatchRows";

// Breathing room kept between an opened row and the scroller's edges.
const REVEAL_MARGIN = 16;

// A finished match never changes, so each expand query is answered once per
// session: reopening a row, or restoring it on back, renders straight away.
const DETAILS_CACHE_SIZE = 40;
const detailsCache = new Map<
  string,
  { stats: any; ranks: Record<string, any> }
>();

function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return null;
}

export default {
  props: {
    match: { type: Object, required: true },
    player: { type: Object, required: false, default: null },
    compact: { type: Boolean, default: false },
    embedded: { type: Boolean, default: false },
    // match_id -> { rankType, rank, change } for external Valve matches with no
    // internal elo. Lets the RANK column show the CS Rating (Premier) or skill
    // group (Competitive/Wingman) + change instead.
    rankByMatch: { type: Object, required: false, default: null },
    // match_id -> { elo, level, change } for imported FACEIT matches.
    faceitByMatch: { type: Object, required: false, default: null },
    // Season label when this match set that season's best rating.
    seasonBest: { type: String, required: false, default: null },
    // Canonical per-match HLTV rating from the backend; overrides the local
    // estimate below (which can't include KAST at this level).
    canonicalRating: { type: Number, required: false, default: null },
    // Focus player's aggregate stats for this match, batched by the parent
    // page. Powers the collapsed row without a per-row matches_by_pk query.
    collapsedAgg: { type: Object, required: false, default: null },
    // Team mode: the row reads from this team's lineup instead of a player's,
    // and collapsedAgg / canonicalRating carry the team's numbers.
    teamId: { type: String, required: false, default: null },
    // Neutral mode (event, tournament lists): no side to read from, so the
    // row shows both lineups and collapsedAgg / canonicalRating carry the
    // match's top player.
    neutral: { type: Boolean, default: false },
    topPlayer: { type: Object, required: false, default: null },
  },
  // The profile page's open rows (restored on back); null in the right hub.
  inject: {
    expandedRows: { from: EXPANDED_MATCH_ROWS, default: null },
  },
  data() {
    const saved = (this.expandedRows as ExpandedMatchRows | null)?.[
      this.match.id
    ];
    const cached = detailsCache.get(String(this.match.id));
    return {
      expanded: !!saved,
      detailsPromise: null as Promise<void> | null,
      detailsStats: (cached?.stats ?? null) as any | null,
      // steam_id -> per-match Valve rank for the lobby (external matches).
      matchRanks: (cached?.ranks ?? {}) as Record<string, any>,
      detailsStatsLoading: false,
      detailsTab: saved?.tab ?? "overview",
      selectedMapId: (saved?.mapId ?? null) as string | null,
      playerClips: [] as any[],
      playerClipsLoading: false,
    };
  },
  created() {
    const rows = this.expandedRows as ExpandedMatchRows | null;
    if (!rows) return;
    this.$watch(
      () => [this.expanded, this.detailsTab, this.selectedMapId],
      () => {
        if (this.expanded) {
          rows[this.match.id] = {
            tab: this.detailsTab,
            mapId: this.selectedMapId,
          };
        } else {
          delete rows[this.match.id];
        }
      },
    );
  },
  beforeUnmount() {
    const rows = this.expandedRows as ExpandedMatchRows | null;
    if (rows) delete rows[this.match.id];
  },
  mounted() {
    // Reopened by a back navigation: load what it shows, without the reveal
    // scroll — the page is putting the scroll back where it was.
    if (this.expanded) this.prefetchDetails();
    // Collapsed-row aggregate stats now arrive batched via the `collapsedAgg`
    // prop (parent fetches them for the whole page in one query). Only the
    // highlight thumbnail still needs a fetch, and only for matches that
    // actually have clips — the heavy round-level + per-map + all-players
    // query stays deferred to first expand (getDetailedStats).
    if (this.isFinished && this.clipSteamIds.length && this.hasClips) {
      if (this.playerClips.length === 0 && !this.playerClipsLoading) {
        this.getPlayerClips().catch(() => {});
      }
    }
  },
  computed: {
    isFinished(): boolean {
      return this.match?.status === e_match_status_enum.Finished;
    },
    hasScore(): boolean {
      return this.isFinished || this.match?.status === e_match_status_enum.Live;
    },
    lineups(): any[] {
      return [this.match?.lineup_1, this.match?.lineup_2].filter(Boolean);
    },
    // Whether any map in this match has clips — gates the clip fetch so
    // clip-less matches (the majority) make zero clip requests. Counts every
    // visibility: clips rendered from the match page default to private, and
    // the viewer may be allowed to see them (Hasura decides which come back).
    hasClips(): boolean {
      return (this.match?.match_maps || []).some(
        (mm: any) => (mm?.clips_count ?? mm?.public_clips_count ?? 0) > 0,
      );
    },
    // The row's match (simpleMatchFields) overlaid with the expand query's
    // full lineups and every player's elo_changes row, for the scoreboard.
    scoreboardMatch(): any {
      const d = this.detailsStats as any;
      if (!d) return this.match;
      return {
        ...this.match,
        lineup_1: d.lineup_1 ?? this.match?.lineup_1,
        lineup_2: d.lineup_2 ?? this.match?.lineup_2,
        elo_changes: d.elo_changes ?? [],
      };
    },
    playerSteamId(): string | null {
      return String((this.player as any)?.steam_id ?? "") || null;
    },
    eloChange(): any {
      const matchType = this.match?.options?.type;
      const changes = this.match?.elo_changes ?? [];
      return (
        changes.find((ec: any) => ec.type === matchType) ?? changes[0] ?? null
      );
    },
    eloAfter(): number | null {
      const raw = this.eloChange?.updated_elo;
      const after = raw == null ? NaN : Number(raw);
      return Number.isFinite(after) ? Math.round(after) : null;
    },
    // Mirrors EloChangeBadge's own render guard so the ELO column shows a
    // dash (instead of nothing) for matches with no elo movement / no row.
    hasElo(): boolean {
      if (!this.isFinished || !this.eloChange) return false;
      const c = Number(this.eloChange.elo_change);
      return Number.isFinite(c) && c !== 0;
    },
    // Per-match Valve rank for external matches (no internal elo): Premier CS
    // Rating or Competitive/Wingman skill group.
    rankInfo(): { rankType: number; rank: number; change: number } | null {
      const m = (this.rankByMatch as any)?.[this.match?.id];
      return m && Number.isFinite(m.rank) ? m : null;
    },
    // Per-match FACEIT ELO + level for imported FACEIT matches.
    faceitInfo(): { elo: number; level: number | null; change: number } | null {
      const m = (this.faceitByMatch as any)?.[this.match?.id];
      return m && Number.isFinite(m.elo) ? m : null;
    },
    // The rank this match moved, in the system it was played on.
    rankMove(): MatchRankMove | null {
      if (this.hasElo && this.eloAfter !== null) {
        return {
          kind: "elo",
          value: this.eloAfter,
          change: Number(this.eloChange.elo_change),
          eloChange: this.eloChange,
        };
      }
      const valve = this.rankInfo;
      const kind = valve ? csRankKind(valve.rankType) : null;
      if (valve && kind) {
        return { kind, value: valve.rank, change: valve.change };
      }
      const faceit = this.faceitInfo;
      if (faceit) {
        return {
          kind: "faceit",
          value: faceit.elo,
          change: faceit.change,
          faceitLevel: faceit.level,
        };
      }
      return null;
    },
    apiDomain(): string {
      return useRuntimeConfig().public.apiDomain as string;
    },
    // The lineup the focus player is NOT on. Mirrors the score's orientation
    // (player defaults to lineup_1) when their lineup can't be resolved.
    opponentLineup(): any | null {
      const mine = this.focusLineupId;
      const l1 = this.match?.lineup_1 ?? null;
      const l2 = this.match?.lineup_2 ?? null;
      if (mine && this.match?.lineup_2_id === mine) return l1;
      return l2;
    },
    // Only a REAL team (team_id set) is worth surfacing — pug lineups carry an
    // auto-generated name and no team, so this stays null for them and the
    // opponent UI simply doesn't render (zero space cost in the common case).
    opponentTeam(): {
      name: string;
      shortName: string | null;
      avatarSrc: string | null;
    } | null {
      const lu = this.neutral ? null : this.opponentLineup;
      // A team's opponent is always context, pickup lineup or not.
      if (!lu || (lu.team_id == null && !this.teamId)) return null;
      const name = lu.team?.name || lu.name || null;
      // A pickup's generated "Team 1" / "Team 2" says nothing about who
      // was played.
      if (!name || (lu.team_id == null && /^Team [12]$/.test(name))) {
        return null;
      }
      const url = lu.team?.avatar_url;
      return {
        name,
        shortName: lu.team?.short_name || null,
        avatarSrc: url ? `https://${this.apiDomain}/${url}` : null,
      };
    },
    // The lineup the row reads from: the team's in team mode, lineup 1 in a
    // neutral list, else the player's.
    focusLineupId(): string | null {
      if (this.neutral) return this.match?.lineup_1_id ?? null;
      return this.teamId ? this.teamLineupId : this.playerLineupId;
    },
    // The team's lineup by team_id, else by the tournament bracket side.
    teamLineupId(): string | null {
      const teamId = this.teamId;
      if (!teamId) return null;
      if (this.match?.lineup_1?.team_id === teamId)
        return this.match.lineup_1_id;
      if (this.match?.lineup_2?.team_id === teamId)
        return this.match.lineup_2_id;
      const bracket = this.match?.tournament_brackets?.[0];
      if (bracket?.team_1?.team_id === teamId) return this.match.lineup_1_id;
      if (bracket?.team_2?.team_id === teamId) return this.match.lineup_2_id;
      return null;
    },
    teamLineup(): any | null {
      const id = this.teamLineupId;
      if (!id) return null;
      return this.match?.lineup_1_id === id
        ? this.match?.lineup_1
        : this.match?.lineup_2;
    },
    // Who played for the team, for the RANK column's team-mode avatars.
    teamPlayers(): any[] {
      return (this.teamLineup?.lineup_players ?? [])
        .map((lp: any) => lp.player)
        .filter(Boolean);
    },
    // Whose clips the row shows: the player, everyone on the team's side, or
    // everyone in a neutral list's match.
    clipSteamIds(): string[] {
      if (!this.teamId && !this.neutral) {
        return this.playerSteamId ? [this.playerSteamId] : [];
      }
      const lineups = this.neutral ? this.lineups : [this.teamLineup];
      return lineups
        .flatMap((lineup: any) => lineup?.lineup_players ?? [])
        .map((lp: any) => String(lp.steam_id ?? lp.player?.steam_id ?? ""))
        .filter(Boolean);
    },
    playerLineupId(): string | null {
      const sid = this.playerSteamId;
      if (!sid) return null;
      const onL1 = this.match?.lineup_1?.lineup_players?.some(
        (lp: any) => String(lp.steam_id ?? lp.player?.steam_id ?? "") === sid,
      );
      if (onL1) return this.match.lineup_1_id;
      const onL2 = this.match?.lineup_2?.lineup_players?.some(
        (lp: any) => String(lp.steam_id ?? lp.player?.steam_id ?? "") === sid,
      );
      if (onL2) return this.match.lineup_2_id;
      return null;
    },
    // won | lost | tied — derived from the player's elo row when present,
    // falling back to comparing the winning lineup with the player's lineup.
    result(): "won" | "lost" | "tied" | null {
      const r =
        this.teamId || this.neutral
          ? ""
          : (this.eloChange?.match_result ?? "").toLowerCase();
      if (r === "won" || r === "win") return "won";
      if (r === "lost" || r === "loss") return "lost";
      if (r === "tied" || r === "tie" || r === "draw") return "tied";
      const winner = this.match?.winning_lineup_id;
      const mine = this.focusLineupId;
      if (!this.isFinished || !mine) return null;
      if (!winner) return "tied";
      return winner === mine ? "won" : "lost";
    },
    scoreClass(): string {
      if (this.result === "won") return "text-[hsl(142_71%_60%)]";
      if (this.result === "lost") return "text-[hsl(0_84%_66%)]";
      return "text-foreground";
    },
    // Round score for a single map; series (maps won) for a best-of-X,
    // always oriented player-first.
    score(): { player: number; opponent: number } {
      const maps = this.match?.match_maps ?? [];
      const mine = this.focusLineupId;
      const l1 = this.match?.lineup_1_id;
      if (maps.length === 1) {
        const mm = maps[0];
        const l1s = mm.lineup_1_score ?? 0;
        const l2s = mm.lineup_2_score ?? 0;
        if (mine && mine !== l1) return { player: l2s, opponent: l1s };
        return { player: l1s, opponent: l2s };
      }
      let mineWins = 0;
      let oppWins = 0;
      for (const mm of maps) {
        if (!mm.winning_lineup_id) continue;
        if (mm.winning_lineup_id === mine) mineWins++;
        else oppWins++;
      }
      return { player: mineWins, opponent: oppWins };
    },
    mapInfo(): { name: string; label: string; patch: string | null } {
      const maps = this.match?.match_maps ?? [];
      if (maps.length === 0)
        return { name: "", label: this.$t("common.na"), patch: null };
      if (maps.length === 1) {
        const m = maps[0].map ?? {};
        return {
          name: m.name ?? "",
          label: mapLabel(m),
          patch: m.patch ?? null,
        };
      }
      // Best-of-X: lead with the count rather than a single map name.
      return {
        name: "",
        label: this.$t("player_match.maps_count", { count: maps.length }),
        patch: maps[0]?.map?.patch ?? null,
      };
    },
    // Total rounds across every played map — denominator for ADR / rating
    // when a match_stats row doesn't carry its own rounds_played.
    totalRounds(): number {
      return (this.match?.match_maps ?? []).reduce(
        (sum: number, mm: any) =>
          sum + (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0),
        0,
      );
    },
    // The focus player's aggregate (all-maps) match_stats row from the
    // eager-loaded detailed fetch. This is the source the expanded Overview
    // reads from, so the collapsed numbers match it exactly — and it works
    // even for matches that never produced an elo_changes row (unranked).
    focusStatRow(): any | null {
      const sid = this.playerSteamId;
      // Once expanded, prefer the heavy detailed fetch (per-map rows). Until
      // then use the page-batched aggregate (collapsedAgg) — same flat shape
      // (kills/deaths/assists/damage/rounds_played), no per-row query.
      const source = this.detailsStats;
      if (sid && source) {
        for (const key of ["lineup_1", "lineup_2"]) {
          const lineup = (source as any)?.[key];
          const lp = (lineup?.lineup_players || []).find(
            (lp: any) =>
              String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
          );
          if (lp) {
            const arr = lp.player?.match_stats;
            return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
          }
        }
      }
      return this.collapsedAgg ?? null;
    },
    playerStats(): {
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      rounds: number;
    } | null {
      const s = this.focusStatRow;
      if (!s) return null;
      return {
        kills: Number(s.kills ?? 0),
        deaths: Number(s.deaths ?? 0),
        assists: Number(s.assists ?? 0),
        damage: Number(s.damage ?? 0),
        rounds: Number(s.rounds_played ?? 0) || this.totalRounds,
      };
    },
    // K/D/A — prefer the loaded match_stats, fall back to the elo row when
    // present. null until something is available (renders "—").
    stats(): { kills: number; deaths: number; assists: number } | null {
      const ps = this.playerStats;
      if (ps)
        return { kills: ps.kills, deaths: ps.deaths, assists: ps.assists };
      const e = this.eloChange;
      if (e)
        return {
          kills: Number(e.kills ?? 0),
          deaths: Number(e.deaths ?? 0),
          assists: Number(e.assists ?? 0),
        };
      return null;
    },
    kd(): number | null {
      const s = this.stats;
      if (!s) return null;
      return s.deaths > 0 ? s.kills / s.deaths : s.kills;
    },
    adr(): number | null {
      const ps = this.playerStats;
      if (ps && ps.rounds > 0) return ps.damage / ps.rounds;
      const dmg = Number(this.eloChange?.damage ?? 0);
      if (dmg && this.totalRounds > 0) return dmg / this.totalRounds;
      return null;
    },
    // HLTV 2.0-style rating — identical formula to LineupOverview's `hltvFor`
    // so the column agrees with the expanded Overview's HLTV cell. KAST is
    // omitted (no per-round data at this level) exactly as that view does.
    rating(): number | null {
      if (this.canonicalRating != null) {
        return this.canonicalRating;
      }
      const ps = this.playerStats;
      if (!ps || ps.rounds <= 0) return null;
      const kpr = ps.kills / ps.rounds;
      const dpr = ps.deaths / ps.rounds;
      const apr = ps.assists / ps.rounds;
      const adr = ps.damage / ps.rounds;
      const impact = 2.13 * kpr + 0.42 * apr - 0.41;
      return (
        0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587
      );
    },
    bestClip(): any | null {
      return this.filteredPlayerClips[0] ?? null;
    },
    matchDate(): string | null {
      return (
        this.match?.started_at ??
        this.match?.scheduled_at ??
        this.match?.created_at ??
        null
      );
    },
    dateLabel(): string {
      const d = new Date(this.matchDate);
      return d.toLocaleDateString(dateLocale(), {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    },
    timeLabel(): string {
      const d = new Date(this.matchDate);
      return d.toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    matchType(): string | null {
      return this.match?.options?.type ?? null;
    },
    matchTypeLabel(): string {
      const t = this.matchType;
      if (!t) return "";
      const full: Record<string, string> = {
        Competitive: this.$t("pages.leaderboard.match_types.competitive"),
        Wingman: this.$t("pages.leaderboard.match_types.wingman"),
        Premier: "Premier",
        Faceit: "Faceit",
        Duel: this.$t("pages.leaderboard.match_types.duel"),
        Rush: this.$t("pages.leaderboard.match_types.rush"),
        Scrimmage: this.$t("pages.leaderboard.match_types.scrimmage"),
      };
      return full[t] ?? String(t);
    },
    // Imported from outside 5stack (e.g. Valve / Faceit match history).
    isExternal(): boolean {
      return !!this.match?.source && this.match.source !== "5stack";
    },
    sourceLabel(): string {
      const s = this.match?.source;
      if (!s || s === "5stack") return "";
      const map: Record<string, string> = { valve: "VALVE", faceit: "FACEIT" };
      return map[s] ?? String(s).toUpperCase();
    },
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
    filteredPlayerClips(): any[] {
      const base = !this.selectedMapId
        ? this.playerClips
        : this.playerClips.filter(
            (c: any) => c.match_map?.id === this.selectedMapId,
          );
      return [...base].sort((a: any, b: any) => {
        const ak = a.kills_count ?? 0;
        const bk = b.kills_count ?? 0;
        if (bk !== ak) return bk - ak;
        const ad = a.duration_ms ?? Number.MAX_SAFE_INTEGER;
        const bd = b.duration_ms ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    },
  },
  methods: {
    lineupAvatar(lineup: any): string | null {
      const url = lineup?.team?.avatar_url;
      return url ? `https://${this.apiDomain}/${url}` : null;
    },
    lineupLost(lineup: any): boolean {
      const winner = this.match?.winning_lineup_id;
      return this.isFinished && !!winner && winner !== lineup?.id;
    },
    // Row click: on mobile (compact) jump straight to the match page; on the
    // wide table it toggles the inline quick overview. The dedicated QUICK
    // OVERVIEW / OPEN MATCH buttons (which @click.stop) still work either way.
    onRowClick(event: MouseEvent) {
      if (!this.isFinished) return;
      if (event) {
        const el = event.target as HTMLElement | null;
        if (el?.closest("a,button")) return;
      }
      if (this.compact) {
        navigateTo(`/matches/${this.match.id}`);
        return;
      }
      this.toggleExpanded(event);
    },
    // The scoreboard query starts on pointer-down: the click that follows
    // would start it anyway, and it buys the ~100ms before the click lands.
    prefetchDetails() {
      if (!this.isFinished || this.detailsStats || this.detailsPromise) return;
      this.detailsPromise = this.getDetailedStats().catch(() => {
        this.detailsPromise = null;
      });
    },
    onRowPointerDown(event: PointerEvent) {
      if (this.compact || this.expanded) return;
      // The VIEW button prefetches itself; other controls don't open the row.
      if ((event.target as HTMLElement | null)?.closest("a,button")) return;
      this.prefetchDetails();
    },
    async toggleExpanded(event?: MouseEvent) {
      // Ignore clicks that originated on an interactive child (badge, links).
      if (event) {
        const el = event.target as HTMLElement | null;
        if (el?.closest("a,button")) return;
      }
      if (this.expanded) {
        this.expanded = false;
        return;
      }
      this.prefetchDetails();
      if (
        this.hasClips &&
        this.playerClips.length === 0 &&
        !this.playerClipsLoading
      ) {
        this.getPlayerClips().catch(() => {});
      }
      this.expanded = true;
      await this.$nextTick();
      this.revealExpanded();
    },
    // Scroll the page so the whole opened row is on screen — or, when it is
    // taller than the screen, its top. Drives the nearest scroller directly:
    // scrollIntoView would also shift overflow-hidden layout ancestors.
    revealExpanded() {
      const row = this.$el as HTMLElement;
      const scroller = scrollParentOf(row);
      if (!scroller) return;
      const view = scroller.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      const top = view.top + REVEAL_MARGIN;
      const bottom = view.top + scroller.clientHeight - REVEAL_MARGIN;
      let delta = 0;
      if (box.top < top || box.height > bottom - top) {
        delta = box.top - top;
      } else if (box.bottom > bottom) {
        delta = box.bottom - bottom;
      }
      if (Math.abs(delta) < 2) return;
      scroller.scrollTo({
        top: scroller.scrollTop + delta,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    },
    // One query for the whole scoreboard. Every lineup member's stats come
    // from the match-scoped views, and their rating AT this match from
    // elo_changes (v_player_elo, by match_id) — never players.elo, whose
    // get_player_elo() per player is the expensive part. Imported Valve
    // matches add each player's per-match rank, keyed (steam_id, match_id).
    async getDetailedStats() {
      this.detailsStatsLoading = true;
      try {
        const isValve = this.match?.source === "valve";
        const steamIds = ["lineup_1", "lineup_2"].flatMap((key) =>
          (this.match?.[key]?.lineup_players ?? [])
            .map((lp: any) => lp.steam_id ?? lp.player?.steam_id)
            .filter(Boolean),
        );
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: {
            matchId: this.match.id,
            order_by_name: order_by.asc,
            ...(isValve ? { steamIds } : {}),
          },
          query: generateQuery({
            matches_by_pk: [
              { id: this.match.id },
              {
                lineup_1: [{}, matchAllMapsStatsWithoutElo],
                lineup_2: [{}, matchAllMapsStatsWithoutElo],
                elo_changes: [{}, eloFields],
              },
            ],
            ...(isValve
              ? {
                  player_premier_rank_history: [
                    {
                      where: {
                        match_id: { _eq: $("matchId", "uuid!") },
                        steam_id: { _in: $("steamIds", "[bigint!]!") },
                      },
                    },
                    {
                      steam_id: true,
                      rank: true,
                      rank_type: true,
                      previous_rank: true,
                    },
                  ],
                }
              : {}),
          } as any),
        });
        const ranks: Record<string, any> = {};
        for (const r of (data as any)?.player_premier_rank_history ?? []) {
          const rank = Number(r.rank ?? 0);
          const prev = r.previous_rank == null ? null : Number(r.previous_rank);
          ranks[String(r.steam_id)] = {
            rankType: Number(r.rank_type),
            rank,
            previousRank: prev,
            change: prev == null ? 0 : rank - prev,
          };
        }
        this.matchRanks = ranks;
        this.detailsStats = (data as any)?.matches_by_pk ?? null;
        if (this.detailsStats) {
          detailsCache.delete(String(this.match.id));
          detailsCache.set(String(this.match.id), {
            stats: this.detailsStats,
            ranks,
          });
          if (detailsCache.size > DETAILS_CACHE_SIZE) {
            detailsCache.delete(detailsCache.keys().next().value!);
          }
        }
      } finally {
        this.detailsStatsLoading = false;
      }
    },
    async getPlayerClips() {
      const ids = this.clipSteamIds;
      if (!ids.length || !this.match?.id) return;
      this.playerClipsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: { matchId: this.match.id, playerIds: ids },
          query: generateQuery({
            match_clips: [
              {
                limit: this.teamId || this.neutral ? 12 : 6,
                // No visibility filter: show every clip the viewer can see,
                // same as the match page — Hasura permissions do the rest.
                where: {
                  match_map: { match_id: { _eq: $("matchId", "uuid!") } },
                  _or: [
                    { user_steam_id: { _in: $("playerIds", "[bigint!]!") } },
                    { target_steam_id: { _in: $("playerIds", "[bigint!]!") } },
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
    openBestClip() {
      if (!this.bestClip) return;
      useClipModal().playClips(
        this.filteredPlayerClips as any[],
        this.bestClip.id,
        `${this.neutral ? `match-${this.match?.id}` : this.teamId ? `team-match-${this.match?.id}-${this.teamId}` : `player-match-${this.match?.id}-${this.playerSteamId}`}-map-${this.selectedMapId ?? "all"}`,
      );
    },
  },
};
</script>

<style scoped>
/* Open: the panel lands at full height in one frame, so only opacity moves
   here; the scoreboard staggers its own pieces in on top. */
.unfurl-enter {
  animation: unfurl-in 0.18s ease-out;
}
@keyframes unfurl-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
/* Close: fold the height shut. The lobby is already mounted, so the tween
   has nothing to fight. Clipped only while it runs. */
.unfurl-leave {
  transition:
    grid-template-rows 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.14s ease-in;
}
.unfurl-leave > .unfurl-cell {
  overflow: hidden;
}
.unfurl-closed {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .unfurl-enter {
    animation: none;
  }
  .unfurl-leave {
    transition-duration: 1ms;
  }
}
</style>
