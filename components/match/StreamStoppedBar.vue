<script setup lang="ts">
import { Play, Square } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import { useStreamMatchSummary } from "~/composables/useStreamMatchSummary";

// What a stopped stream folds into: one line with the match state and a
// way back in. The page gets the 16:9 frame back while it stays obvious
// the match is still live.
const props = withDefaults(
  defineProps<{
    matchId?: string | null;
    // Show the LIVE tag with the viewer count (game-streamer feed only;
    // the count is of our own WHEP viewers).
    live?: boolean;
    // Shown when there's no match to summarise (an embed off a match page).
    label?: string | null;
  }>(),
  { matchId: null, live: false, label: null },
);

const emit = defineEmits<{ (e: "watch"): void }>();

const { summary } = useStreamMatchSummary(() => ({ matchId: props.matchId }));
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card px-3 py-2.5"
  >
    <div class="flex shrink-0 items-center gap-3">
      <StreamLiveTag v-if="live && matchId" :match-id="matchId" />
      <span
        class="inline-flex items-center gap-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        <Square class="size-2.5 fill-current" />
        {{ $t("match.stream.stopped") }}
      </span>
    </div>

    <div
      v-if="summary"
      class="flex min-w-0 flex-[1_1_14rem] flex-wrap items-baseline gap-x-2 text-sm font-semibold"
    >
      <span class="truncate">{{ summary.rows[0].name }}</span>
      <template
        v-if="summary.rows[0].score !== null && summary.rows[1].score !== null"
      >
        <span class="tabular-nums">{{ summary.rows[0].score }}</span>
        <span class="text-muted-foreground">:</span>
        <span class="tabular-nums">{{ summary.rows[1].score }}</span>
      </template>
      <span v-else class="text-muted-foreground">{{
        $t("match.simple.vs")
      }}</span>
      <span class="truncate">{{ summary.rows[1].name }}</span>
      <span
        v-if="summary.meta"
        class="truncate text-xs font-medium text-muted-foreground"
        >{{ summary.meta }}</span
      >
    </div>
    <span
      v-else-if="label"
      class="min-w-0 flex-[1_1_10rem] truncate text-sm font-semibold"
      >{{ label }}</span
    >

    <Button
      size="sm"
      variant="tactical"
      class="ml-auto shrink-0 [&_svg]:size-3"
      @click="emit('watch')"
    >
      <Play class="fill-current" />
      {{ $t("match.stream.resume") }}
    </Button>
  </div>
</template>
