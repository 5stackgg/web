import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import {
  SERVER_MIGRATION_OPTIONAL,
  SERVER_MIGRATION_SUBSCRIPTION,
  SERVER_MOVE_NODES_SUBSCRIPTION,
} from "~/graphql/serverMigrationGraphql";
import {
  ACTIVE_SERVER_MIGRATION_STATUSES,
  isNodeUp,
  type MigratingServer,
  type ServerMoveNode,
} from "~/types/serverMigration";

let instances = 0;

export function useServerMigration(
  serverId: Ref<string | null | undefined>,
  enabled: Ref<boolean>,
) {
  const key = `server-migration:${++instances}`;
  const server = ref<MigratingServer | null>(null);
  const { subscribe, unsubscribe } = useSubscriptionManager();

  function start([id, on]: readonly [string | null | undefined, boolean]) {
    unsubscribe(key);
    server.value = null;

    if (!id || !on) {
      return;
    }

    subscribe(
      key,
      getGraphqlClient()
        .subscribe({
          query: SERVER_MIGRATION_SUBSCRIPTION,
          variables: { server_id: id },
          context: SERVER_MIGRATION_OPTIONAL,
        })
        .subscribe({
          next: ({ data }) => {
            server.value = (data as any)?.servers_by_pk ?? null;
          },
          error: () => {
            server.value = null;
          },
        }),
    );
  }

  onMounted(() => {
    watch(() => [serverId.value, enabled.value] as const, start, {
      immediate: true,
    });
  });

  onUnmounted(() => unsubscribe(key));

  const migration = computed(() => server.value?.migrations?.[0] ?? null);

  const isMigrating = computed(
    () =>
      !!migration.value &&
      ACTIVE_SERVER_MIGRATION_STATUSES.includes(migration.value.status),
  );

  const sourceReachable = computed(() =>
    isNodeUp(server.value?.game_server_node),
  );

  return {
    server,
    node: computed(() => server.value?.game_server_node ?? null),
    migration,
    isMigrating,
    sourceReachable,
  };
}

export function useServerMoveNodes(enabled: Ref<boolean>) {
  const key = `server-move-nodes:${++instances}`;
  const nodes = ref<Array<ServerMoveNode>>([]);
  const loaded = ref(false);
  const { subscribe, unsubscribe } = useSubscriptionManager();

  function start(on: boolean) {
    unsubscribe(key);
    loaded.value = false;

    if (!on) {
      nodes.value = [];
      return;
    }

    subscribe(
      key,
      getGraphqlClient()
        .subscribe({
          query: SERVER_MOVE_NODES_SUBSCRIPTION,
          context: SERVER_MIGRATION_OPTIONAL,
        })
        .subscribe({
          next: ({ data }) => {
            nodes.value = (data as any)?.game_server_nodes ?? [];
            loaded.value = true;
          },
          error: () => {
            nodes.value = [];
            loaded.value = true;
          },
        }),
    );
  }

  onMounted(() => {
    watch(enabled, start, { immediate: true });
  });

  onUnmounted(() => unsubscribe(key));

  return { nodes, loaded };
}
