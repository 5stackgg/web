<script setup lang="ts">
import { computed } from "vue";
import BanMapIcon from "~/components/bans/BanMapIcon.vue";
import mapLabel from "~/utilities/mapLabel";
import { sharedSide, type SharedMatch } from "~/utilities/bans";

// The viewer's matches with a banned player: map and score, each a link to
// the match. Scores take the app's outcome colours.
const props = withDefaults(
  defineProps<{ matches: SharedMatch[]; max?: number; showSide?: boolean }>(),
  { max: 2, showSide: true },
);

const shown = computed(() => props.matches.slice(0, props.max));
const more = computed(() => Math.max(0, props.matches.length - props.max));
const side = computed(() => sharedSide(props.matches));

function scoreClass(match: SharedMatch) {
  if (match.won === true) return "text-green-400";
  if (match.won === false) return "text-red-400";
  return "text-foreground";
}
</script>

<template>
  <div class="grid min-w-0 gap-1">
    <div class="flex min-w-0 flex-wrap items-center gap-1">
      <NuxtLink
        v-for="match in shown"
        :key="match.match_id"
        :to="{ name: 'matches-id', params: { id: match.match_id } }"
        class="relative z-[2] inline-flex h-[1.375rem] items-center gap-1 rounded border border-border bg-background/60 pl-0.5 pr-1.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)] [@media(hover:hover)]:hover:border-muted-foreground/40"
        :title="match.map ? mapLabel({ name: match.map }) : undefined"
        :aria-label="
          $t('pages.bans.with_you.match_label', {
            map: match.map ? mapLabel({ name: match.map }) : '',
            score: `${match.viewer_score}–${match.other_score}`,
          })
        "
      >
        <BanMapIcon :map="match.map" class="!size-4" />
        <span class="font-semibold tabular-nums" :class="scoreClass(match)"
          >{{ match.viewer_score }}–{{ match.other_score }}</span
        >
      </NuxtLink>
      <span v-if="more" class="text-xs text-muted-foreground">+{{ more }}</span>
    </div>
    <span v-if="showSide && side" class="text-xs text-muted-foreground/80">
      {{ $t(`pages.bans.with_you.${side}`) }}
    </span>
  </div>
</template>
