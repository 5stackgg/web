<script setup lang="ts">
import { computed } from "vue";
import { PencilLine, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityThrowersMeter from "~/components/utility/UtilityThrowersMeter.vue";
import type { UtilityLineup, UtilityMetaSpot } from "~/utilities/utilityDisplay";

const props = defineProps<{
  spot: UtilityMetaSpot;
  /** Saved lineups already sitting in this cluster. */
  lineups: UtilityLineup[];
  /** The busiest spot on the map, so the meter reads against the same scale. */
  busiest: number;
  canAuthor: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "open", id: string): void;
  (event: "write-up", spot: UtilityMetaSpot): void;
}>();

// The cluster's median look, which is the half of a lineup that is hard to
// recover by standing in the right place and guessing.
const aim = computed(() => {
  const { viewYaw, viewPitch } = props.spot;
  if (viewYaw === null || viewPitch === null) {
    return null;
  }
  return { yaw: viewYaw.toFixed(1), pitch: viewPitch.toFixed(1) };
});

// The server counted the whole cluster; this page only ever fetched a window of
// lineups, so a spot can be written up without a card here to prove it.
const unwritten = computed(
  () => (props.spot.lineups || props.lineups.length) === 0,
);
</script>

<template>
  <!-- Picking a ring on the map is a question about that ring, and the answer
       belongs where the answers live -- in the column, not in a popover pinned
       to a moving target on the board. -->
  <section
    class="flex flex-col gap-2.5 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.05)] p-3"
  >
    <header class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <span
          class="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-[hsl(var(--tac-amber)/0.85)]"
        >
          {{ $t("pages.utility.meta.classification") }}
        </span>
        <span
          class="truncate font-mono text-[0.68rem] uppercase leading-tight tracking-[0.1em]"
        >
          {{ $t(`pages.utility.types.${spot.utilityType}`) }}
          <template v-if="spot.side">
            · {{ $t(`pages.utility.sides.${spot.side}`) }}
          </template>
          <template v-if="spot.technique">
            · {{ $t(`pages.utility.techniques.${spot.technique}`) }}
          </template>
        </span>
      </div>

      <UtilityThrowersMeter :count="spot.throwers" :max="busiest" amber />

      <button
        type="button"
        class="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :title="$t('common.close')"
        @click="emit('close')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </header>

    <p
      class="font-mono text-[0.62rem] leading-relaxed tracking-[0.06em] text-muted-foreground"
    >
      {{
        $t("pages.utility.meta.usage_detail", {
          throwers: spot.throwers,
          throws: spot.throws,
          matches: spot.matches,
        })
      }}
    </p>

    <!-- Where to look, in the numbers the game reports them in. This is the
         part of a mined spot that is already solved. -->
    <p
      v-if="aim"
      class="font-mono text-[0.62rem] leading-relaxed tracking-[0.06em] text-muted-foreground"
    >
      <span class="text-[hsl(var(--tac-amber)/0.75)]">
        {{ $t("pages.utility.meta.aim") }}
      </span>
      <span class="ml-1.5 tabular-nums text-foreground/80">
        {{ aim.yaw }} / {{ aim.pitch }}
      </span>
    </p>

    <div class="h-px bg-[hsl(var(--tac-amber)/0.2)]" />

    <template v-if="lineups.length">
      <span
        class="font-mono text-[0.55rem] uppercase leading-none tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.meta.matching_lineups") }}
      </span>
      <!-- Real lineup rows, not a summary of them: from here everything a
           lineup can do -- open it, drop it in a collection, fork it -- is one
           click away in the place it already lives. -->
      <UtilityLineupCard
        v-for="lineup of lineups"
        :key="lineup.id"
        :lineup="lineup"
        mode="row"
        :meta-throwers="spot.throwers"
        :meta-throws="spot.throws"
        :meta-busiest="busiest"
        open-in-place
        @select="(id) => emit('open', id)"
        @open="(id) => emit('open', id)"
      />
    </template>

    <!-- Nobody wrote it down, so the only move is to write it down. The author
         opens seeded with this cluster's own origin and aim, which is the
         expensive half already done. -->
    <template v-else-if="unwritten">
      <span class="text-sm font-medium leading-tight text-muted-foreground">
        {{ $t("pages.utility.meta.unwritten") }}
      </span>
      <p class="text-xs leading-relaxed text-muted-foreground">
        {{ $t("pages.utility.meta.no_lineups_description") }}
      </p>
      <Button
        v-if="canAuthor"
        size="sm"
        variant="outline"
        class="h-8 self-start border-[hsl(var(--tac-amber)/0.45)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
        :title="$t('pages.utility.meta.write_up_hint')"
        @click="emit('write-up', spot)"
      >
        <PencilLine class="mr-1.5 h-3.5 w-3.5" />
        {{ $t("pages.utility.meta.write_up") }}
      </Button>
    </template>

    <!-- Written up, but not in the window of lineups this page happens to have
         loaded. Saying "none" here would be a lie the Meta tab disproves. -->
    <p v-else class="text-xs leading-relaxed text-muted-foreground">
      {{ $t("pages.utility.meta.match_gap", { shown: 0, count: spot.lineups }) }}
    </p>
  </section>
</template>
