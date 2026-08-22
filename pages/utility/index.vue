<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import LoadingScreen from "~/components/LoadingScreen.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { order_by } from "~/generated/zeus";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";

// There is no map grid any more: the map name on the library page is itself the
// switcher, so this route exists only to pick a map and get out of the way.
const router = useRouter();
const loading = ref(true);

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
      },
      order_by: [{ name: order_by.asc }],
    },
    { id: true, name: true },
  ],
});

onMounted(async () => {
  try {
    const [{ data }, radarMaps] = await Promise.all([
      getGraphqlClient().query({ query: mapsQuery, fetchPolicy: "cache-first" }),
      loadRadarMaps(),
    ]);

    // A map without a radar has nothing to draw a lineup on, so it can never be
    // the one this route lands on.
    for (const map of ((data as any)?.maps ?? []) as Array<{ name: string }>) {
      const radar = normalizeMapName(map.name);
      if (radarMaps.has(radar)) {
        await router.replace({
          name: "utility-map",
          params: { map: radar },
        });
        return;
      }
    }
  } catch (error) {
    console.error("[utility] map redirect error:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <!-- The same spinner the other utility redirect uses, not a placeholder for
       content. This route exists only to pick a map and hand over, and it used
       to fill the wait with a 60vh pulsing block: the largest thing on the
       screen, first to arrive, gone a moment later without ever becoming
       anything. That reads as a page that broke, not as a redirect in
       flight. -->
  <LoadingScreen v-if="loading" />

  <PageTransition v-else :delay="60">
    <UtilityEmpty
      class="mx-auto max-w-md"
      :title="$t('pages.utility.empty.no_maps')"
      :description="$t('pages.utility.empty.no_maps_description')"
    />
  </PageTransition>
</template>
