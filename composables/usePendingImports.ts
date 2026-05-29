import { gql } from "@apollo/client/core";
import { effectScope, ref, watch } from "vue";
import { useAuthStore } from "~/stores/AuthStore";

export type PendingImport = {
  valve_match_id: string;
  status: string;
  error?: string | null;
  map_name?: string | null;
  match_start_time?: string | null;
  updated_at?: string | null;
};

const AUTH_SUBSCRIPTION = gql`
  subscription PendingImportsAuth($steam_id: bigint!) {
    player_steam_match_auth_by_pk(steam_id: $steam_id) {
      steam_id
    }
  }
`;

const PENDING_IMPORTS_SUBSCRIPTION = gql`
  subscription PendingImports {
    pending_match_imports(order_by: { updated_at: desc }) {
      valve_match_id
      status
      error
      map_name
      match_start_time
      updated_at
    }
  }
`;

const pendingImports = ref<PendingImport[]>([]);
const isLinked = ref(false);
let started = false;

export function usePendingImports() {
  if (import.meta.client && !started) {
    started = true;
    const apolloClient = useApolloClient().client;
    const authStore = useAuthStore();

    let authSub: { unsubscribe: () => void } | null = null;
    let pendingSub: { unsubscribe: () => void } | null = null;

    const stopPending = () => {
      pendingSub?.unsubscribe();
      pendingSub = null;
    };

    effectScope(true).run(() => {
      watch(
        () => authStore.me?.steam_id,
        (steamId) => {
          authSub?.unsubscribe();
          authSub = null;
          stopPending();
          isLinked.value = false;
          pendingImports.value = [];
          if (!steamId) {
            return;
          }

          authSub = apolloClient
            .subscribe({
              query: AUTH_SUBSCRIPTION,
              variables: { steam_id: steamId },
            })
            .subscribe({
              next: ({ data }: any) => {
                const linked = !!data?.player_steam_match_auth_by_pk;
                if (linked === isLinked.value) {
                  return;
                }
                isLinked.value = linked;
                stopPending();
                pendingImports.value = [];
                if (!linked) {
                  return;
                }
                pendingSub = apolloClient
                  .subscribe({ query: PENDING_IMPORTS_SUBSCRIPTION })
                  .subscribe({
                    next: ({ data }: any) => {
                      pendingImports.value = data?.pending_match_imports ?? [];
                    },
                  });
              },
            });
        },
        { immediate: true },
      );
    });
  }

  return { pendingImports, isLinked };
}
