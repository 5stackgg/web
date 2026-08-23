<script setup lang="ts">
import { computed, watch } from "vue";
import { PencilLine } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import UtilityThrowersMeter from "~/components/utility/UtilityThrowersMeter.vue";
import { matchUtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilitySide,
  UtilityType,
} from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    spots: UtilityMetaSpot[];
    lineups: UtilityLineup[];
    selectedKey: string | null;
    hoveredKey: string | null;
    canAuthor: boolean;
    threshold: string;
    thresholdOptions: Array<{ key: string; label: string }>;
    types: UtilityType[];
    sides: UtilitySide[];
    // The page has not asked this map for its mined spots yet. An empty list
    // is then not an answer, and "nobody throws anything here" is the wrong
    // thing to print over a map that simply has not been queried.
    loading?: boolean;
  }>(),
  { loading: false },
);

const emit = defineEmits<{
  (event: "update:selectedKey", value: string | null): void;
  (event: "update:hoveredKey", value: string | null): void;
  (event: "update:threshold", value: string): void;
  (event: "open", id: string): void;
  (event: "write-up", spot: UtilityMetaSpot): void;
}>();

const thresholdModel = computed<string>({
  get: () => props.threshold,
  set: (value) => emit("update:threshold", value),
});

const visibleSpots = computed(() =>
  props.spots.filter((spot) => {
    if (props.types.length && !props.types.includes(spot.utilityType)) {
      return false;
    }
    if (
      props.sides.length &&
      (!spot.side || !props.sides.includes(spot.side as UtilitySide))
    ) {
      return false;
    }
    return true;
  }),
);

// Which saved lineups sit in a cluster; the panel shows THOSE. A spot only
// appears as itself when there is no lineup to stand in for it.
const lineupsBySpot = computed(() => {
  const grouped: Record<string, UtilityLineup[]> = {};
  for (const lineup of props.lineups) {
    const spot = matchUtilityMetaSpot(lineup, props.spots);
    if (spot) {
      (grouped[spot.key] ??= []).push(lineup);
    }
  }
  return grouped;
});

// Every bar is read against the busiest spot on the map -- the same number the
// lineup list reads against -- so the column shows the shape of the
// distribution rather than eight bars all pinned full.
const busiest = computed(() =>
  Math.max(1, ...props.spots.map((spot) => spot.throwers)),
);

const rows = computed(() =>
  visibleSpots.value.map((spot) => {
    const matched = lineupsBySpot.value[spot.key] ?? [];
    return {
      spot,
      matched,
      // The server's count wins; the page can only see the lineups it fetched.
      unwritten: (spot.lineups || matched.length) === 0,
    };
  }),
);

// Throws add up across clusters; throwers do not — the same player shows up in
// every spot they throw, so summing `throwers` would invent a player count.
const totalThrows = computed(() =>
  visibleSpots.value.reduce((sum, spot) => sum + spot.throws, 0),
);

const unwrittenCount = computed(
  () => rows.value.filter((row) => row.unwritten).length,
);

const refreshedAt = computed(() => {
  let newest: string | null = null;
  for (const spot of props.spots) {
    if (spot.refreshedAt && (!newest || spot.refreshedAt > newest)) {
      newest = spot.refreshedAt;
    }
  }
  return newest;
});

