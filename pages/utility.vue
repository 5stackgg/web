<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import UtilityMapRail from "~/components/utility/UtilityMapRail.vue";
import { normalizeMapName } from "~/utilities/mapAssets";
import { utilityOutletKey } from "~/utilities/pageKey";

/**
 * The utility section's shell: the maps rail, and beside it whichever page is
 * open -- the maps index or one map.
 *
 * The rail is part of the section, not of either page. Drawn by each page, it
 * was rebuilt on the way from the index to a map and came back in a different
 * place, because the two pages are different widths. Here it is mounted once
 * and the pages change beside it. The room for them is the same on both -- the
 * width of the board plus the card -- so the rail sits on the same pixel
 * whether or not a map is picked, and hard against what it steers on a wide
 * screen instead of out at the page's edge.
 *
 * Below the desktop breakpoint the rail is a strip above the map, which each
 * page draws for itself.
 */
const route = useRoute();

// Only the index and a map have a rail. The drift report and the old lineup
// redirect live under /utility too and are pages of their own.
const railed = computed(
  () => route.name === "utility" || route.name === "utility-map",
);

const mapName = computed(() =>
  route.name === "utility-map"
    ? normalizeMapName(String(route.params.map))
    : null,
);
</script>

<template>
  <div v-if="railed" class="mx-auto flex w-full justify-center gap-4">
    <div
      class="hidden shrink-0 lg:sticky lg:top-4 lg:flex lg:h-[calc(100dvh-var(--header-height,4rem)-2rem)] lg:items-center lg:self-start"
    >
      <UtilityMapRail :map-name="mapName" />
    </div>

    <!-- As wide as the board at its largest plus the card, and no wider, so
         nothing is left over to drift the rail away from the board. -->
    <div
      class="min-w-0 flex-1 lg:max-w-[calc(min(1000px,100dvh-var(--header-height,4rem)-5rem)+27rem)]"
    >
      <NuxtPage :page-key="utilityOutletKey" />
    </div>
  </div>

  <NuxtPage v-else />
</template>
