import { ref } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  UTILITY_LANDINGS_LIMIT,
  utilityMapCountsQuery,
  mapCountAlias,
  mapCountVariable,
  mapPrivateCountAlias,
  mapPrivateCountVariable,
} from "~/graphql/utilityGraphql";
import { utilityLibraryLandingsQuery } from "~/graphql/utilityMetaGraphql";
import type { UtilityType } from "~/types/utility";
import { e_match_types_enum, order_by } from "~/generated/zeus";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";
import mapLabel from "~/utilities/mapLabel";

export type UtilityMapTile = {
  name: string;
  label: string;
  patch: string | null;
  poster: string | null;
};

/** Where one lineup lands, reduced to what a map's tile draws. */
export type UtilityMapLanding = {
  type: UtilityType;
  x: number;
  y: number;
  z: number;
};

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
        // Rush is its own mode on its own map; nobody lines up utility there.
        type: { _neq: e_match_types_enum.Rush },
      },
      order_by: [{ name: order_by.asc }],
    },
    { id: true, name: true, label: true, patch: true, poster: true },
  ],
});

// Module scope: the rail and the index grid read the same ten maps, and the
// counts are one aggregate per map that only needs asking once per visit.
const tiles = ref<UtilityMapTile[]>([]);
const counts = ref<Record<string, number>>({});
const privateCounts = ref<Record<string, number>>({});
const landings = ref<Record<string, UtilityMapLanding[]>>({});
let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (!mapsPromise) {
    mapsPromise = (async () => {
      try {
        const [{ data }, radarMaps] = await Promise.all([
          getGraphqlClient().query({ query: mapsQuery, fetchPolicy: "cache-first" }),
          loadRadarMaps(),
        ]);
        const seen = new Set<string>();
        const next: UtilityMapTile[] = [];
        for (const map of ((data as any)?.maps ?? []) as Array<any>) {
          const radar = normalizeMapName(map.name);
          // A map without a radar has nothing to draw a lineup on.
          if (!radarMaps.has(radar) || seen.has(radar)) {
            continue;
          }
          seen.add(radar);
          next.push({
            name: radar,
            label: mapLabel(map),
            patch: map.patch ?? null,
            poster: map.poster ?? null,
          });
        }
        tiles.value = next;
      } catch (error) {
        console.error("[utility] map list load error:", error);
        mapsPromise = null;
      }
    })();
  }
  return mapsPromise;
}

// Public is the library count; private is what you can see that is not public
// (yours, your team's, or waiting on review). Neither counts archived.
async function loadCounts(): Promise<void> {
  await loadMaps();
  const names = tiles.value.map((tile) => tile.name);
  if (!names.length) {
    return;
  }
  const variables: Record<string, unknown> = {};
  for (const name of names) {
    const visible = {
      map_name: { _eq: name },
      can_view: { _eq: true },
      archived_at: { _is_null: true },
    };
    variables[mapCountVariable(name)] = { ...visible, visibility: { _eq: "Public" } };
    variables[mapPrivateCountVariable(name)] = {
      ...visible,
      visibility: { _neq: "Public" },
    };
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityMapCountsQuery(names),
      variables,
      fetchPolicy: "network-only",
    });
    const next: Record<string, number> = {};
    const nextPrivate: Record<string, number> = {};
    for (const name of names) {
      next[name] = (data as any)?.[mapCountAlias(name)]?.aggregate?.count ?? 0;
      nextPrivate[name] =
        (data as any)?.[mapPrivateCountAlias(name)]?.aggregate?.count ?? 0;
    }
    counts.value = next;
    privateCounts.value = nextPrivate;
  } catch (error) {
    console.error("[utility] map count error:", error);
  }
}

// Every landing the viewer can open, by map: what the index draws on each
// map's radar. Most upvoted first, so if the library ever outgrows the cap the
// picture is of the lineups people use.
async function loadLandings(): Promise<void> {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLibraryLandingsQuery,
      variables: {
        where: {
          can_view: { _eq: true },
          archived_at: { _is_null: true },
          land_x: { _is_null: false },
          land_y: { _is_null: false },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: UTILITY_LANDINGS_LIMIT,
      },
      fetchPolicy: "network-only",
    });
    const next: Record<string, UtilityMapLanding[]> = {};
    for (const row of ((data as any)?.utility_lineups ?? []) as Array<any>) {
      const x = Number(row.land_x);
      const y = Number(row.land_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      (next[normalizeMapName(row.map_name)] ??= []).push({
        type: row.utility_type,
        x,
        y,
        z: Number(row.land_z ?? 0) || 0,
      });
    }
    landings.value = next;
  } catch (error) {
    // The tiles still say how many there are; they just draw no marks.
    console.error("[utility] library landings error:", error);
  }
}

export function useUtilityMaps() {
  return {
    tiles,
    counts,
    privateCounts,
    landings,
    loadMaps,
    loadCounts,
    loadLandings,
  };
}
