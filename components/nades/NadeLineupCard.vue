<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowUpRight,
  GitFork,
  Heart,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Users,
} from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import NadeConfidenceNote from "~/components/nades/NadeConfidenceNote.vue";
import NadeDifficultyChip from "~/components/nades/NadeDifficultyChip.vue";
import NadeProgressPanel from "~/components/nades/NadeProgressPanel.vue";
import { NADE_TYPE_COLORS, jumpThrowBindState } from "~/utilities/nadeDisplay";
import type { NadeLineup } from "~/types/nade";

const props = withDefaults(
  defineProps<{
    lineup: NadeLineup;
    selected?: boolean;
    // How many distinct players threw this in real matches, when the mined
    // meta has a cluster that lines up with it.
    metaThrowers?: number | null;
    showOpenLink?: boolean;
    // Off by default: the pickers and the solve panel show cards for choosing,
    // not for copying, and a second icon there is only noise.
    showFork?: boolean;
  }>(),
  {
    selected: false,
    metaThrowers: null,
    showOpenLink: true,
    showFork: false,
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "hover", id: string | null): void;
  (e: "fork", id: string): void;
}>();

const color = computed(
  () => NADE_TYPE_COLORS[props.lineup.nade_type] ?? "#ffffff",
);

const flightSeconds = computed(() => {
  const ms = props.lineup.flight_time_ms;
  if (!ms) {
    return null;
  }
  return (ms / 1000).toFixed(1);
});

const score = computed(
  () => (props.lineup.upvotes ?? 0) - (props.lineup.downvotes ?? 0),
);

const jumpBind = computed(() => jumpThrowBindState(props.lineup));
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
          {{ $t(`pages.nades.types.${lineup.nade_type}`) }}
          ·
          {{ $t(`pages.nades.sides.${lineup.side}`) }}
        </div>
      </div>

      <button
        v-if="showFork"
        type="button"
        class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.nades.fork.action')"
        @click.stop="emit('fork', lineup.id)"
      >
        <GitFork class="h-4 w-4" />
      </button>

      <NuxtLink
        v-if="showOpenLink"
        :to="{ name: 'nades-lineup-id', params: { id: lineup.id } }"
        class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('pages.nades.card.open')"
        @click.stop
      >
        <ArrowUpRight class="h-4 w-4" />
      </NuxtLink>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" class="font-mono text-[0.6rem] uppercase">
        {{ $t(`pages.nades.techniques.${lineup.technique}`) }}
      </Badge>
      <Badge variant="outline" class="font-mono text-[0.6rem] uppercase">
        {{ $t(`pages.nades.strengths.${lineup.throw_strength}`) }}
      </Badge>
      <NadeDifficultyChip :difficulty="lineup.difficulty" compact />
      <Badge
        v-if="jumpBind !== 'no'"
        variant="outline"
        class="font-mono text-[0.6rem] uppercase"
        :class="jumpBind === 'unknown' ? 'text-muted-foreground' : ''"
      >
        {{
          jumpBind === "unknown"
            ? $t("pages.nades.card.jump_bind_unknown")
            : $t("pages.nades.card.jump_bind")
        }}
      </Badge>
      <span
        v-if="flightSeconds"
        class="inline-flex items-center gap-1 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
      >
        <Timer class="h-3 w-3" />
        {{ $t("pages.nades.card.flight_time", { seconds: flightSeconds }) }}
      </span>
      <span
        v-if="metaThrowers"
        class="inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.35)] px-1.5 py-0.5 font-mono text-[0.6rem] tabular-nums uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
        :title="$t('pages.nades.meta.throwers_hint')"
      >
        <Users class="h-3 w-3" />
        {{ $t("pages.nades.meta.throwers", { count: metaThrowers }) }}
      </span>
    </div>

    <NadeConfidenceNote :lineup="lineup" compact />

    <NadeProgressPanel :progress="lineup.progress" compact />

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
        {{ $t("pages.nades.card.unknown_author") }}
      </span>

      <div
        class="flex shrink-0 items-center gap-2 font-mono text-[0.65rem] tabular-nums text-muted-foreground"
      >
        <span class="inline-flex items-center gap-1">
          <ThumbsUp v-if="score >= 0" class="h-3 w-3" />
          <ThumbsDown v-else class="h-3 w-3" />
          {{ score }}
        </span>
        <span class="inline-flex items-center gap-1">
          <Heart
            class="h-3 w-3"
            :class="lineup.is_favorited ? 'fill-current text-destructive' : ''"
          />
          {{ lineup.favorites ?? 0 }}
        </span>
      </div>
    </div>
  </div>
</template>
