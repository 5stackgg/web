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
  Users,
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
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityPreviewClip from "~/components/utility/UtilityPreviewClip.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityReactions from "~/components/utility/UtilityReactions.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import {
  UTILITY_TYPE_COLORS,
  myUtilityProgress,
  utilityLineupRoute,
} from "~/utilities/utilityDisplay";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityLineup } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineup: UtilityLineup;
    selected?: boolean;
    // How many distinct players threw this in real matches, when the mined
    // meta has a cluster that lines up with it.
    metaThrowers?: number | null;
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
  }>(),
  {
    selected: false,
    metaThrowers: null,
    showOpenLink: true,
    showFork: false,
    showArchive: false,
    canReview: false,
    canReact: false,
    openInPlace: false,
    mode: "card",
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "hover", id: string | null): void;
  (e: "fork", id: string): void;
  (e: "archive", id: string): void;
  (e: "restore", id: string): void;
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

// Whether the menu would hold anything at all. A trigger that opens an empty
// popover is worse than no trigger.
const hasMenu = computed(
  () =>
    props.showOpenLink ||
    props.showFork ||
    canSubmitPublic.value ||
    canRerender.value ||
    canArchive.value ||
    canRestore.value,
);

const color = computed(
  () => UTILITY_TYPE_COLORS[props.lineup.utility_type] ?? "#ffffff",
);

// "Recorded" is where the lineup came from, not something you do about it. It
// reads as a verification mark beside the name; it used to be a full-width
// green banner carrying one word.
const isRecorded = computed(() => props.lineup.confidence === "exact");

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const hasProgress = computed(
  () => !!myUtilityProgress(props.lineup.progress, mySteamId.value),
);

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

// Rendered off the public library, so only a public lineup ever has one. A row
// stays one line: the clip is the reason to open the card, not part of the row.
const previewUrl = computed(() => props.lineup.preview_url ?? null);

function open() {
  emit("open", props.lineup.id);
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group relative flex flex-col rounded-md border border-l-2 bg-card/40 text-left transition-colors duration-150 [backdrop-filter:blur(6px)] cursor-pointer"
    :class="[
      mode === 'row' ? 'gap-1 py-2 pl-3 pr-2' : 'gap-2 p-3 pl-3.5',
      selected
        ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
        : 'border-border hover:border-[hsl(var(--tac-amber)/0.35)]',
    ]"
    :style="{ borderLeftColor: color }"
    @click="emit('select', lineup.id)"
    @keydown.enter="emit('select', lineup.id)"
    @keydown.space.prevent="emit('select', lineup.id)"
    @mouseenter="emit('hover', lineup.id)"
    @mouseleave="emit('hover', null)"
  >
    <div class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
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

      <!-- One trigger instead of a row of unlabelled glyphs. Everything here is
           occasional; the thing you do constantly is select the card. -->
      <DropdownMenu v-if="hasMenu">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-muted/50 data-[state=open]:text-foreground"
            :title="$t('pages.utility.card.more_actions')"
            @click.stop
          >
            <Ellipsis class="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48" @click.stop>
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

          <DropdownMenuItem
            v-if="showFork"
            @click="emit('fork', lineup.id)"
          >
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

          <template v-if="canArchive || canRestore">
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
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- A row ends on this line: the point of the index form is that one lineup
         is one entry, and the page expands whichever one you pick. -->
    <div class="flex items-baseline gap-2">
      <!-- A row is one line by definition, so it truncates. A card has the room
           to wrap, and clipping the confidence flag off the end of it is
           exactly the information you cannot afford to lose. -->
      <UtilitySpecLine
        :lineup="lineup"
        :compact="mode === 'row'"
        class="min-w-0 flex-1"
        :class="mode === 'row' ? 'truncate' : ''"
      />
      <span
        v-if="mode === 'row'"
        class="flex shrink-0 items-center gap-2 font-mono text-[0.62rem] tabular-nums text-muted-foreground"
      >
        <span
          v-if="metaThrowers"
          class="inline-flex items-center gap-1 text-[hsl(var(--tac-amber))]"
          :title="$t('pages.utility.meta.throwers_hint')"
        >
          <Users class="h-3 w-3" />
          {{ metaThrowers }}
        </span>
        <span>
          {{ Number(lineup.upvotes ?? 0) - Number(lineup.downvotes ?? 0) }}
          <span class="text-border">·</span>
          {{ Number(lineup.favorites ?? 0) }}
        </span>
      </span>
    </div>

    <template v-if="mode === 'card'">
      <UtilityPreviewClip
        v-if="previewUrl"
        :src="previewUrl"
        :poster="lineup.preview_thumbnail_url"
        :duration-ms="lineup.preview_duration_ms"
      />

      <UtilityProgressPanel
        v-if="hasProgress"
        :progress="lineup.progress"
        variant="track"
      />

      <p
        v-if="tags.length"
        class="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[0.6rem] lowercase tracking-[0.08em] text-muted-foreground/70"
      >
        <span v-for="tag of tags" :key="tag">#{{ tag }}</span>
      </p>

      <div class="mt-auto flex items-center justify-between gap-2 pt-0.5">
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

          <span
            v-if="metaThrowers"
            class="inline-flex shrink-0 items-center gap-1 font-mono text-[0.62rem] tabular-nums text-[hsl(var(--tac-amber))]"
            :title="$t('pages.utility.meta.throwers_hint')"
          >
            <Users class="h-3 w-3" />
            {{ $t("pages.utility.meta.throwers", { count: metaThrowers }) }}
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
           the name; this is the reviewer's side, and it stays inline because on
           the Review scope answering it *is* the job. -->
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
    </template>
  </div>
</template>
