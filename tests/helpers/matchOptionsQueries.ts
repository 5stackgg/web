import { vi } from "vitest";
import type { DocumentNode, FieldNode, OperationDefinitionNode } from "graphql";

const map = (name: string, type: string) => ({
  id: `map-${name}`,
  name,
  label: name.replace(/^de_/, ""),
  type,
  poster: null,
  patch: null,
  active_pool: true,
  workshop_map_id: null,
});

export const competitiveMaps = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_train",
].map((name) => map(name, "Competitive"));

export const wingmanMaps = ["de_overpass", "de_vertigo"].map((name) =>
  map(name, "Wingman"),
);

export const seededPools = {
  Competitive: {
    id: "seeded-competitive",
    type: "Competitive",
    maps: competitiveMaps,
  },
  Wingman: { id: "seeded-wingman", type: "Wingman", maps: wingmanMaps },
};

const answers: Record<string, unknown> = {
  maps: [...competitiveMaps, ...wingmanMaps],
  map_pools: Object.values(seededPools),
  e_match_types: [
    { value: "Competitive", description: "5 vs 5" },
    { value: "Wingman", description: "2 vs 2" },
  ],
  game_modes: [],
};

function rootField(document: DocumentNode) {
  const operation = document.definitions[0] as OperationDefinitionNode;
  return (operation.selectionSet.selections[0] as FieldNode).name.value;
}

// MatchOptions and the forms that wrap it read the maps, the seeded pools and
// the match types through smart queries. Mount with the app's mixins
// (`useNuxtApp().vueApp._context.mixins`) for those queries to exist at all.
export function answerMatchOptionsQueries() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;

  vi.spyOn(client, "watchQuery").mockImplementation((options: any) => {
    const field = rootField(options.query);
    const result = () => ({
      loading: false,
      networkStatus: 7,
      data: { [field]: answers[field] },
    });

    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe(observer: { next: (value: unknown) => void }) {
        Promise.resolve().then(() => observer.next(result()));
        return { closed: false, unsubscribe() {} };
      },
      refetch: () => Promise.resolve(result()),
      setVariables: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      stopPolling() {},
      getLastError() {},
      getLastResult() {},
      resetLastResults() {},
    } as any;
  });
}
