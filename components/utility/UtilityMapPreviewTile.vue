<script setup lang="ts">
import { computed, ref } from "vue";
import { Lock } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import {
  morphFromRect,
  restingRect,
} from "~/composables/useUtilityMapHandoff";
import type { UtilityMapRect } from "~/composables/useUtilityMapHandoff";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type {
  UtilityMapLanding,
  UtilityMapTile,
} from "~/composables/useUtilityMaps";
import type { UtilityType } from "~/types/utility";

/**
 * One map on the maps index: its radar, with the library drawn on it. A full
 * shelf and an empty one look different before a number is read.
 *
 * A mark is not a lineup, it is a place lineups land. Landings that fall
 * together are one mark that grows with how many there are, so ten lineups
 * read as ten dots and three hundred read as where the library is thick --
 * not as a radar buried under three hundred dots.
 *
 * Two shapes, one markup. On a phone or tablet the tiles flow down the page: a
 * square radar with its name under it. On desktop the index is a block the
 * exact size of the map board, cut into cells, and a tile fills its cell: the
 * radar takes the cell's height and the name lies along its foot.
 */
const props = defineProps<{
  tile: UtilityMapTile;
  landings: UtilityMapLanding[];
  count: number;
  privateCount: number;
}>();

const { radarSrc, projectCalibrated, CANVAS } = useRadarProjection(
  () => props.tile.name,
  { volumePoints: () => props.landings },
);

// The radar is cut into this many cells a side; landings sharing one are one
// mark. About the width of a choke point on the tile.
const CELLS = 22;
// Radii in the radar's own units. One lineup is a dot you can just see; a
// crowded spot stops growing well short of its cell, so two busy neighbours
// stay two marks, and it thins as it grows so the radar still reads under it.
const DOT = 15;
const DOT_MAX = 29;

const marks = computed(() => {
  const size = CANVAS / CELLS;
  const cells = new Map<
    string,
    { x: number; y: number; n: number; types: Map<UtilityType, number> }
  >();
  for (const landing of props.landings) {
    const point = projectCalibrated(landing);
    if (!point) {
      continue;
    }
    const key = `${Math.floor(point.x / size)}:${Math.floor(point.y / size)}`;
    const cell = cells.get(key) ?? { x: 0, y: 0, n: 0, types: new Map() };
    cell.x += point.x;
    cell.y += point.y;
    cell.n += 1;
    cell.types.set(landing.type, (cell.types.get(landing.type) ?? 0) + 1);
    cells.set(key, cell);
  }
  return [...cells.entries()]
    .map(([key, cell]) => {
      // The colour of what mostly lands there.
      let type: UtilityType = "Smoke";
      let most = 0;
      for (const [entry, n] of cell.types) {
        if (n > most) {
          most = n;
          type = entry;
        }
      }
      return {
        key,
        x: cell.x / cell.n,
        y: cell.y / cell.n,
        r: Math.min(DOT_MAX, DOT * Math.pow(cell.n, 0.3)),
        color: UTILITY_TYPE_COLORS[type] ?? "#ffffff",
      };
    })
    // Big ones first, so a lone dot beside a crowd is drawn over its edge.
    .sort((a, b) => b.r - a.r);
});

// The radar is the map's board in small, and the two change places: the page
// asks where this one is drawn when a map is picked, and coming back from a
// map the radar shrinks into its tile out of where the board was. It is let
// out of the tile's clip for as long as that takes.
const link = ref<{ $el?: HTMLElement } | null>(null);
const radar = ref<SVGSVGElement | null>(null);

function shrinkFrom(from: UtilityMapRect) {
  const tile = link.value?.$el;
  const animation = morphFromRect(radar.value, from);
  if (!tile || !animation) {
    return;
  }
  // The board draws its radar at full strength; the tile settles to its own.
  radar.value?.querySelector("image")?.animate([{ opacity: 1 }], {
    duration: 420,
    easing: "ease-out",
  });
  tile.style.overflow = "visible";
  tile.style.zIndex = "10";
  const settle = () => {
    tile.style.overflow = "";
    tile.style.zIndex = "";
  };
  animation.addEventListener("finish", settle);
  animation.addEventListener("cancel", settle);
}

defineExpose({
  rect: () => restingRect(radar.value),
  src: radarSrc,
  shrinkFrom,
});
</script>

<template>
  <NuxtLink
    ref="link"
    :to="{ name: 'utility-map', params: { map: tile.name } }"
    class="group relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.07] bg-zinc-900/50 text-left transition-[border-color,background-color,transform] duration-200 ease-out hover:border-white/[0.22] hover:bg-zinc-900/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
  >
    <span class="relative block aspect-square lg:aspect-auto lg:min-h-0 lg:flex-1">
      <!-- Centred with auto margins, not a translate: the transform is
           left free for the radar to be played out of the board's place. -->
      <svg
        v-if="radarSrc"
        ref="radar"
        :viewBox="`0 0 ${CANVAS} ${CANVAS}`"
        class="absolute inset-[7%] h-[86%] w-[86%] lg:inset-x-0 lg:bottom-auto lg:top-[3%] lg:mx-auto lg:h-[90%] lg:w-auto"
        aria-hidden="true"
      >
        <image
          :href="radarSrc"
          x="0"
          y="0"
          :width="CANVAS"
          :height="CANVAS"
          class="opacity-65 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <circle
          v-for="mark of marks"
          :key="mark.key"
          :cx="mark.x"
          :cy="mark.y"
          :r="mark.r"
          :fill="mark.color"
          :fill-opacity="0.95 - ((mark.r - DOT) / (DOT_MAX - DOT)) * 0.3"
          stroke="#0b0b0d"
          stroke-opacity="0.75"
          stroke-width="4"
        />
      </svg>
    </span>

    <!-- Along the foot of the cell on desktop, over the radar's empty lower
         margin, so the radar keeps the cell's whole height. -->
    <span
      class="flex items-center gap-2 border-t border-white/[0.06] px-2.5 py-2 lg:absolute lg:inset-x-0 lg:bottom-0 lg:border-t-0 lg:bg-gradient-to-t lg:from-zinc-950/90 lg:via-zinc-950/60 lg:to-transparent lg:pt-4"
    >
      <img
        v-if="tile.patch"
        :src="tile.patch"
        alt=""
        class="size-[1.125rem] shrink-0 object-contain"
      />
      <span
        class="min-w-0 flex-1 truncate text-[0.8rem] font-bold uppercase tracking-[0.06em]"
      >
        {{ tile.label }}
      </span>
      <FiveStackToolTip
        v-if="privateCount"
        as-child
        :delay-duration="120"
        :tap-toggle="false"
      >
        <template #trigger>
          <span
            class="inline-flex shrink-0 items-center gap-1 font-mono text-[0.68rem] font-semibold tabular-nums text-muted-foreground/80"
          >
            <Lock class="h-3 w-3" />
            {{ privateCount }}
          </span>
        </template>
        {{ $t("pages.utility.picker.count_private") }}
      </FiveStackToolTip>
      <FiveStackToolTip as-child :delay-duration="120" :tap-toggle="false">
        <template #trigger>
          <span
            class="shrink-0 font-mono text-[0.72rem] font-semibold tabular-nums"
            :class="count ? 'text-foreground' : 'text-muted-foreground/50'"
          >
            {{ count }}
          </span>
        </template>
        {{ $t("pages.utility.picker.count_public") }}
      </FiveStackToolTip>
    </span>
  </NuxtLink>
</template>
