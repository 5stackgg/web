<script setup lang="ts">
import LoadingScreen from "~/components/LoadingScreen.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupQuery } from "~/graphql/utilityGraphql";
import { normalizeMapName } from "~/utilities/mapAssets";

/**
 * A lineup no longer has a page of its own. It has an address on the map it
 * belongs to -- `/utility/<map>?lineup=<id>` -- which opens the same detail
 * without throwing away the board and the list you were reading. This route
 * stays only so links already out in the world still land somewhere.
 *
 * The redirect runs at the MIDDLEWARE stage, before this component mounts.
 * Calling navigateTo from setup while the page is still resolving inside
 * <NuxtPage>'s <Suspense> deadlocks the swap: the router resolves but the
 * target never mounts, leaving the spinner below stuck forever.
 */
definePageMeta({
  middleware: async (to) => {
    if (process.server) {
      return;
    }
    const id = String(to.params.id);
    try {
      const { data } = await getGraphqlClient().query({
        query: utilityLineupQuery,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      const mapName = (data as any)?.utility_lineups_by_pk?.map_name;
      if (mapName) {
        return navigateTo(
          {
            name: "utility-map",
            params: { map: normalizeMapName(mapName) },
            // Carried through so an invite link that also names a practice
            // session still opens it on the other side.
            query: { ...to.query, lineup: id },
          },
          { replace: true },
        );
      }
    } catch (error) {
      console.error("[utility] lineup redirect error:", error);
    }
    // Deleted, private, or the lookup failed. The library is the only honest
    // place left to land.
    return navigateTo({ name: "utility" }, { replace: true });
  },
});
</script>

<template>
  <LoadingScreen class="min-h-screen" />
</template>
