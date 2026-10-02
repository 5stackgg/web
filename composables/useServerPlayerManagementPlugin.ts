import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";

// The plugin syncs every 30s and the api keeps at most one heartbeat a minute.
const PLUGIN_STALE_MS = 3 * 60 * 1000;

const RUNTIME_LABELS: Record<string, string> = {
  swiftlys2: "SwiftlyS2",
  counterstrikesharp: "CounterStrikeSharp",
};

const PLUGIN_SUBSCRIPTION = gql`
  subscription ServerPlayerManagementPlugin($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      type
      game
      is_dedicated
      player_management_version
      player_management_runtime
      player_management_seen_at
    }
  }
`;

type PluginServer = {
  type: string;
  game: string;
  is_dedicated: boolean;
  player_management_version: string | null;
  player_management_runtime: string | null;
  player_management_seen_at: string | null;
};

export function useServerPlayerManagementPlugin(
  serverId: MaybeRefOrGetter<string>,
) {
  const server = ref<PluginServer | null>(null);
  // Until the first answer the plugin is neither on nor off; a "not detected"
  // shown before then is a guess.
  const loaded = ref(false);
  const now = ref(Date.now());
  let subscription: { unsubscribe: () => void } | null = null;
  let clock: ReturnType<typeof setInterval> | null = null;

  // A Ranked server's sanctions ride its match payload and a Practice server
  // has no public players, so only community servers need the plugin.
  const isCommunityServer = computed(() => {
    const value = server.value;

    return (
      !!value &&
      value.is_dedicated &&
      value.game !== "csgo" &&
      value.type !== "Ranked" &&
      value.type !== "Practice"
    );
  });

  const active = computed(() => {
    const seenAt = server.value?.player_management_seen_at;

    return (
      !!seenAt && now.value - new Date(seenAt).getTime() < PLUGIN_STALE_MS
    );
  });

  const versionLabel = computed(() => {
    const version = server.value?.player_management_version;

    return version && /^\d/.test(version) ? `v${version}` : version || null;
  });

  const runtimeLabel = computed(() => {
    const runtime = server.value?.player_management_runtime;

    return runtime ? (RUNTIME_LABELS[runtime] ?? null) : null;
  });

  onMounted(() => {
    // Optional: the columns only exist once the api has migrated, and until
    // then nothing is said about the plugin.
    subscription = getGraphqlClient()
      .subscribe({
        query: PLUGIN_SUBSCRIPTION,
        variables: { serverId: toValue(serverId) },
        context: { optional: true },
      })
      .subscribe({
        next: ({ data }: any) => {
          server.value = data?.servers_by_pk ?? null;
          loaded.value = true;
        },
        error: () => {
          server.value = null;
          loaded.value = true;
        },
      });

    clock = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });

  onBeforeUnmount(() => {
    subscription?.unsubscribe();

    if (clock) {
      clearInterval(clock);
    }
  });

  return {
    server,
    loaded,
    now,
    isCommunityServer,
    active,
    versionLabel,
    runtimeLabel,
    runtimeLabels: RUNTIME_LABELS,
  };
}
