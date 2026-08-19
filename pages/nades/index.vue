<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Bomb } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { order_by } from "~/generated/zeus";
import {
  mapCountAlias,
  mapCountVariable,
  nadeMapCountsQuery,
} from "~/graphql/nadesGraphql";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";
import mapLabel from "~/utilities/mapLabel";

type MapTile = {
  name: string;
  label: string;
  radar: string;
  count: number;
};

const loading = ref(true);
const tiles = ref<MapTile[]>([]);

const totalLineups = computed(() =>
  tiles.value.reduce((sum, tile) => sum + tile.count, 0),
);

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
      },
      order_by: [{ name: order_by.asc }],
    },
    {
      id: true,
      name: true,
      label: true,
    },
  ],
});

async function load() {
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const [{ data }, radarMaps] = await Promise.all([
      client.query({ query: mapsQuery, fetchPolicy: "cache-first" }),
      loadRadarMaps(),
    ]);

    const seen = new Set<string>();
    const candidates: Array<{ name: string; label: string }> = [];
    for (const map of ((data as any)?.maps ?? []) as Array<{
      name: string;
      label: string | null;
    }>) {
      const radar = normalizeMapName(map.name);
      if (!radarMaps.has(radar) || seen.has(radar)) {
        continue;
      }
      seen.add(radar);
      candidates.push({ name: radar, label: mapLabel(map) });
    }

    if (candidates.length === 0) {
      tiles.value = [];
      return;
    }

    const variables: Record<string, unknown> = {};
    for (const candidate of candidates) {
      variables[mapCountVariable(candidate.name)] = {
        map_name: { _eq: candidate.name },
      };
    }

    const counts = await client.query({
      query: nadeMapCountsQuery(candidates.map((entry) => entry.name)),
      variables,
      fetchPolicy: "network-only",
    });

    tiles.value = candidates.map((candidate) => ({
      name: candidate.name,
      label: candidate.label,
      radar: `/radars/${candidate.name}.png`,
      count:
        (counts.data as any)?.[mapCountAlias(candidate.name)]?.aggregate
          ?.count ?? 0,
    }));
  } catch (error) {
    console.error("[nades] map grid load error:", error);
    tiles.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.nades.eyebrow") }}</template>
      <template #title>{{ $t("pages.nades.title") }}</template>
      <template #subtitle>{{ $t("pages.nades.subtitle") }}</template>
      <template #actions>
        <div
          class="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 [backdrop-filter:blur(6px)]"
        >
          <Bomb class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          <span class="font-mono text-sm font-bold tabular-nums">
            {{ totalLineups }}
          </span>
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.nades.lineups") }}
          </span>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition v-if="loading" :delay="60" class="mt-6">
    <div
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
    >
      <Skeleton v-for="i in 8" :key="i" class="aspect-[4/3] w-full rounded-md" />
    </div>
  </PageTransition>

  <PageTransition v-else-if="!tiles.length" :delay="60" class="mt-6">
    <Empty>
      <EmptyTitle>{{ $t("pages.nades.empty.no_maps") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.nades.empty.no_maps_description") }}
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="60" class="mt-6">
    <div
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
    >
      <NuxtLink
        v-for="tile of tiles"
        :key="tile.name"
        :to="{ name: 'nades-map', params: { map: tile.name } }"
        class="group relative block overflow-hidden border-2 border-border/60 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--tac-amber)/0.7)]"
      >
        <img
          :src="tile.radar"
          :alt="tile.label"
          class="aspect-[4/3] w-full object-cover opacity-60 transition-opacity group-hover:opacity-90"
          @error="
            ($event.target as HTMLImageElement).style.visibility = 'hidden'
          "
        />
        <div
          class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2"
        >
          <div
            class="truncate font-mono text-sm font-bold uppercase tracking-[0.18em] text-white"
          >
            {{ tile.label }}
          </div>
          <span
            class="shrink-0 border px-1.5 py-0.5 font-mono text-[0.6rem] tabular-nums uppercase tracking-[0.16em]"
            :class="
              tile.count > 0
                ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                : 'border-white/40 text-white/60'
            "
          >
            {{ tile.count }}
          </span>
        </div>
      </NuxtLink>
    </div>
  </PageTransition>
</template>
