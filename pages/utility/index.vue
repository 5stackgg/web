<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilityMapPreviewTile from "~/components/utility/UtilityMapPreviewTile.vue";
import UtilityMapRail from "~/components/utility/UtilityMapRail.vue";
import {
  arriveUtilityPage,
  leaveUtilityPage,
} from "~/composables/useUtilityMapHandoff";
import { useUtilityMaps } from "~/composables/useUtilityMaps";
import { normalizeMapName } from "~/utilities/mapAssets";
import { UTILITY_TYPES, UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";

// Every map, each as its own radar with its library drawn on it. The maps
// rail beside it belongs to the section's shell (`pages/utility.vue`), with
// its grid entry lit while this page is open.
const { tiles, counts, privateCounts, landings, loadCounts, loadLandings } =
  useUtilityMaps();
const loading = ref(!tiles.value.length);

// A map's tile and its board are the same radar at two sizes, so the pages
// hand it to each other: picking a map -- from a tile or from the rail -- tells
// the map page where that tile's radar was, and coming back from a map the
// tile shrinks out of where the board was while the rest fades in around it.
type Tile = InstanceType<typeof UtilityMapPreviewTile>;
const tileRefs = new Map<string, Tile>();

function setTile(name: string, tile: unknown) {
  if (tile) {
    tileRefs.set(name, tile as Tile);
  } else {
    tileRefs.delete(name);
  }
}

onBeforeRouteLeave((to) => {
  if (to.name === "utility-map") {
    const map = normalizeMapName(String(to.params.map));
    const tile = tileRefs.get(map);
    leaveUtilityPage("index", map, tile?.rect() ?? null, tile?.src ?? null);
  }
});

const arrival = arriveUtilityPage("map");
const arriving = ref(!!arrival);

onMounted(async () => {
  if (arrival?.rect) {
    void nextTick(() => tileRefs.get(arrival.map)?.shrinkFrom(arrival.rect!));
  }
  if (arriving.value) {
    window.setTimeout(() => (arriving.value = false), 600);
  }
  void loadLandings();
  await loadCounts();
  loading.value = false;
});

const empty = computed(() => !loading.value && !tiles.value.length);

const total = computed(() =>
  tiles.value.reduce((sum, tile) => sum + (counts.value[tile.name] ?? 0), 0),
);

// Three across on desktop. The legend takes what the maps leave of their last
// row, or a row of its own when they leave nothing.
const COLUMNS = 3;
const mapCount = computed(() => (loading.value ? 10 : tiles.value.length));
const legendSpan = computed(
  () => (COLUMNS - (mapCount.value % COLUMNS)) % COLUMNS || COLUMNS,
);
const rows = computed(() =>
  Math.ceil((mapCount.value + (loading.value ? 0 : legendSpan.value)) / COLUMNS),
);
// Whole class names, so the build can see them.
const LEGEND_SPAN: Record<number, string> = {
  1: "col-span-2 sm:col-span-1",
  2: "col-span-2",
  3: "col-span-2 sm:col-span-3",
};
</script>

<template>
  <PageTransition :appear="!arrival">
    <!-- The same two columns a map page has, and in the first of them the
         same box the board is: the same row above it, the same square under
         that. Pick a map and the board arrives in exactly the room the maps
         were in, with the card beside it -- nothing changes size on the way.
         Until a map is picked there is nothing to put in a card, so its
         column is simply empty. -->
    <div
      class="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]"
    >
      <div
        class="relative mx-auto w-full min-w-0 lg:sticky lg:top-4 lg:flex lg:min-h-[calc(100dvh-var(--header-height,4rem)-2rem)] lg:max-w-[min(1000px,calc(100dvh-var(--header-height,4rem)-5rem))] lg:flex-col lg:self-start"
      >
        <div class="lg:my-auto">
          <UtilityMapRail :map-name="null" horizontal class="mb-3 lg:hidden" />

          <!-- The row the map's own controls sit in on a map page. -->
          <div
            class="flex min-h-11 items-center gap-2 px-1 pb-2"
            :class="arriving ? 'utility-arrive' : ''"
          >
            <h1
              class="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em]"
            >
              {{ $t("pages.utility.picker.all_maps") }}
            </h1>
            <span
              v-if="tiles.length"
              class="font-mono text-[0.7rem] tabular-nums text-muted-foreground"
            >
              {{ tiles.length }}
            </span>
          </div>

          <UtilityEmpty
            v-if="empty"
            class="mx-auto max-w-md"
            :title="$t('pages.utility.empty.no_maps')"
            :description="$t('pages.utility.empty.no_maps_description')"
          />

          <!-- On desktop, the board's square, cut three across into as many
               rows as the maps need: every map is in view at once, in the
               same footprint the map itself has. Below that the tiles simply
               flow down the page at a size worth looking at. -->
          <section
            v-else
            :aria-label="$t('pages.utility.picker.label')"
            class="mx-auto grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:aspect-square lg:max-w-[calc(100vh-12rem)] lg:[grid-template-rows:repeat(var(--map-rows),minmax(6.5rem,1fr))]"
            :style="{ '--map-rows': rows }"
          >
            <!-- Holds the grid's shape while the maps load, so the tiles land
                 in place instead of pushing the page down. -->
            <template v-if="loading">
              <div
                v-for="n of 10"
                :key="n"
                aria-hidden="true"
                class="flex flex-col overflow-hidden rounded-[10px] border border-white/[0.05] bg-white/[0.03]"
              >
                <span class="block aspect-square lg:aspect-auto lg:flex-1" />
                <span
                  class="block h-[2.125rem] border-t border-white/[0.05] lg:hidden"
                />
              </div>
            </template>

            <template v-else>
              <UtilityMapPreviewTile
                v-for="tile of tiles"
                :key="tile.name"
                :ref="(el) => setTile(tile.name, el)"
                :class="
                  arriving && tile.name !== arrival?.map ? 'utility-arrive' : ''
                "
                :tile="tile"
                :landings="landings[tile.name] ?? []"
                :count="counts[tile.name] ?? 0"
                :private-count="privateCounts[tile.name] ?? 0"
              />

              <!-- What the marks mean, said once, in whatever the maps leave
                   over of the last row. -->
              <div
                class="flex min-h-0 flex-col justify-center gap-2.5 rounded-[10px] border border-dashed border-border px-3.5 py-3"
                :class="[LEGEND_SPAN[legendSpan], arriving ? 'utility-arrive' : '']"
              >
                <p class="text-xs leading-relaxed text-muted-foreground">
                  {{ $t("pages.utility.picker.legend") }}
                  <span class="tabular-nums">
                    {{
                      $t("pages.utility.picker.total", { count: total }, total)
                    }}
                  </span>
                </p>
                <p class="flex flex-wrap gap-x-3 gap-y-1.5">
                  <span
                    v-for="type of UTILITY_TYPES"
                    :key="type"
                    class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      class="size-2 rounded-full"
                      :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
                    />
                    {{ $t(`pages.utility.types.${type}`) }}
                  </span>
                </p>
              </div>
            </template>
          </section>
        </div>
      </div>

      <div aria-hidden="true" class="hidden lg:block" />
    </div>
  </PageTransition>
</template>
