<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronDown, Search } from "lucide-vue-next";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
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

const route = useRoute();
const router = useRouter();
const $img = useImage();

// Every poster this component draws is requested at one width, so the trigger's
// backdrop and that map's tile in the grid are the same URL: the map you are on
// is already decoded before the panel exists, and the warm pass below can
// preload the rest by URL instead of guessing at a srcset.
const POSTER_WIDTH = 320;

type MapTile = {
  name: string;
  label: string;
  poster: string;
  patch: string | null;
};

const open = ref(false);
const search = ref("");
const tiles = ref<MapTile[]>([]);
const counts = ref<Record<string, number>>({});
const countsReady = ref(false);

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

let mapsPromise: Promise<void> | null = null;

/**
 * The map list itself is ten rows and it carries this page's identity -- the
 * patch and the screenshot of the map you are looking at -- so it loads with
 * the page. Only the per-map lineup counts wait for intent: those are one
 * aggregate per map and nothing above the fold reads them.
 */
function loadMaps(): Promise<void> {
  if (!mapsPromise) {
    mapsPromise = (async () => {
      try {
        const client = getGraphqlClient();
        const [{ data }, radarMaps] = await Promise.all([
          client.query({ query: mapsQuery, fetchPolicy: "cache-first" }),
          loadRadarMaps(),
        ]);

        const seen = new Set<string>();
        const next: MapTile[] = [];
        for (const map of ((data as any)?.maps ?? []) as Array<any>) {
          const radar = normalizeMapName(map.name);
          if (!radarMaps.has(radar) || seen.has(radar)) {
            continue;
          }
          seen.add(radar);
          next.push({
            name: radar,
            label: mapLabel(map),
            poster: map.poster ? $img(map.poster, { width: POSTER_WIDTH }) : "",
            patch: map.patch ?? null,
          });
        }
        tiles.value = next;
      } catch (error) {
        console.error("[utility] map picker load error:", error);
        mapsPromise = null;
      }
    })();
  }
  return mapsPromise;
}

let countsPromise: Promise<void> | null = null;

function loadCounts(): Promise<void> {
  if (!countsPromise) {
    countsPromise = (async () => {
      await loadMaps();
      const names = tiles.value.map((tile) => tile.name);
      if (!names.length) {
        return;
      }
      try {
        const client = getGraphqlClient();
        const variables: Record<string, unknown> = {};
        for (const name of names) {
          variables[mapCountVariable(name)] = { map_name: { _eq: name } };
        }
        const { data } = await client.query({
          query: utilityMapCountsQuery(names),
          variables,
          fetchPolicy: "network-only",
        });
        const next: Record<string, number> = {};
        for (const name of names) {
          next[name] = (data as any)?.[mapCountAlias(name)]?.aggregate?.count ?? 0;
        }
        counts.value = next;
        countsReady.value = true;
      } catch (error) {
        console.error("[utility] map picker count error:", error);
        countsPromise = null;
      }
    })();
  }
  return countsPromise;
}

// Decoding a screenshot is what makes a picker feel like it is thinking. The
// browser has already fetched the map you are on (the trigger draws it); this
// pulls the other nine in on the first sign you are heading for the switcher.
const warmed = new Set<string>();
function preload(url?: string | null) {
  if (!url || warmed.has(url) || typeof window === "undefined") {
    return;
  }
  warmed.add(url);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
}

async function warm() {
  await loadMaps();
  for (const tile of tiles.value) {
    preload(tile.poster);
    preload(tile.patch);
  }
  void loadCounts();
}

onMounted(() => {
  void loadMaps();
});

watch(open, (value) => {
  if (value) {
    void warm();
  } else {
    search.value = "";
  }
});

