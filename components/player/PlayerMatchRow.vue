<script setup lang="ts">
import {
  ChevronDown,
  ExternalLink,
  ListChecks,
  Play,
  Trophy,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerSkillGroupRank from "~/components/PlayerSkillGroupRank.vue";
import MatchSourceBadge from "~/components/MatchSourceBadge.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchPlayerDetailsPanel from "~/components/match/MatchPlayerDetailsPanel.vue";
import MatchOverviewDrawer from "~/components/match/MatchOverviewDrawer.vue";
import { kdColor, hltvColor } from "~/utils/statTiers";

// Shared grid track template — MUST stay in sync with the header row in
// PlayerMatchesTable.vue so columns line up across every row. Every track
// is a fixed width except MAP (1fr) so the flexible column resolves to the
// same size on every row, keeping the stat columns aligned. The highlight
// thumbnail gets its own fixed column right before RATING, and the chevron
// gets its own slim trailing column.
// OPEN · DATE · TYPE · RESULT · MAP · CLIP · RATING · K/D/A · K/D · ADR · Δ · VIEW
const wideGrid =
  "grid grid-cols-[2.5rem_5rem_6.75rem_8.5rem_minmax(4.5rem,1fr)_3rem_6rem_4.5rem_2.75rem_3.25rem_6rem_2.5rem] items-center gap-x-2";
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
    @click="onRowClick($event)"
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
              ? `${matchType} · imported from ${sourceLabel}`
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

      <!-- RESULT + SCORE — finished matches show the W/L/T badge + score;
           anything else (scheduled/cancelled/live) shows only the status. The
           opponent TEAM (real teams only — never pugs) tucks under the score. -->
      <div class="flex min-w-0 flex-col justify-center gap-0.5">
        <span
          v-if="isFinished"
          class="font-mono text-sm font-bold leading-none tabular-nums"
        >
          <span :class="scoreClass">{{ score.player }}</span>
          <span class="mx-1 text-muted-foreground/60">:</span>
          <span class="text-muted-foreground/90">{{ score.opponent }}</span>
        </span>
        <MatchStatus v-else :match="match" />
        <span
          v-if="opponentTeam"
          class="flex min-w-0 items-center gap-1"
          :title="`vs ${opponentTeam.name}`"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-muted-foreground/50"
            >vs</span
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
        class="group/clip relative h-7 w-full overflow-hidden rounded border border-border/70 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)]"
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
        >{{ stats.deaths }}<span class="mx-0.5 text-muted-foreground/50">/</span
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

      <!-- Δ ELO (5stack) / Valve rank (external: Premier rating or skill group) -->
      <div class="flex items-center justify-end">
        <EloChangeBadge v-if="hasElo" :elo-change="eloChange" size="sm" />
        <!-- Premier: canonical CS2 rating badge. The change floats as a
             superscript overlapping the pill's top-right corner so it never
             steals width from the rating or bumps the row height. -->
        <span
          v-else-if="rankInfo && isPremierRank"
          class="relative inline-flex items-center leading-none"
          :title="rankTitle"
        >
          <PlayerPremierRank :premier-rank="rankInfo.rank" />
          <span
            v-if="rankInfo.change !== 0"
            class="pointer-events-none absolute -right-1.5 -top-2 inline-flex items-center gap-px font-mono text-[0.5rem] font-bold tabular-nums leading-none [text-shadow:0_1px_2px_hsl(var(--background)),0_0_2px_hsl(var(--background))]"
            :class="rankChangeClass"
          >
            <span aria-hidden="true">{{
              rankInfo.change > 0 ? "▲" : "▼"
            }}</span>
            {{ Math.abs(rankInfo.change).toLocaleString() }}
          </span>
        </span>
        <!-- Competitive / Wingman: skill group icon + up/down indicator -->
        <span
          v-else-if="rankInfo && rankIcon"
          class="inline-flex items-center gap-1"
          :title="rankTitle"
        >
          <PlayerSkillGroupRank
            :kind="rankInfo.rankType === 6 ? 'wingman' : 'competitive'"
            :rank="rankInfo.rank"
            :show-label="false"
          />
          <span
            v-if="rankInfo.change !== 0"
            class="font-mono text-[0.6rem] font-bold leading-none"
            :class="rankChangeClass"
            aria-hidden="true"
          >
            {{ rankInfo.change > 0 ? "▲" : "▼" }}
          </span>
        </span>
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
        @click.stop="toggleExpanded()"
      >
        <ChevronDown
          class="h-3.5 w-3.5 transition-transform duration-200"
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
        <template v-if="isFinished">
          <span class="font-mono text-base font-bold leading-none tabular-nums">
            <span :class="scoreClass">{{ score.player }}</span>
            <span class="mx-0.5 text-muted-foreground/60">:</span>
            <span class="text-muted-foreground/90">{{ score.opponent }}</span>
          </span>
          <!-- ELO Δ / Valve rank, paired with the score as the match outcome. -->
          <EloChangeBadge v-if="hasElo" :elo-change="eloChange" size="xs" />
          <span
            v-else-if="rankInfo && isPremierRank"
            class="inline-flex items-center gap-1.5"
            :title="rankTitle"
          >
            <PlayerPremierRank :premier-rank="rankInfo.rank" />
            <span
              v-if="rankInfo.change !== 0"
              class="inline-flex items-center gap-px font-mono text-[0.6rem] font-bold tabular-nums"
              :class="rankChangeClass"
            >
              <span aria-hidden="true">{{
                rankInfo.change > 0 ? "▲" : "▼"
              }}</span>
              {{ Math.abs(rankInfo.change).toLocaleString() }}
            </span>
          </span>
          <span
            v-else-if="rankInfo && rankIcon"
            class="inline-flex items-center gap-1"
            :title="rankTitle"
          >
            <PlayerSkillGroupRank
              :kind="rankInfo.rankType === 6 ? 'wingman' : 'competitive'"
              :rank="rankInfo.rank"
              :show-label="false"
            />
            <span
              v-if="rankInfo.change !== 0"
              class="font-mono text-[0.6rem] font-bold"
              :class="rankChangeClass"
              aria-hidden="true"
            >
              {{ rankInfo.change > 0 ? "▲" : "▼" }}
            </span>
          </span>
        </template>
        <MatchStatus v-else :match="match" />

        <div class="ml-auto flex items-center gap-1.5 text-muted-foreground">
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
        :title="`vs ${opponentTeam.name}`"
      >
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/50"
          >vs</span
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
          class="group/clip relative ml-auto h-9 w-16 shrink-0 overflow-hidden rounded border border-border/70 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)]"
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
            >RTG</span
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
            >{{ stats.kills
            }}<span class="text-muted-foreground/40">/</span>{{ stats.deaths
            }}<span class="text-muted-foreground/40">/</span>{{
              stats.assists
            }}</span
          >
        </div>
        <div
          class="flex flex-col items-center justify-center gap-0.5 bg-card/60 py-1.5"
        >
          <span
            class="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground/60"
            >K/D</span
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
            >ADR</span
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
          @click.stop="toggleExpanded()"
        >
          <ChevronDown
            class="h-3.5 w-3.5 transition-transform duration-200"
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
    <!-- grid-template-rows 0fr↔1fr expand/collapse: 1fr always resolves to
         the panel's *current* natural height, so when the loading skeleton
         swaps for the full table mid-animation the height re-targets smoothly
         (no jump) and only the clip box animates — far less layout thrash than
         animating raw height. The inner overflow-hidden lets the 0fr row
         collapse to zero (grid items otherwise keep min-height:auto). -->
    <Transition
      enter-active-class="grid transition-all duration-300 ease-out"
      enter-from-class="grid-rows-[0fr] opacity-0"
      enter-to-class="grid-rows-[1fr] opacity-100"
      leave-active-class="grid transition-all duration-200 ease-in"
      leave-from-class="grid-rows-[1fr] opacity-100"
      leave-to-class="grid-rows-[0fr] opacity-0"
    >
      <div v-if="expanded && isFinished" class="grid" @click.stop>
        <div class="overflow-hidden">
          <div
            class="border-t border-border bg-card/40 px-3 py-3 space-y-3"
            :class="compact ? '' : 'sm:px-4'"
          >
            <MatchPlayerDetailsPanel
              :match="panelMatch"
              :focus-lineup="focusPlayerLineupDetailed"
              :loading="detailsStatsLoading"
              :active-tab="detailsTab"
              :selected-map-id="selectedMapId"
              @update:active-tab="(v) => (detailsTab = v)"
              @update:selected-map-id="(v) => (selectedMapId = v)"
            />

            <!-- View details — opens the picks/deciders + team stat-table drawer
               (same overview MatchTableRow uses). The inline panel above is the
               player-focused readout; this is the full match breakdown. -->
            <div class="flex">
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-background hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
                @click.stop="drawerOpen = true"
              >
                <ListChecks class="h-3.5 w-3.5" />
                <span>{{ $t("match.match_overview") }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <MatchOverviewDrawer
      v-model:open="drawerOpen"
      :match="match"
      :player="player"
    />
  </div>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchAllMapsStats } from "~/graphql/matchAllMapsStatsGraphql";
import { matchClipFields } from "~/graphql/matchClip";
import { $, order_by } from "~/generated/zeus";
import { useClipModal } from "~/composables/useClipModal";
import cleanMapName from "~/utilities/cleanMapName";
import { csRankIcon, csRankKind } from "~/utilities/csRank";

export default {
  props: {
    match: { type: Object, required: true },
    player: { type: Object, required: false, default: null },
    compact: { type: Boolean, default: false },
    embedded: { type: Boolean, default: false },
    // match_id -> { rankType, rank, change } for external Valve matches with no
    // internal elo. Lets the ELO column show the CS Rating (Premier) or skill
    // group icon (Competitive/Wingman) + change instead.
    rankByMatch: { type: Object, required: false, default: null },
    // Canonical per-match HLTV rating from the backend; overrides the local
    // estimate below (which can't include KAST at this level).
    canonicalRating: { type: Number, required: false, default: null },
    // Focus player's aggregate stats for this match, batched by the parent
    // page. Powers the collapsed row without a per-row matches_by_pk query.
    collapsedAgg: { type: Object, required: false, default: null },
  },
  data() {
    return {
      expanded: false,
      drawerOpen: false,
      detailsStats: null as any | null,
      detailsStatsLoading: false,
      detailsTab: "overview",
      selectedMapId: null as string | null,
      playerClips: [] as any[],
      playerClipsLoading: false,
    };
  },
  mounted() {
    // Collapsed-row aggregate stats now arrive batched via the `collapsedAgg`
    // prop (parent fetches them for the whole page in one query). Only the
    // highlight thumbnail still needs a fetch, and only for matches that
    // actually have public clips — the heavy round-level + per-map + all-players
    // query stays deferred to first expand (getDetailedStats).
    if (this.isFinished && this.playerSteamId && this.hasPublicClips) {
      if (this.playerClips.length === 0 && !this.playerClipsLoading) {
        this.getPlayerClips().catch(() => {});
      }
    }
  },
  computed: {
    isFinished(): boolean {
      return this.match?.status === e_match_status_enum.Finished;
    },
    // Whether any map in this match has public clips — gates the clip fetch so
    // clip-less matches (the majority) make zero clip requests.
    hasPublicClips(): boolean {
      return (this.match?.match_maps || []).some(
        (mm: any) => (mm?.public_clips_count ?? 0) > 0,
      );
    },
    // The match prop comes from simpleMatchFields, whose match_maps carry
    // no per-round data — so the Overview tab's KAST/Survived columns can't
    // compute. Once the detailed fetch lands we overlay its rounds onto the
    // match_maps (matched by id) and hand that enriched copy to the panel.
    panelMatch(): any {
      const detailMaps = (this.detailsStats as any)?.match_maps;
      if (!Array.isArray(detailMaps) || detailMaps.length === 0) {
        return this.match;
      }
      const roundsById = new Map(
        detailMaps.map((mm: any) => [mm.id, mm.rounds]),
      );
      return {
        ...this.match,
        match_maps: (this.match?.match_maps ?? []).map((mm: any) => ({
          ...mm,
          rounds: roundsById.get(mm.id) ?? mm.rounds ?? [],
        })),
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
    // Mirrors EloChangeBadge's own render guard so the ELO column shows a
    // dash (instead of nothing) for matches with no elo movement / no row.
    hasElo(): boolean {
      if (!this.isFinished || !this.eloChange) return false;
      const c = Number(this.eloChange.elo_change);
      return Number.isFinite(c) && c !== 0;
    },
    // Per-match Valve rank for external matches (no internal elo): Premier CS
    // Rating (numeric) or Competitive/Wingman skill group (icon).
    rankInfo(): { rankType: number; rank: number; change: number } | null {
      const m = (this.rankByMatch as any)?.[this.match?.id];
      return m && Number.isFinite(m.rank) ? m : null;
    },
    isPremierRank(): boolean {
      return this.rankInfo?.rankType === 11;
    },
    rankIcon(): string | null {
      if (!this.rankInfo) return null;
      return csRankIcon(this.rankInfo.rankType, this.rankInfo.rank);
    },
    rankChangeClass(): string {
      const c = this.rankInfo?.change ?? 0;
      if (c > 0) return "text-[hsl(142_71%_60%)]";
      if (c < 0) return "text-[hsl(0_84%_66%)]";
      return "text-muted-foreground";
    },
    rankTitle(): string {
      if (!this.rankInfo) return "";
      const kind = csRankKind(this.rankInfo.rankType);
      const label =
        kind === "wingman"
          ? this.$t("player_match.wingman")
          : kind === "competitive"
            ? this.$t("player_match.competitive")
            : this.$t("player_match.premier");
      const after = this.rankInfo.rank;
      const before = after - this.rankInfo.change;
      return `${label}: ${before.toLocaleString()} → ${after.toLocaleString()}`;
    },
    apiDomain(): string {
      return useRuntimeConfig().public.apiDomain as string;
    },
    // The lineup the focus player is NOT on. Mirrors the score's orientation
    // (player defaults to lineup_1) when their lineup can't be resolved.
    opponentLineup(): any | null {
      const mine = this.playerLineupId;
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
      const lu = this.opponentLineup;
      if (!lu || lu.team_id == null) return null;
      const name = lu.team?.name || lu.name || null;
      if (!name) return null;
      const url = lu.team?.avatar_url;
      return {
        name,
        shortName: lu.team?.short_name || null,
        avatarSrc: url ? `https://${this.apiDomain}/${url}` : null,
      };
    },
    playerLineupId(): string | null {
      const sid = this.playerSteamId;
      if (!sid) return null;
      const onL1 = this.match?.lineup_1?.lineup_players?.some(
        (lp: any) => String(lp.player?.steam_id ?? "") === sid,
      );
      if (onL1) return this.match.lineup_1_id;
      const onL2 = this.match?.lineup_2?.lineup_players?.some(
        (lp: any) => String(lp.player?.steam_id ?? "") === sid,
      );
      if (onL2) return this.match.lineup_2_id;
      return null;
    },
    // won | lost | tied — derived from the player's elo row when present,
    // falling back to comparing the winning lineup with the player's lineup.
    result(): "won" | "lost" | "tied" | null {
      const r = (this.eloChange?.match_result ?? "").toLowerCase();
      if (r === "won" || r === "win") return "won";
      if (r === "lost" || r === "loss") return "lost";
      if (r === "tied" || r === "tie" || r === "draw") return "tied";
      const winner = this.match?.winning_lineup_id;
      const mine = this.playerLineupId;
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
      const mine = this.playerLineupId;
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
          label: cleanMapName(m.label || m.name || ""),
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
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    },
    timeLabel(): string {
      const d = new Date(this.matchDate);
      return d.toLocaleTimeString(undefined, {
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
        Competitive: "Competitive",
        Wingman: "Wingman",
        Premier: "Premier",
        Faceit: "Faceit",
        Duel: "Duel",
        Scrimmage: "Scrimmage",
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
    focusPlayerLineupDetailed(): any {
      const sid = this.playerSteamId;
      if (!sid || !this.detailsStats) return null;
      const findPlayer = (lineup: any) =>
        (lineup?.lineup_players || []).find(
          (lp: any) => String(lp.player?.steam_id ?? lp.steam_id ?? "") === sid,
        );
      const narrowMapStats = (lp: any) => {
        if (!lp?.player) return lp;
        if (!this.selectedMapId) {
          return { ...lp, player: { ...lp.player, match_map_stats: null } };
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
        const found = findPlayer(lineup);
        if (found) {
          return { ...lineup, lineup_players: [narrowMapStats(found)] };
        }
      }
      return null;
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
    toggleExpanded(event?: MouseEvent) {
      // Ignore clicks that originated on an interactive child (badge, links).
      if (event) {
        const el = event.target as HTMLElement | null;
        if (el?.closest("a,button")) return;
      }
      this.expanded = !this.expanded;
      if (this.expanded) {
        if (!this.detailsStats && !this.detailsStatsLoading) {
          this.getDetailedStats().catch(() => {});
        }
        if (
          this.hasPublicClips &&
          this.playerClips.length === 0 &&
          !this.playerClipsLoading
        ) {
          this.getPlayerClips().catch(() => {});
        }
      }
    },
    async getDetailedStats() {
      this.detailsStatsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: { matchId: this.match.id, order_by_name: order_by.asc },
          query: generateQuery({
            matches_by_pk: [
              { id: this.match.id },
              {
                lineup_1: [{}, matchAllMapsStats],
                lineup_2: [{}, matchAllMapsStats],
                // Round-level kills/assists feed the Overview tab's
                // KAST + Survived columns (LineupOverviewRow computes
                // them per round). simpleMatchFields omits rounds, so
                // without this the columns render "—".
                match_maps: [
                  { order_by: [{ order: order_by.asc }] },
                  {
                    id: true,
                    rounds: [
                      { order_by: [{ round: order_by.asc }] },
                      {
                        round: true,
                        lineup_1_side: true,
                        lineup_2_side: true,
                        kills: [
                          {},
                          {
                            headshot: true,
                            player: { steam_id: true },
                            attacked_player: { steam_id: true },
                          },
                        ],
                        assists: [{}, { attacker_steam_id: true }],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        });
        this.detailsStats = (data as any)?.matches_by_pk ?? null;
      } finally {
        this.detailsStatsLoading = false;
      }
    },
    async getPlayerClips() {
      const sid = this.playerSteamId;
      if (!sid || !this.match?.id) return;
      this.playerClipsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: { matchId: this.match.id, playerId: sid },
          query: generateQuery({
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
      const scope = `player-match-${this.match?.id}-${this.playerSteamId}-map-${this.selectedMapId ?? "all"}`;
      setClipQueue(items, scope);
    },
    openBestClip() {
      if (!this.bestClip) return;
      this.seedPlayerClipQueue();
      useClipModal().openClip(this.bestClip.id);
    },
  },
};
</script>
