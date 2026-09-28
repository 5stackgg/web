import gql from "graphql-tag";
import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";

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
  enabled: boolean;
};

// Raw gql until zeus is regenerated against a Hasura that has broadcast_huds.
export const BROADCAST_HUDS_QUERY = gql`
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
      enabled
    }
  }
`;

export function broadcastHudLabel(hud: { name?: string | null; slug: string }) {
  return hud.name?.trim() || hud.slug;
}

export function useBroadcastHuds() {
  const { result, refetch } = useQuery<{
    broadcast_huds: Array<BroadcastHud>;
  }>(BROADCAST_HUDS_QUERY);

  return {
    huds: computed(() =>
      (result.value?.broadcast_huds ?? []).filter((hud) => hud.enabled),
    ),
    refetch,
  };
}
