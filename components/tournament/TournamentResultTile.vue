<script setup lang="ts">
import { computed } from "vue";
import { Trophy } from "lucide-vue-next";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";

const props = defineProps<{ tournament: any }>();
defineEmits<{ (e: "quick-look"): void }>();

const { bannerSrc, statusLabel, champion, start, teams } =
  useTournamentDisplay(() => props.tournament);

const cancelled = computed(
  () => props.tournament.status !== e_tournament_status_enum.Finished,
);

const played = computed(() =>
  start.value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(start.value)
    : null,
);
</script>

<template>
  <button
    type="button"
    class="group/tile flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-card/40 text-left transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :aria-label="$t('quick_look.at', { name: tournament.name })"
    @click="$emit('quick-look')"
  >
    <span class="relative block aspect-[2/1] overflow-hidden bg-muted/40">
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-300 group-hover/tile:scale-[1.04] motion-reduce:transition-none"
        :class="{ 'brightness-[0.6] grayscale': cancelled }"
      />
    </span>
    <span class="grid min-w-0 gap-1 p-3">
      <b class="line-clamp-2 text-sm font-bold leading-snug">
        {{ tournament.name }}
      </b>
      <span
        v-if="champion"
        class="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-semibold"
      >
        <Trophy class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span class="truncate">{{ champion }}</span>
      </span>
      <span v-else class="text-xs text-muted-foreground">{{ statusLabel }}</span>
      <span class="text-xs tabular-nums text-muted-foreground">
        {{ played
        }}<template v-if="!cancelled">
          · {{ teams }} {{ $t("pages.watch.events.count_teams", teams) }}</template
        >
      </span>
    </span>
  </button>
</template>
