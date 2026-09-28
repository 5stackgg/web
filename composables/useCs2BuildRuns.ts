import { onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import {
  CS2_BUILD_GAMEDATA_SUBSCRIPTION,
  CS2_BUILD_MAP_ASSETS_SUBSCRIPTION,
  CS2_BUILD_NODES_SUBSCRIPTION,
  CS2_BUILD_OPTIONAL,
} from "~/graphql/cs2BuildGraphql";
import type {
  Cs2BuildNode,
  GamedataRunRow,
  MapAssetsRunRow,
} from "~/types/cs2Build";

let instances = 0;

export function useCs2BuildRuns(buildId: Ref<number | null | undefined>) {
  const key = `cs2-build-runs:${++instances}`;
  const gamedata = ref<GamedataRunRow | null>(null);
  const mapAssets = ref<MapAssetsRunRow | null>(null);
  const loaded = ref(false);
  const { subscribe, unsubscribe } = useSubscriptionManager();

  function stop() {
    unsubscribe(`${key}:gamedata`);
    unsubscribe(`${key}:map-assets`);
  }

  function start(id: number | null | undefined) {
    stop();
    gamedata.value = null;
    mapAssets.value = null;
    loaded.value = false;

    if (!id) {
      return;
    }

    subscribe(
      `${key}:gamedata`,
      getGraphqlClient()
        .subscribe({
          query: CS2_BUILD_GAMEDATA_SUBSCRIPTION,
          variables: { build_id: id },
          context: CS2_BUILD_OPTIONAL,
        })
        .subscribe({
          next: ({ data }) => {
            gamedata.value =
              (data as any)?.gamedata_signature_validations?.[0] ?? null;
            loaded.value = true;
          },
        }),
    );

    subscribe(
      `${key}:map-assets`,
      getGraphqlClient()
        .subscribe({
          query: CS2_BUILD_MAP_ASSETS_SUBSCRIPTION,
          variables: { build_id: String(id) },
          context: CS2_BUILD_OPTIONAL,
        })
        .subscribe({
          next: ({ data }) => {
            mapAssets.value = (data as any)?.map_asset_builds_by_pk ?? null;
          },
        }),
    );
  }

  onMounted(() => {
    watch(buildId, start, { immediate: true });
  });

  onUnmounted(stop);

  return { gamedata, mapAssets, loaded };
}

export function useCs2BuildNodes(enabled: Ref<boolean>) {
  const key = `cs2-build-nodes:${++instances}`;
  const nodes = ref<Array<Cs2BuildNode>>([]);
  const { subscribe, unsubscribe } = useSubscriptionManager();

  function start(on: boolean) {
    unsubscribe(key);
    if (!on) {
      nodes.value = [];
      return;
    }
    subscribe(
      key,
      getGraphqlClient()
        .subscribe({
          query: CS2_BUILD_NODES_SUBSCRIPTION,
          context: CS2_BUILD_OPTIONAL,
        })
        .subscribe({
          next: ({ data }) => {
            nodes.value = (data as any)?.game_server_nodes ?? [];
          },
        }),
    );
  }

  onMounted(() => {
    watch(enabled, start, { immediate: true });
  });

  onUnmounted(() => unsubscribe(key));

  return { nodes };
}
