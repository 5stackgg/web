<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Check,
  Clock,
  Ellipsis,
  Film,
  GitFork,
  Globe,
  Trash2,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import Fold from "~/components/ui/transitions/Fold.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityReactions from "~/components/utility/UtilityReactions.vue";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import UtilityThrowersMeter from "~/components/utility/UtilityThrowersMeter.vue";
import {
  UTILITY_TYPE_COLORS,
  humanizeUtilityToken,
  myUtilityProgress,
  utilityDifficultyKey,
  utilityLineupRoute,
} from "~/utilities/utilityDisplay";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityLineup, UtilityTrajectoryPoint } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineup: UtilityLineup;
    selected?: boolean;
    // Pointed at from the board, so the list answers the hover.
    hovered?: boolean;
    // The mined cluster that lines up with this throw: how many distinct
    // players ran it in real matches, and how many times.
    metaThrowers?: number | null;
    metaThrows?: number | null;
    // The busiest spot on the map, so every meter's bar reads against the
    // same scale.
    metaBusiest?: number | null;
    showOpenLink?: boolean;
    // Off by default: the pickers and the solve panel show cards for choosing,
    // not for copying, and a second action there is only noise.
    showFork?: boolean;
    // Only where a lineup can actually be managed -- the pickers show cards for
    // choosing, and an archive action there is a way to lose work by accident.
    showArchive?: boolean;
    canReview?: boolean;
    // Signed out, the counts still read fine -- they just stop being buttons.
    canReact?: boolean;
    openInPlace?: boolean;
    // "row" is the index form: one line per lineup, for reading down a list
    // rather than reading one. The page swaps the selected row back to a card.
    mode?: "card" | "row";
    // The thumb doubles as "send this to my practice server". Off wherever a
    // press already means something else -- the pickers hand the card out for
    // choosing, and there a tile that loads you into the game instead of
    // ticking the row is the wrong verb on the only target there is.
    showPractice?: boolean;
  }>(),
  {
    selected: false,
    hovered: false,
    metaThrowers: null,
    metaThrows: null,
    metaBusiest: null,
    showOpenLink: true,
    showFork: false,
    showArchive: false,
    canReview: false,
    canReact: false,
    openInPlace: false,
    mode: "card",
    showPractice: true,
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "hover", id: string | null): void;
  (e: "fork", id: string): void;
  (e: "archive", id: string): void;
  (e: "restore", id: string): void;
  (e: "delete", id: string): void;
  (e: "request-public", id: string): void;
  (e: "review-public", id: string, approve: boolean): void;
  (e: "rerender-preview", id: string): void;
  (e: "vote", id: string, value: 1 | -1): void;
  (e: "favorite", id: string): void;
  (e: "open", id: string): void;
}>();

const { t } = useI18n();

// Only the author, only while it is neither public nor already asked, and
// never for something archived: the queue is for lineups meant to be seen.
const canSubmitPublic = computed(
  () =>
    props.lineup.can_edit &&
    props.lineup.visibility !== "Public" &&
    !props.lineup.public_requested_at &&
    !props.lineup.archived_at,
);

const canArchive = computed(
  () => props.showArchive && props.lineup.can_edit && !props.lineup.archived_at,
);

const canRestore = computed(
  () => !!props.lineup.can_edit && !!props.lineup.archived_at,
);

// Same gate as Restore, and deliberately no wider: the only place a lineup can
// be destroyed is the scope it was already put aside in.
const canDelete = computed(() => props.showArchive && canRestore.value);

// Whether the menu would hold anything at all. A trigger that opens an empty
// popover is worse than no trigger.
const hasMenu = computed(
  () =>
    props.showOpenLink ||
    props.showFork ||
    canSubmitPublic.value ||
    canRerender.value ||
    canArchive.value ||
    canRestore.value ||
    canDelete.value,
);

const color = computed(
  () => UTILITY_TYPE_COLORS[props.lineup.utility_type] ?? "#ffffff",
);

const origin = computed<UtilityTrajectoryPoint>(() => ({
  x: props.lineup.origin_x,
  y: props.lineup.origin_y,
  z: props.lineup.origin_z,
}));

const landing = computed<UtilityTrajectoryPoint | null>(() =>
  props.lineup.land_x == null || props.lineup.land_y == null
    ? null
    : {
        x: props.lineup.land_x,
        y: props.lineup.land_y,
        z: props.lineup.land_z ?? 0,
      },
);

// "Recorded" is where the lineup came from, not something you do about it. It
// reads as a verification mark beside the name; it used to be a full-width
// green banner carrying one word.
const isRecorded = computed(() => props.lineup.confidence === "exact");

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const progress = computed(() =>
  myUtilityProgress(props.lineup.progress, mySteamId.value),
);

