<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ChevronDown, Search } from "lucide-vue-next";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import MapDisplay from "~/components/MapDisplay.vue";
import { Skeleton } from "~/components/ui/skeleton";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  utilityMapCountsQuery,
  mapCountAlias,
  mapCountVariable,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";
import mapLabel from "~/utilities/mapLabel";
import cleanMapName from "~/utilities/cleanMapName";

const props = defineProps<{ mapName: string }>();

const router = useRouter();

type MapTile = {
  name: string;
  label: string;
  count: number;
  map: Record<string, unknown>;
};

const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
const search = ref("");
const tiles = ref<MapTile[]>([]);

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
      patch: true,
      poster: true,
    },
  ],
});

// Only when the picker is first opened: this is a switcher, not something the
// map page should pay for on every load.
async function load() {
  if (loaded.value || loading.value) {
    return;
  }
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const [{ data }, radarMaps] = await Promise.all([
      client.query({ query: mapsQuery, fetchPolicy: "cache-first" }),
      loadRadarMaps(),
    ]);

    const seen = new Set<string>();
    const candidates: Array<{ name: string; label: string; map: any }> = [];
    for (const map of ((data as any)?.maps ?? []) as Array<any>) {
      const radar = normalizeMapName(map.name);
      if (!radarMaps.has(radar) || seen.has(radar)) {
        continue;
      }
      seen.add(radar);
      candidates.push({ name: radar, label: mapLabel(map), map });
    }

    if (!candidates.length) {
      tiles.value = [];
      loaded.value = true;
      return;
    }

    const variables: Record<string, unknown> = {};
    for (const candidate of candidates) {
      variables[mapCountVariable(candidate.name)] = {
        map_name: { _eq: candidate.name },
      };
    }
    const counts = await client.query({
      query: utilityMapCountsQuery(candidates.map((entry) => entry.name)),
      variables,
      fetchPolicy: "network-only",
    });

    tiles.value = candidates.map((candidate) => ({
      name: candidate.name,
      label: candidate.label,
      map: candidate.map,
      count:
        (counts.data as any)?.[mapCountAlias(candidate.name)]?.aggregate
          ?.count ?? 0,
    }));
    loaded.value = true;
  } catch (error) {
    console.error("[utility] map picker load error:", error);
    tiles.value = [];
  } finally {
    loading.value = false;
  }
}

watch(open, (value) => {
  if (value) {
    void load();
  } else {
    search.value = "";
  }
});

const visible = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) {
    return tiles.value;
  }
  return tiles.value.filter(
    (tile) =>
      tile.label.toLowerCase().includes(term) ||
      tile.name.toLowerCase().includes(term),
  );
});

function pick(name: string) {
  open.value = false;
  if (name === props.mapName) {
    return;
  }
  void router.push({ name: "utility-map", params: { map: name } });
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="group flex items-center gap-2 text-left transition-colors"
      >
        <span
          class="font-sans text-3xl font-bold uppercase leading-none tracking-[0.02em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.95)] transition-colors group-hover:text-[hsl(var(--tac-amber))]"
        >
          {{ cleanMapName(mapName) }}
        </span>
        <ChevronDown
          class="h-5 w-5 shrink-0 text-white/60 transition-transform group-hover:text-[hsl(var(--tac-amber))]"
          :class="open ? 'rotate-180' : ''"
        />
      </button>
    </PopoverTrigger>

    <PopoverContent
      align="start"
      class="w-[min(92vw,620px)] border-border bg-background/95 p-3 [backdrop-filter:blur(12px)]"
    >
      <div class="relative mb-3">
        <Search
          class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="$t('pages.utility.picker.search')"
          class="h-8 pl-7 text-xs"
        />
      </div>

      <div
        v-if="loading && !tiles.length"
        class="grid gap-2"
        style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))"
      >
        <Skeleton v-for="i in 8" :key="i" class="h-[86px] w-full rounded-md" />
      </div>

      <p
        v-else-if="!visible.length"
        class="py-6 text-center text-xs text-muted-foreground"
      >
        {{ $t("pages.utility.picker.none") }}
      </p>

      <div
        v-else
        class="grid max-h-[52vh] gap-2 overflow-y-auto pr-1"
        style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))"
      >
        <button
          v-for="tile of visible"
          :key="tile.name"
          type="button"
          class="group relative overflow-hidden rounded-md border transition-colors"
          :class="
            tile.name === mapName
              ? 'border-[hsl(var(--tac-amber))]'
              : 'border-border hover:border-[hsl(var(--tac-amber))]/60'
          "
          @click="pick(tile.name)"
        >
          <MapDisplay :map="tile.map" class="h-[86px] w-full" patch />
          <span
            class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4"
          >
            <span
              class="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white"
            >
              {{ tile.label }}
            </span>
            <span
              class="shrink-0 font-mono text-[0.6rem] tabular-nums"
              :class="
                tile.count
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-white/40'
              "
            >
              {{ tile.count }}
            </span>
          </span>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
