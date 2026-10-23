import { onBeforeUnmount, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { generateSubscription } from "~/graphql/graphqlGen";
import { schemaHasField } from "~/utilities/schemaHasType";
import { useAuthStore } from "~/stores/AuthStore";

export type MatchRoles = { is_in_lineup: boolean; is_coach: boolean };

const MY_MATCH_ROLES = generateSubscription({
  my_active_matches: [{}, { id: true, is_in_lineup: true, is_coach: true }],
} as any);

// Which active matches the signed-in viewer plays in or coaches, from
// my_active_matches: their own matches, not every one on the site. With it,
// lists that are the same for every viewer can come from the public client,
// shared by everyone watching, and still mark the viewer's own matches.
//
// `ready` is null until known, true once the first answer is in, and false
// for a signed-out viewer, an api without my_active_matches, or an error:
// callers then read their lists as before, with the viewer's own session.
export function useMyMatchRoles() {
  const { client } = useApolloClient();
  const ready = ref<boolean | null>(null);
  const roles = ref(new Map<string, MatchRoles>());
  let subscription: { unsubscribe: () => void } | undefined;
  let closed = false;

  if (typeof window === "undefined" || !useAuthStore().me?.steam_id) {
    ready.value = false;
  } else {
    void schemaHasField(client, "subscription_root", "my_active_matches").then(
      (served) => {
        if (closed) return;
        if (!served) {
          ready.value = false;
          return;
        }
        subscription = client.subscribe({ query: MY_MATCH_ROLES }).subscribe({
          next: ({ data }: any) => {
            // A match that leaves the active list keeps its flags: the stage
            // plays out a finished match for the TV delay, and it stays off
            // its own players' stage.
            const next = new Map(roles.value);
            for (const m of data?.my_active_matches ?? []) {
              next.set(m.id, {
                is_in_lineup: !!m.is_in_lineup,
                is_coach: !!m.is_coach,
              });
            }
            roles.value = next;
            ready.value = true;
          },
          error: (err: any) => {
            console.error("[my-match-roles] subscription error", err);
            ready.value = false;
          },
        });
      },
    );
  }

  onBeforeUnmount(() => {
    closed = true;
    subscription?.unsubscribe();
  });

  return { ready, roles };
}

// Rows read as a guest know nothing of the viewer; these are theirs. A row's
// own flags still count, for an api that answers the public socket as the
// viewer.
export function withMatchRoles<
  T extends { id: string; is_in_lineup?: boolean; is_coach?: boolean },
>(rows: T[], roles: Map<string, MatchRoles>): Array<T & MatchRoles> {
  return rows.map((row) => ({
    ...row,
    is_in_lineup: !!row.is_in_lineup || !!roles.get(row.id)?.is_in_lineup,
    is_coach: !!row.is_coach || !!roles.get(row.id)?.is_coach,
  }));
}
