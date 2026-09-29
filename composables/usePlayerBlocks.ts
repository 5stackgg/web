import { computed, effectScope, reactive, ref, watch } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  BLOCK_PLAYER_MUTATION,
  MY_PLAYER_BLOCKS_SUBSCRIPTION,
  UNBLOCK_PLAYER_MUTATION,
} from "~/graphql/playerBlocks";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "~/stores/AuthStore";

export type PlayerBlock = {
  blocked_steam_id: string;
  created_at: string;
  blocked: {
    steam_id: string;
    name: string;
    avatar_url: string | null;
    custom_avatar_url?: string | null;
    country?: string | null;
  } | null;
};

const SUBSCRIPTION_KEY = "player-blocks";

const blocks = ref<Array<PlayerBlock>>([]);
const loaded = ref(false);
const available = ref(false);
const blocksView = computed(() => blocks.value);
const loadedView = computed(() => loaded.value);
const availableView = computed(() => available.value);
const busy = reactive<Record<string, boolean>>({});
const pending = new Map<string, Promise<void>>();
let watching = false;

function sid(steamId: string | number | bigint) {
  return String(steamId);
}

function subscribe(steamId?: string | null) {
  const manager = useSubscriptionManager();

  blocks.value = [];
  loaded.value = false;
  available.value = false;

  if (!steamId) {
    manager.unsubscribe(SUBSCRIPTION_KEY);
    return;
  }

  // Optional: web can reach an api that has not run the player_blocks
  // migration yet. That reads as "nobody blocked" with no way to block, not as
  // an error toast; and a stream that dies later keeps the list it last had.
  manager.subscribe(
    SUBSCRIPTION_KEY,
    getGraphqlClient()
      .subscribe({
        query: MY_PLAYER_BLOCKS_SUBSCRIPTION,
        context: { optional: true },
      })
      .subscribe({
        next: ({ data }: { data?: any }) => {
          blocks.value = data?.player_blocks ?? [];
          loaded.value = true;
          available.value = true;
        },
        error: () => {
          loaded.value = true;
        },
      }),
  );
}

function run(
  steamId: string | number | bigint,
  mutate: (steamId: string) => Promise<unknown>,
): Promise<void> {
  const key = sid(steamId);
  const existing = pending.get(key);

  if (existing) {
    return existing;
  }

  busy[key] = true;

  const request = mutate(key)
    .then(() => undefined)
    .finally(() => {
      pending.delete(key);
      delete busy[key];
    });

  pending.set(key, request);

  return request;
}

// A refusal comes back as a GraphQL error, which the global apollo error toast
// already shows (player_blocked included), so callers only toast success.
export function usePlayerBlocks() {
  if (!watching) {
    watching = true;

    effectScope(true).run(() => {
      watch(() => useAuthStore().me?.steam_id, subscribe, { immediate: true });
    });
  }

  function isBlocked(steamId?: string | number | bigint | null): boolean {
    if (steamId == null) {
      return false;
    }

    const target = sid(steamId);

    return blocks.value.some((row) => sid(row.blocked_steam_id) === target);
  }

  function isBusy(steamId?: string | number | bigint | null): boolean {
    return steamId != null && busy[sid(steamId)] === true;
  }

  function block(steamId: string | number | bigint) {
    return run(steamId, (key) =>
      getGraphqlClient().mutate({
        mutation: BLOCK_PLAYER_MUTATION,
        variables: { steamId: key },
      }),
    );
  }

  function unblock(steamId: string | number | bigint) {
    return run(steamId, (key) =>
      getGraphqlClient().mutate({
        mutation: UNBLOCK_PLAYER_MUTATION,
        variables: { steamId: key },
      }),
    );
  }

  return {
    blocks: blocksView,
    loaded: loadedView,
    available: availableView,
    isBlocked,
    isBusy,
    block,
    unblock,
  };
}