const current = computed(
  () => tiles.value.find((tile) => tile.name === props.mapName) ?? null,
);

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
  // The filters come with you. Reading your team's smokes on one map and then
  // landing on the next one back in the public library -- with the search box
  // cleared -- is the switch undoing a decision you did not make. The open
  // lineup does not come: it belongs to the map you are leaving.
  const query = { ...route.query } as Record<string, unknown>;
  delete query.lineup;
  void router.push({
    name: "utility-map",
    params: { map: name },
    query: query as any,
  });
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <!-- The name still names the map, but it no longer has to do it alone.
           The patch says which map this is before the word is read, and the
           map's own screenshot lights the plate from behind -- blurred at
           rest, so it is a colour rather than a picture and the name stays the
           only thing to read, and resolving on hover into the same frame the
           grid below draws with. -->
      <button
        type="button"
        class="group relative flex items-center gap-2.5 overflow-hidden rounded-md border py-1 pl-1 pr-2 text-left transition-[border-color,background-color] duration-200 [backdrop-filter:blur(10px)]"
        :class="
          open
            ? 'border-[hsl(var(--tac-amber)/0.55)] bg-background/85'
            : 'border-white/10 bg-background/70 hover:border-[hsl(var(--tac-amber)/0.45)]'
        "
        @pointerenter="warm"
        @focus="warm"
      >
        <img
          v-if="current?.poster"
          :src="current.poster"
          alt=""
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 h-full w-full object-cover saturate-150 transition-[opacity,filter,transform] duration-300 group-hover:scale-110 group-hover:opacity-80 group-hover:blur-[2px]"
          :class="
            open
              ? 'scale-110 opacity-80 blur-[2px]'
              : 'scale-125 opacity-60 blur-md'
          "
        />
        <!-- The scrim tightens as the picture resolves, so hovering trades blur
             for detail at a constant brightness and the name never has to
             compete with a lit-up screenshot. -->
        <span
          class="pointer-events-none absolute inset-0 bg-background/40 transition-colors duration-300 group-hover:bg-background/60"
          :class="open ? '!bg-background/60' : ''"
        ></span>

        <img
          v-if="current?.patch"
          :src="current.patch"
          alt=""
          aria-hidden="true"
          class="utility-map-plate-patch relative h-8 w-8 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] transition-transform duration-200 group-hover:scale-105"
        />

        <span
          class="relative font-sans text-3xl font-bold uppercase leading-none tracking-[0.02em] [text-shadow:0_2px_10px_rgba(0,0,0,0.95)] transition-colors"
          :class="open ? 'text-[hsl(var(--tac-amber))]' : 'text-white group-hover:text-[hsl(var(--tac-amber))]'"
        >
          {{ cleanMapName(mapName) }}
        </span>

        <ChevronDown
          class="relative h-5 w-5 shrink-0 transition-[transform,color] duration-200"
          :class="
            open
              ? 'rotate-180 text-[hsl(var(--tac-amber))]'
              : 'text-white/60 group-hover:text-[hsl(var(--tac-amber))]'
          "
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
        v-if="!tiles.length"
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
          class="group relative h-[86px] overflow-hidden rounded-md border transition-[border-color,box-shadow] duration-200"
          :class="
            tile.name === mapName
              ? 'border-[hsl(var(--tac-amber))] [box-shadow:0_0_0_2px_hsl(var(--tac-amber)/0.14)]'
              : 'border-border hover:border-[hsl(var(--tac-amber))]/60'
          "
          @click="pick(tile.name)"
        >
          <img
            v-if="tile.poster"
            :src="tile.poster"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
          <span class="absolute inset-0 bg-black/45"></span>
          <img
            v-if="tile.patch"
            :src="tile.patch"
            alt=""
            aria-hidden="true"
            class="absolute inset-x-0 top-1.5 mx-auto h-[46px] w-auto object-contain drop-shadow-xl transition-transform duration-200 group-hover:scale-105"
          />
          <span
            class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4"
          >
            <span
              class="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white"
            >
              {{ tile.label }}
            </span>
            <span
              v-if="countsReady"
              class="shrink-0 font-mono text-[0.6rem] tabular-nums"
              :class="
                counts[tile.name] ? 'text-[hsl(var(--tac-amber))]' : 'text-white/40'
              "
            >
              {{ counts[tile.name] ?? 0 }}
            </span>
          </span>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
