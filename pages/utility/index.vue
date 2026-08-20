<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { Skeleton } from "~/components/ui/skeleton";
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
  <PageTransition v-if="loading">
    <Skeleton class="h-[60vh] w-full rounded-md" />
  </PageTransition>

  <PageTransition v-else :delay="60">
    <Empty>
      <EmptyTitle>{{ $t("pages.utility.empty.no_maps") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.empty.no_maps_description") }}
      </EmptyDescription>
    </Empty>
  </PageTransition>
</template>
