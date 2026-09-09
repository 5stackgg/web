import gql from "graphql-tag";
import { computed, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";

export type BroadcastHud = {
  id: string;
  slug: string;
  name: string;
  author: string | null;
  version: string | null;
  description: string | null;
  source: "builtin" | "imported";
  variant: string | null;
  thumbnail: string | null;
  is_signed: boolean;
};

// Raw gql rather than the generated zeus client: broadcast_huds is new, and the
// generated types are produced by `yarn codegen` against a running Hasura. Using
// zeus here would mean nobody can build this branch until someone has migrated
// an instance and regenerated. The leaderboard page reaches for gql for its own
// reasons, so the pattern is not novel here.
const HUDS_QUERY = gql`
  query BroadcastHuds {
    broadcast_huds(order_by: [{ source: asc }, { name: asc }]) {
      id
      slug
      name
      author
      version
      description
      source
      variant
      thumbnail
      is_signed
    }
  }
`;

// Module scope, not composable scope: the demo player, the stream deck and the
// settings page all want the same list, and it changes only when an
// administrator imports something. Fetching it once per mount would put the
// same query behind every HUD picker on the page.
const huds = ref<Array<BroadcastHud>>([]);
const loading = ref(false);
let inFlight: Promise<void> | null = null;

export function useBroadcastHuds() {
  const { client } = useApolloClient();

  async function fetch(force = false): Promise<void> {
    if (!force && huds.value.length > 0) {
      return;
    }
    // Three pickers mounting at once must not be three round-trips.
    if (inFlight && !force) {
      return inFlight;
    }

    loading.value = true;
    inFlight = (async () => {
      try {
        const { data } = await client.query({
          query: HUDS_QUERY,
          fetchPolicy: "network-only",
        });
        huds.value = (data?.broadcast_huds ?? []) as Array<BroadcastHud>;
      } catch {
        // A picker with nothing in it is recoverable; the caller falls back to
        // whatever the pod already booted with.
        huds.value = [];
      } finally {
        loading.value = false;
        inFlight = null;
      }
    })();

    return inFlight;
  }

  return {
    huds: computed(() => huds.value),
    loading: computed(() => loading.value),
    fetch,
    refresh: () => fetch(true),
    bySlug: (slug: string) => huds.value.find((hud) => hud.slug === slug) ?? null,
  };
}
