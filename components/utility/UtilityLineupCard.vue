<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowBigUp,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  Check,
  Clock,
  Ellipsis,
  Film,
  GitFork,
  Globe,
  PencilLine,
  Play,
  Trash2,
  UserRound,
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
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityConfidenceMark from "~/components/utility/UtilityConfidenceMark.vue";
import { Spinner } from "~/components/ui/spinner";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityReactions from "~/components/utility/UtilityReactions.vue";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import UtilityThrowersMeter from "~/components/utility/UtilityThrowersMeter.vue";
import UtilityLineupHoverPreview from "~/components/utility/UtilityLineupHoverPreview.vue";
import {
  UTILITY_TYPE_COLORS,
  humanizeUtilityToken,
  myUtilityProgress,
  utilityDifficultyKey,
  utilityLineupRoute,
} from "~/utilities/utilityDisplay";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityRendersInFlight } from "~/composables/useUtilityRendersInFlight";
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
    // Same reasoning as archive: only where the page answers it with the
    // lineup dialog open in edit mode.
    showEdit?: boolean;
    canReview?: boolean;
    // Signed out, the counts still read fine -- they just stop being buttons.
    canReact?: boolean;
    openInPlace?: boolean;
    // Off where a click already opens the lineup and its actions live there.
    menu?: boolean;
    // Off on the Public scope, where every row is public and a pill saying so
    // on each one is noise; on Mine it is the thing that tells yours apart.
    showStatus?: boolean;
    // On Mine, public is the ordinary state of a lineup: a chip saying so on
    // every row says nothing, so only the exceptions wear one there.
    quietPublic?: boolean;
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
    showEdit: false,
    canReview: false,
    canReact: false,
    openInPlace: false,
    menu: true,
    showStatus: true,
    quietPublic: false,
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
  (e: "edit", id: string): void;
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
    props.menu &&
    (props.showOpenLink ||
    props.showFork ||
    canEdit.value ||
    canSubmitPublic.value ||
    canRerender.value ||
    canArchive.value ||
    canRestore.value ||
    canDelete.value),
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

// A lineup with a rendered clip wears a picture of what the throw does -- its
// landing still, else the clip's own thumbnail -- where one without shows the
// map. A picture that will not load falls back to the map too.
const hasClip = computed(() => !!(props.lineup.preview_url ?? "").trim());
const failedThumb = ref<string | null>(null);

const clipThumb = computed(() => {
  if (!hasClip.value) {
    return null;
  }
  const landing = props.lineup.preview_stills_url?.landing;
  const src =
    typeof landing === "string" && landing.length > 0
      ? landing
      : (props.lineup.preview_thumbnail_url ?? null);
  return src && src !== failedThumb.value ? src : null;
});

// A preview being filmed right now: the thumb says so, and nothing offers to
// film it a second time.
const renders = useUtilityRendersInFlight();
const rendering = computed(() => renders.isRendering(props.lineup.id));
const renderingLabel = computed(() => {
  const percent = renders.percent(props.lineup.id);
  return percent === null
    ? t("pages.utility.card.rendering")
    : t("pages.utility.card.rendering_progress", { percent });
});

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

// Your own lineups sit in the same list as everybody's public ones, and from
// the row alone there was no telling which were which -- or which of yours
// anyone else could see. A pill on yours answers both; the rest stay bare.
const mine = computed(
  () =>
    !!mySteamId.value &&
    String(props.lineup.author_steam_id) === String(mySteamId.value),
);

const STATUS_TONES = {
  Public: "bg-success/15 text-success",
  Team: "bg-[hsl(214_80%_62%/0.15)] text-[hsl(214_80%_68%)]",
  Private: "bg-muted/60 text-muted-foreground",
  review: "bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]",
} as const;

const ownStatus = computed(() => {
  if (!mine.value || props.lineup.archived_at) {
    return null;
  }
  const key = props.lineup.public_requested_at
    ? "review"
    : props.lineup.visibility;
  if (key === "Public" && props.quietPublic) {
    return null;
  }
  const label =
    key === "review"
      ? t("pages.utility.publish.in_review")
      : t(`pages.utility.visibility.${key}`);
  return { label, tone: STATUS_TONES[key] };
});

// Only a public lineup can be voted on, so only there does the count mean
// anything -- a private one's 0 would read as "nobody liked this".
const score = computed(() =>
  props.lineup.visibility === "Public" && !props.lineup.archived_at
    ? Number(props.lineup.upvotes ?? 0)
    : null,
);

// Only while there is a server to load into. Holding the slot open on every
// row for a button that is usually absent cost every name 2.5rem; one reflow
// when your server comes up is the cheaper side of that.
const load = useUtilityLoad();
const practiceReady = computed(
  () =>
    props.showPractice &&
    (load.canLoad(props.lineup.map_name) ||
      load.canSwitchTo(props.lineup.map_name)),
);