// Picking a ring on the board has to bring its row over, or the panel is just
// a list you have to hunt through for the thing you already pointed at.
watch(
  () => props.selectedKey,
  (key) => {
    if (!key || typeof document === "undefined") {
      return;
    }
    document
      .getElementById(`utility-meta-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
);

function toggle(key: string) {
  emit("update:selectedKey", props.selectedKey === key ? null : key);
}

// A spot filtered out from under the selection would otherwise stay highlighted
// on the board with nothing in the list pointing at it.
watch(visibleSpots, (list) => {
  if (
    props.selectedKey &&
    !list.some((spot) => spot.key === props.selectedKey)
  ) {
    emit("update:selectedKey", null);
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Distinct players, so the floor cannot be met by one person throwing
         the same spot over and over. -->
    <div class="flex items-center gap-2">
      <span
        class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.meta.min_throwers") }}
      </span>
      <AnimatedFilters
        v-model="thresholdModel"
        :options="thresholdOptions"
        square
        class="ml-auto"
      />
    </div>

    <div
      v-if="!loading"
      class="flex items-center justify-between gap-2 px-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span>
        {{
          $t("pages.utility.meta.summary", {
            spots: visibleSpots.length,
            throws: totalThrows,
          })
        }}
        <span
          v-if="unwrittenCount"
          class="ml-1 text-[hsl(var(--tac-amber))]"
        >
          · {{ $t("pages.utility.meta.unwritten_count", { count: unwrittenCount }) }}
        </span>
      </span>
      <span v-if="refreshedAt" class="flex shrink-0 items-center gap-1">
        <TimeAgo :date="refreshedAt" hide-icon />
      </span>
    </div>

    <HeightSwap>
    <UtilitySkeletonList v-if="loading" key="loading" :count="3" />

    <UtilityEmpty
      v-else-if="!rows.length"
      key="empty"
      :title="$t('pages.utility.meta.empty')"
      :description="$t('pages.utility.meta.empty_description')"
    />

    <!-- The lineups themselves, in mined order: the busiest cluster's write-up
         first. A cluster nobody has written up has no lineup to show, so it
         holds its place with a dashed stub until someone fills it.

         The threshold chips swap the whole set, so rows arrive and leave
         rather than blink; the gap rides inside the clip (-mt on the list,
         pt inside each cell) so it collapses with a leaving row instead of
         leaving a hole. -->
    <TransitionGroup v-else key="rows" tag="div" name="mrow" class="-mt-2 flex flex-col">
      <div v-for="row of rows" :key="row.spot.key" class="mrow">
        <div class="min-h-0 overflow-hidden">
        <div
          :id="`utility-meta-${row.spot.key}`"
          class="flex flex-col gap-2 pt-2"
        >
          <template v-if="row.matched.length">
            <UtilityLineupCard
              v-for="lineup of row.matched"
              :key="lineup.id"
              :lineup="lineup"
              :mode="selectedKey === row.spot.key ? 'card' : 'row'"
              :selected="selectedKey === row.spot.key"
              :hovered="hoveredKey === row.spot.key"
              :meta-throwers="row.spot.throwers"
              :meta-throws="row.spot.throws"
              :meta-busiest="busiest"
              open-in-place
              @select="() => toggle(row.spot.key)"
              @hover="(id) => emit('update:hoveredKey', id ? row.spot.key : null)"
              @open="(id) => emit('open', id)"
            />
          </template>

          <div
            v-else
            role="button"
            tabindex="0"
            class="flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed py-2 pl-3 pr-2.5 transition-colors duration-150"
            :class="
              selectedKey === row.spot.key
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
                : hoveredKey === row.spot.key
                  ? 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.03)]'
                  : 'border-border/70 hover:border-[hsl(var(--tac-amber)/0.35)]'
            "
            @click="toggle(row.spot.key)"
            @keydown.enter="toggle(row.spot.key)"
            @keydown.space.prevent="toggle(row.spot.key)"
            @mouseenter="emit('update:hoveredKey', row.spot.key)"
            @mouseleave="emit('update:hoveredKey', null)"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span
                class="truncate text-sm font-medium leading-tight text-muted-foreground"
              >
                {{ $t("pages.utility.meta.unwritten") }}
              </span>
              <span
                class="truncate font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground"
              >
                {{ $t(`pages.utility.types.${row.spot.utilityType}`) }}
                <template v-if="row.spot.side">
                  · {{ $t(`pages.utility.sides.${row.spot.side}`) }}
                </template>
                <template v-if="row.spot.technique">
                  · {{ $t(`pages.utility.techniques.${row.spot.technique}`) }}
                </template>
              </span>
            </div>

            <!-- Two verbs, no words. An unwritten spot offers exactly two
                 things -- go throw it, or write it down -- and at this row
                 height a pair of labels would push the classification line
                 into a truncation. The glyphs carry it and the bubbles say
                 the rest, which is what FiveStackToolTip is for.

                 Try-it comes first because it is the cheaper of the two: you
                 find out whether the spot is worth writing up by standing on
                 it, not by opening the author form. -->
            <div class="flex shrink-0 items-center gap-0.5" @click.stop>
              <UtilityPracticeButton
                :spot="row.spot"
                :map-name="mapName"
                shape="icon"
              />
              <FiveStackToolTip v-if="canAuthor" as-child :delay-duration="120">
                <template #trigger>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="h-7 w-7 shrink-0 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
                    @click.stop="emit('write-up', row.spot)"
                  >
                    <PencilLine class="h-3.5 w-3.5" />
                  </Button>
                </template>
                <div class="flex max-w-[15rem] flex-col gap-1">
                  <span class="text-xs font-medium">
                    {{ $t("pages.utility.meta.write_up") }}
                  </span>
                  <span class="text-xs leading-relaxed text-muted-foreground">
                    {{ $t("pages.utility.meta.write_up_hint") }}
                  </span>
                </div>
              </FiveStackToolTip>
            </div>

            <UtilityThrowersMeter
              :count="row.spot.throwers"
              :max="busiest"
              amber
            />

            <!-- A written-up spot is a lineup card, and a lineup card always
                 reserves its overflow trigger whether or not the trigger is
                 showing. A stub has no menu to reserve, so without this its
                 meter sat 34px right of every meter above and below it and the
                 column read as a padding bug. Same box, same offsets, nothing
                 in it. -->
            <span class="-mr-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          </div>
        </div>
        </div>
      </div>
    </TransitionGroup>
    </HeightSwap>
  </div>
</template>

<style scoped>
/* Fold, do not fly: the row's own height carries the change, so the rows below
   follow it instead of jumping to meet it. */
.mrow {
  display: grid;
  grid-template-rows: 1fr;
}
.mrow-enter-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 220ms ease-out;
}
.mrow-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 110ms ease-in;
}
.mrow-enter-from,
.mrow-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.mrow-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .mrow-enter-active,
  .mrow-leave-active,
  .mrow-move {
    transition-duration: 1ms;
  }
}
</style>