// The strip only holds cells with a value behind them; an em dash in a box is
// a claim that the number exists and is zero. Players is not among them: the
// meter in the header is that number, and printing it twice on one card is
// what made the strip read as filler.
const stats = computed(() => {
  const out: Array<{
    key: string;
    value: string;
    unit?: string;
    label: string;
    quiet?: boolean;
  }> = [];
  if (props.metaThrows) {
    out.push({
      key: "throws",
      value: String(props.metaThrows),
      label: t("pages.utility.meta.throws"),
    });
  }
  const attempts = Number(progress.value?.attempts ?? 0);
  const successes = Number(progress.value?.successes ?? 0);
  if (attempts > 0) {
    out.push({
      key: "hit",
      value: String(Math.round((successes / attempts) * 100)),
      unit: "%",
      label: t("pages.utility.card.stat_hit_rate"),
    });
  }
  const ms = Number(props.lineup.flight_time_ms ?? 0);
  if (ms > 0) {
    out.push({
      key: "flight",
      value: (ms / 1000).toFixed(1),
      unit: "s",
      label: t("pages.utility.card.stat_flight"),
    });
  }
  const difficulty = String(props.lineup.difficulty ?? "").trim();
  if (difficulty) {
    const key = utilityDifficultyKey(difficulty);
    out.push({
      key: "difficulty",
      value: key
        ? t(`pages.utility.difficulty.levels.${key}`)
        : humanizeUtilityToken(difficulty),
      label: t("pages.utility.card.stat_difficulty"),
      // A grade nobody has measured is not a fact about the throw.
      quiet: !key || key === "unmeasured",
    });
  }
  return out;
});

const awaitingReview = computed(
  () => !!props.lineup.can_edit && !!props.lineup.public_requested_at,
);

const reviewable = computed(
  () => props.canReview && !!props.lineup.public_requested_at,
);

// Approving is what books the first render, so the manual one is only ever a
// re-run: a lineup that is already public and whose preview is wrong or stale.
const canRerender = computed(
  () =>
    props.canReview &&
    props.lineup.visibility === "Public" &&
    !props.lineup.archived_at,
);

const tags = computed(() => props.lineup.tags ?? []);

