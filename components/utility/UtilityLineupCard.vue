<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowUpRight,
  Archive,
  GitFork,
  Heart,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Users,
} from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import UtilityDifficultyChip from "~/components/utility/UtilityDifficultyChip.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import { UTILITY_TYPE_COLORS, jumpThrowBindState } from "~/utilities/utilityDisplay";
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
    // not for copying, and a second icon there is only noise.
    showFork?: boolean;
    // Only where a lineup can actually be managed -- the pickers show cards for
    // choosing, and an archive button there is a way to lose work by accident.
    showArchive?: boolean;
    // Signed out, the counts still read fine -- they just stop being buttons.
    canReact?: boolean;
  }>(),
  {
    selected: false,
    metaThrowers: null,
    showOpenLink: true,
    showFork: false,
    showArchive: false,
    canReact: false,
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "hover", id: string | null): void;
  (e: "fork", id: string): void;
  (e: "archive", id: string): void;
  (e: "vote", id: string, value: 1 | -1): void;
  (e: "favorite", id: string): void;
}>();

const color = computed(
  () => UTILITY_TYPE_COLORS[props.lineup.utility_type] ?? "#ffffff",
);

const flightSeconds = computed(() => {
  const ms = props.lineup.flight_time_ms;
  if (!ms) {
    return null;
  }
  return (ms / 1000).toFixed(1);
});

const score = computed(
  () => Number(props.lineup.upvotes ?? 0) - Number(props.lineup.downvotes ?? 0),
);

const jumpBind = computed(() => jumpThrowBindState(props.lineup));

const { t } = useI18n();

// Read through normalisers, never off the row. A card rendered somewhere that
// does not select the viewer's own columns would otherwise show undefined as
// "not voted" and then compute NaN the moment you click it.
const myVote = computed(() => Number(props.lineup.my_vote ?? 0));
const isFavorited = computed(() => props.lineup.is_favorited === true);
const favoriteCount = computed(() => Number(props.lineup.favorites ?? 0));

const voteTitle = computed(() =>
  myVote.value === 1
    ? t("pages.utility.card.unvote")
    : t("pages.utility.card.upvote"),
);

const favoriteTitle = computed(() =>
  isFavorited.value
    ? t("pages.utility.card.unfavorite")
    : t("pages.utility.card.favorite"),
);
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group flex flex-col gap-2 rounded-md border bg-card/40 p-3 text-left transition-colors duration-150 [backdrop-filter:blur(6px)] cursor-pointer"
    :class="
      selected
        ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
        : 'border-border hover:border-[hsl(var(--tac-amber)/0.35)]'
    "
    @click="emit('select', lineup.id)"
    @keydown.enter="emit('select', lineup.id)"
    @keydown.space.prevent="emit('select', lineup.id)"
    @mouseenter="emit('hover', lineup.id)"
    @mouseleave="emit('hover', null)"
  >
    <div class="flex items-start gap-2">
      <span
        aria-hidden="true"
        class="mt-1 h-3 w-3 shrink-0 rounded-[2px]"
        :style="{ backgroundColor: color }"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold leading-tight">
          {{ lineup.name }}
        </div>
        <div
          class="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t(`pages.utility.types.${lineup.utility_type}`) }}
          ·
          {{ $t(`pages.utility.sides.${lineup.side}`) }}
        </div>
      </div>

      <button
        v-if="showFork"
        type="button"
        class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.utility.fork.action')"
        @click.stop="emit('fork', lineup.id)"
      >
        <GitFork class="h-4 w-4" />
      </button>

      <button
        v-if="showArchive && lineup.can_edit"
        type="button"
        class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        :title="$t('pages.utility.archive.action')"
        @click.stop="emit('archive', lineup.id)"
      >
        <Archive class="h-4 w-4" />
      </button>

      <NuxtLink
        v-if="showOpenLink"
        :to="{ name: 'utility-lineup-id', params: { id: lineup.id } }"
        class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.utility.card.open')"
        @click.stop
      >
        <ArrowUpRight class="h-4 w-4" />
      </NuxtLink>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" class="font-mono text-[0.6rem] uppercase">
        {{ $t(`pages.utility.techniques.${lineup.technique}`) }}
      </Badge>
      <Badge variant="outline" class="font-mono text-[0.6rem] uppercase">
        {{ $t(`pages.utility.strengths.${lineup.throw_strength}`) }}
      </Badge>
      <UtilityDifficultyChip :difficulty="lineup.difficulty" compact />
      <Badge
        v-if="jumpBind !== 'no'"
        variant="outline"
        class="font-mono text-[0.6rem] uppercase"
        :class="jumpBind === 'unknown' ? 'text-muted-foreground' : ''"
      >
        {{
          jumpBind === "unknown"
            ? $t("pages.utility.card.jump_bind_unknown")
            : $t("pages.utility.card.jump_bind")
        }}
      </Badge>
      <span
        v-if="flightSeconds"
        class="inline-flex items-center gap-1 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
      >
        <Timer class="h-3 w-3" />
        {{ $t("pages.utility.card.flight_time", { seconds: flightSeconds }) }}
      </span>
      <span
        v-if="metaThrowers"
        class="inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.35)] px-1.5 py-0.5 font-mono text-[0.6rem] tabular-nums uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
        :title="$t('pages.utility.meta.throwers_hint')"
      >
        <Users class="h-3 w-3" />
        {{ $t("pages.utility.meta.throwers", { count: metaThrowers }) }}
      </span>
    </div>

    <UtilityConfidenceNote :lineup="lineup" compact />

    <UtilityProgressPanel :progress="lineup.progress" compact />

    <div
      v-if="lineup.tags?.length"
      class="flex flex-wrap gap-1 text-[0.6rem] text-muted-foreground"
    >
      <span
        v-for="tag of lineup.tags"
        :key="tag"
        class="rounded-sm border border-border/70 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em]"
      >
        {{ tag }}
      </span>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 pt-1">
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

      <!-- Real controls, not a readout. These were counts you could not change,
           which reads as a broken button rather than a statistic. -->
      <div
        class="flex shrink-0 items-center gap-0.5 font-mono text-[0.65rem] tabular-nums"
      >
        <button
          type="button"
          :disabled="!canReact"
          class="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors disabled:cursor-default disabled:opacity-60"
          :class="
            myVote === 1
              ? 'text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground enabled:hover:bg-muted/50 enabled:hover:text-foreground'
          "
          :title="voteTitle"
          @click.stop="emit('vote', lineup.id, 1)"
        >
          <ThumbsUp
            class="h-3 w-3 transition-transform"
            :class="myVote === 1 ? 'fill-current scale-110' : ''"
          />
          {{ score }}
        </button>

        <button
          type="button"
          :disabled="!canReact"
          class="inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors disabled:cursor-default disabled:opacity-60"
          :class="
            isFavorited
              ? 'text-destructive'
              : 'text-muted-foreground enabled:hover:bg-muted/50 enabled:hover:text-foreground'
          "
          :title="favoriteTitle"
          @click.stop="emit('favorite', lineup.id)"
        >
          <Heart
            class="h-3 w-3 transition-transform"
            :class="isFavorited ? 'fill-current scale-110' : ''"
          />
          {{ favoriteCount }}
        </button>
      </div>
    </div>
  </div>
</template>