// The pencil used to live only inside the open dialog, two clicks and a
// modal away from the row you were looking at.
const canEdit = computed(
  () => props.showEdit && !!props.lineup.can_edit && !props.lineup.archived_at,
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

const rowEl = ref<HTMLElement | null>(null);

function open() {
  emit("open", props.lineup.id);
}
</script>

<template>
  <div
    ref="rowEl"
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
    <!-- Identical in both modes: opening a row must not move a single thing
         you were already looking at, or the swap reads as a jump rather than
         as the row growing. Everything that only a card shows folds in
         underneath. The name gets the whole first line; whose it is and how
         it is thrown share the second; the numbers stand in a column. -->
    <div class="flex items-center gap-2.5">
      <span
        class="relative block size-10 shrink-0"
        :title="
          rendering
            ? renderingLabel
            : hasClip
              ? $t('pages.utility.card.has_video')
              : undefined
        "
      >
        <FadeSwap class="size-10">
          <img
            v-if="clipThumb"
            :key="clipThumb"
            :src="clipThumb"
            alt=""
            loading="lazy"
            decoding="async"
            class="block size-10 rounded-[3px] border border-border bg-background object-cover"
            @error="failedThumb = clipThumb"
          />
          <UtilityRadarThumb
            v-else
            key="radar"
            :map-name="lineup.map_name"
            :origin="origin"
            :landing="landing"
            :color="color"
            :size="40"
          />
        </FadeSwap>
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
          enter-from-class="opacity-0"
        >
          <span
            v-if="rendering"
            data-rendering
            class="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.55)] bg-black/80 text-[hsl(var(--tac-amber))]"
          >
            <Spinner class="size-2.5" aria-hidden="true" />
            <span class="sr-only">{{ renderingLabel }}</span>
          </span>
          <span
            v-else-if="hasClip"
            data-has-video
            class="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.55)] bg-black/80 text-[hsl(var(--tac-amber))]"
          >
            <Play
              class="size-2 translate-x-px fill-current"
              aria-hidden="true"
            />
            <span class="sr-only">
              {{ $t("pages.utility.card.has_video") }}
            </span>
          </span>
        </Transition>
      </span>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold leading-tight">
            {{ lineup.name }}
          </span>
          <UtilityConfidenceMark :lineup="lineup" />
        </div>
        <div class="flex min-w-0 items-center gap-1.5">
          <span
            v-if="ownStatus && showStatus"
            class="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm px-1 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.12em]"
            :class="ownStatus.tone"
            :title="$t('pages.utility.card.yours', { status: ownStatus.label })"
          >
            <UserRound class="h-2.5 w-2.5" />
            {{ ownStatus.label }}
          </span>
          <Clock
            v-else-if="awaitingReview"
            class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            :title="$t('pages.utility.publish.pending')"
          />
          <UtilitySpecLine
            :lineup="lineup"
            compact
            :show-confidence="false"
            class="min-w-0 truncate"
          />
        </div>
      </div>

      <div
        v-if="practiceReady"
        class="flex h-7 w-7 shrink-0 items-center justify-center"
      >
        <UtilityPracticeButton :lineup="lineup" shape="icon" />
      </div>

      <div
        v-if="score !== null || metaThrowers"
        class="flex w-14 shrink-0 flex-col items-end gap-1.5"
      >
        <span
          v-if="score !== null"
          class="flex shrink-0 items-center gap-0.5 font-mono text-[0.65rem] tabular-nums"
          :class="
            lineup.my_vote === 1
              ? 'text-[hsl(var(--tac-amber))]'
              : score > 0
                ? 'text-foreground/80'
                : 'text-muted-foreground/60'
          "
          :title="$t('pages.utility.card.score', { count: score }, score)"
        >
          <ArrowBigUp class="h-3.5 w-3.5" />
          {{ score }}
        </span>

        <UtilityThrowersMeter
          v-if="metaThrowers"
          :count="metaThrowers"
          :max="metaBusiest"
          :color="color"
          class="!w-14"
        />
      </div>

      <!-- One trigger instead of a row of unlabelled glyphs. It holds its space
           on every row so the meter never shifts; it just stays quiet until the
           row is pointed at or open. -->
      <DropdownMenu v-if="hasMenu">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="-mr-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-opacity duration-200 hover:bg-muted/50 hover:text-foreground focus-visible:opacity-100 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground"
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

          <DropdownMenuItem v-if="canEdit" @click="emit('edit', lineup.id)">
            <PencilLine />
            {{ $t("pages.utility.edit.action") }}
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
            :disabled="rendering"
            :title="
              rendering ? $t('pages.utility.render_queue.in_flight') : undefined
            "
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

    <UtilityLineupHoverPreview
      :lineup="lineup"
      :anchor="rowEl"
      :enabled="mode === 'row'"
    />
  </div>
</template>