function open() {
  emit("open", props.lineup.id);
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group relative flex cursor-pointer flex-col rounded-md border border-l-2 py-2 pl-3 pr-2.5 text-left [backdrop-filter:blur(6px)] transition-[background-color,border-color,box-shadow] duration-200 ease-out"
    :class="
      selected
        ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.045)] shadow-[0_12px_32px_-20px_rgba(0,0,0,0.95)]'
        : hovered
          ? 'border-[hsl(var(--tac-amber)/0.3)] bg-card/60'
          : 'border-border bg-card/40 hover:border-[hsl(var(--tac-amber)/0.3)] hover:bg-card/55'
    "
    :style="{ borderLeftColor: color }"
    @click="emit('select', lineup.id)"
    @keydown.enter="emit('select', lineup.id)"
    @keydown.space.prevent="emit('select', lineup.id)"
    @mouseenter="emit('hover', lineup.id)"
    @mouseleave="emit('hover', null)"
  >
    <!-- Identical in both modes, down to the reserved menu slot: opening a row
         must not move a single thing you were already looking at, or the swap
         reads as a jump rather than as the row growing. Everything that only
         a card shows folds in underneath. -->
    <div class="flex items-center gap-2.5">
      <!-- A throw is a place and this is the picture of it, so it is also the
           way in: the send action wears the tile rather than taking a row of
           its own under the fold. That put the card's only *do something*
           button below its metadata and, worse, out of reach entirely in row
           mode -- where a list you are scanning with a live server is exactly
           when you want it. -->
      <div class="relative shrink-0">
        <UtilityRadarThumb
          :map-name="lineup.map_name"
          :origin="origin"
          :landing="landing"
          :color="color"
          :size="40"
        />
        <UtilityPracticeButton
          v-if="showPractice"
          :lineup="lineup"
          shape="overlay"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold leading-tight">
            {{ lineup.name }}
          </span>
          <BadgeCheck
            v-if="isRecorded"
            class="h-3.5 w-3.5 shrink-0 text-success"
            :title="$t('pages.utility.confidence.exact_note')"
          />
          <Clock
            v-if="awaitingReview"
            class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            :title="$t('pages.utility.publish.pending')"
          />
        </div>
        <!-- One line in both modes. Flight and the difficulty grade ride the
             strip below instead of wrapping this to a second line, which would
             change the header's height on open. -->
        <UtilitySpecLine :lineup="lineup" compact class="truncate" />
      </div>

      <UtilityThrowersMeter
        v-if="metaThrowers"
        :count="metaThrowers"
        :max="metaBusiest"
        :color="color"
      />

      <!-- One trigger instead of a row of unlabelled glyphs. It holds its space
           on every row so the meter never shifts; it just stays quiet until the
           row is pointed at or open. -->
      <DropdownMenu v-if="hasMenu">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="-mr-0.5 shrink-0 rounded p-1 text-muted-foreground transition-opacity duration-200 hover:bg-muted/50 hover:text-foreground focus-visible:opacity-100 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground"
            :class="
              mode === 'card' || selected
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            "
            :title="$t('pages.utility.card.more_actions')"
            @click.stop
          >
            <Ellipsis class="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <div @click.stop>
          <DropdownMenuItem v-if="showOpenLink && openInPlace" @click="open()">
            <ArrowUpRight />
            {{ $t("pages.utility.card.open") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else-if="showOpenLink" as-child>
            <NuxtLink :to="utilityLineupRoute(lineup.map_name, lineup.id)">
              <ArrowUpRight />
              {{ $t("pages.utility.card.open") }}
            </NuxtLink>
          </DropdownMenuItem>

          <DropdownMenuItem v-if="showFork" @click="emit('fork', lineup.id)">
            <GitFork />
            {{ $t("pages.utility.fork.action") }}
          </DropdownMenuItem>

          <DropdownMenuItem
            v-if="canSubmitPublic"
            @click="emit('request-public', lineup.id)"
          >
            <Globe />
            {{ $t("pages.utility.publish.submit") }}
          </DropdownMenuItem>

          <DropdownMenuItem
            v-if="canRerender"
            @click="emit('rerender-preview', lineup.id)"
          >
            <Film />
            {{ $t("pages.utility.render_queue.rerender") }}
          </DropdownMenuItem>

          <template v-if="canArchive || canRestore || canDelete">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-if="canArchive"
              class="text-destructive focus:text-destructive"
              @click="emit('archive', lineup.id)"
            >
              <Archive />
              {{ $t("pages.utility.archive.action") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canRestore"
              @click="emit('restore', lineup.id)"
            >
              <ArchiveRestore />
              {{ $t("pages.utility.archive.restore") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canDelete"
              class="text-destructive focus:text-destructive"
              @click="emit('delete', lineup.id)"
            >
              <Trash2 />
              {{ $t("pages.utility.archive.delete") }}
            </DropdownMenuItem>
          </template>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- The card IS the row plus this. One height animation, one fade: the
         body used to mount at full size, which is what made opening a row
         snap. -->
    <Fold :open="mode === 'card'">
      <div class="flex flex-col gap-2.5 pt-2.5">
        <div
          v-if="stats.length"
          class="flex divide-x divide-border/60 overflow-hidden rounded border border-border/60 bg-background/50"
        >
          <div
            v-for="stat of stats"
            :key="stat.key"
            class="min-w-0 flex-1 px-2.5 pb-1.5 pt-1"
          >
            <span
              class="block truncate text-sm font-bold leading-tight tabular-nums"
              :class="stat.quiet ? 'text-muted-foreground' : ''"
            >
              {{ stat.value
              }}<span
                v-if="stat.unit"
                class="text-[0.6rem] font-medium text-muted-foreground"
                >{{ stat.unit }}</span
              >
            </span>
            <span
              class="block truncate font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground/70"
            >
              {{ stat.label }}
            </span>
          </div>
        </div>

        <UtilityProgressPanel
          v-if="progress"
          :progress="lineup.progress"
          variant="track"
          :show-rate="false"
        />

        <p
          v-if="tags.length"
          class="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[0.6rem] lowercase tracking-[0.08em] text-muted-foreground/70"
        >
          <span v-for="tag of tags" :key="tag">#{{ tag }}</span>
        </p>

        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <PlayerDisplay
              v-if="lineup.author"
              :player="lineup.author"
              size="xs"
              compact
              truncate-name
              :show-elo="false"
              :show-role="false"
              :show-online="false"
              class="min-w-0"
            />
            <span v-else class="text-[0.65rem] text-muted-foreground">
              {{ $t("pages.utility.card.unknown_author") }}
            </span>
          </div>

          <UtilityReactions
            :lineup="lineup"
            :can-react="canReact"
            @vote="(id, value) => emit('vote', id, value)"
            @favorite="(id) => emit('favorite', id)"
          />
        </div>

        <!-- Publishing is a review. The author's side of it is the clock beside
             the name; this is the reviewer's side, and it stays inline because
             on the Review scope answering it *is* the job. -->
        <div
          v-if="reviewable"
          class="flex items-center gap-1.5 border-t border-border/60 pt-2.5"
          @click.stop
        >
          <Button
            size="sm"
            class="tac-amber-cta flex-1"
            @click.stop="emit('review-public', lineup.id, true)"
          >
            <Check class="mr-1 h-3.5 w-3.5" />
            {{ $t("pages.utility.publish.approve") }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="flex-1"
            @click.stop="emit('review-public', lineup.id, false)"
          >
            <X class="mr-1 h-3.5 w-3.5" />
            {{ $t("pages.utility.publish.reject") }}
          </Button>
        </div>
      </div>
    </Fold>
  </div>
</template>
