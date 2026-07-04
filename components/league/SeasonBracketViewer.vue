<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "~/components/ui/button";
import { ExternalLink, Network } from "lucide-vue-next";

// Embeds the real tournament stage viewer (round-robin / swiss / elimination)
// per division, via the platform's chromeless bracket embed. The embed runs its
// own live subscription, so it always has the full bracket data the league
// query doesn't select.
const props = defineProps<{
  seasonId: string;
  seasonDivisions: any[];
  regularSeasonStageType?: string | null;
  playoffStageType?: string | null;
}>();

const FORMAT_LABEL: Record<string, string> = {
  RoundRobin: "Round Robin",
  Swiss: "Swiss",
  SingleElimination: "Single Elim",
  DoubleElimination: "Double Elim",
};

const playable = computed(() =>
  (props.seasonDivisions ?? []).filter((sd: any) => sd.tournament_id),
);

const selectedDivisionId = ref<string>("");
watch(
  playable,
  (list) => {
    if (
      !list.some(
        (sd: any) => sd.league_division_id === selectedDivisionId.value,
      )
    ) {
      selectedDivisionId.value = list[0]?.league_division_id ?? "";
    }
  },
  { immediate: true },
);

const activeDivision = computed(
  () =>
    playable.value.find(
      (sd: any) => sd.league_division_id === selectedDivisionId.value,
    ) ?? playable.value[0],
);

// Stage order 1 = regular season (RR/Swiss), order 2 = playoffs (elimination).
const stages = computed(() => {
  const list = [...(activeDivision.value?.tournament?.stages ?? [])].sort(
    (a: any, b: any) => a.order - b.order,
  );
  return list.map((s: any) => ({
    order: s.order,
    type: s.type,
    label: s.order === 1 ? "regular_season" : "playoffs",
    formatLabel: FORMAT_LABEL[s.type] ?? s.type,
  }));
});

const selectedStageOrder = ref<number>(1);
watch(
  stages,
  (list) => {
    if (!list.some((s) => s.order === selectedStageOrder.value)) {
      selectedStageOrder.value = list[0]?.order ?? 1;
    }
  },
  { immediate: true },
);

const activeStage = computed(() =>
  stages.value.find((s) => s.order === selectedStageOrder.value),
);

const embedSrc = computed(() => {
  const tid = activeDivision.value?.tournament_id;
  if (!tid) return "";
  return `/embed/tournaments/${tid}/bracket?stage=${selectedStageOrder.value}`;
});

const tournamentRoute = computed(() => ({
  name: "league-seasons-seasonId-tournaments-tournamentId",
  params: {
    seasonId: props.seasonId,
    tournamentId: activeDivision.value?.tournament_id,
  },
}));
</script>

<template>
  <div v-if="playable.length" class="space-y-3">
    <!-- Division + stage selectors -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div v-if="playable.length > 1" class="flex flex-wrap gap-1.5">
          <button
            v-for="sd in playable"
            :key="sd.id"
            class="inline-flex h-8 items-center rounded-md border px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors"
            :class="
              activeDivision?.id === sd.id
                ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
            "
            @click="selectedDivisionId = sd.league_division_id"
          >
            {{ sd.division.name }}
          </button>
        </div>

        <div
          v-if="stages.length > 1"
          class="flex gap-1.5 border-l border-border/60 pl-3"
        >
          <button
            v-for="stage in stages"
            :key="stage.order"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors"
            :class="
              selectedStageOrder === stage.order
                ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
            "
            @click="selectedStageOrder = stage.order"
          >
            <Network class="h-3 w-3" />
            {{ $t(`league.bracket.${stage.label}`) }}
          </button>
        </div>
      </div>

      <NuxtLink :to="tournamentRoute">
        <Button size="sm" variant="outline" class="h-8 gap-1.5">
          <ExternalLink class="h-3.5 w-3.5" />
          {{ $t("league.bracket.open_full") }}
        </Button>
      </NuxtLink>
    </div>

    <!-- Format caption -->
    <div
      v-if="activeStage"
      class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
    >
      <span class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
      {{ $t(`league.bracket.${activeStage.label}`) }}
      <span class="opacity-50">·</span>
      <span class="text-[hsl(var(--tac-amber))]">{{
        activeStage.formatLabel
      }}</span>
    </div>

    <!-- Embedded stage viewer -->
    <div class="overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        :key="embedSrc"
        :src="embedSrc"
        class="h-[560px] w-full sm:h-[640px]"
        loading="lazy"
        frameborder="0"
      />
    </div>
  </div>

  <p v-else class="py-8 text-center text-sm text-muted-foreground">
    {{ $t("league.bracket.empty") }}
  </p>
</template>
