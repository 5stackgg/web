import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";
import {
  order_by,
  Selector,
  type GraphQLTypes,
  type InputType,
} from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

const hudFields = Selector("broadcast_huds")({
  id: true,
  slug: true,
  name: true,
  description: true,
  source: true,
  variant: true,
  enabled: true,
});

const hudLibraryFields = Selector("broadcast_huds")({
  ...hudFields,
  author: true,
  version: true,
  thumbnail: true,
  preview: true,
  page_url: true,
  is_signed: true,
});

export type BroadcastHud = InputType<
  GraphQLTypes["broadcast_huds"],
  typeof hudFields
>;

export type BroadcastHudDetails = InputType<
  GraphQLTypes["broadcast_huds"],
  typeof hudLibraryFields
>;

// One order_by key: a second one overruns TypeScript's instantiation depth
// (TS2589), so the source grouping is sorted client-side.
export const BROADCAST_HUDS_QUERY = generateQuery({
  broadcast_huds: [{ order_by: [{ name: order_by.asc }] }, hudFields],
});

export const BROADCAST_HUD_LIBRARY_QUERY = generateQuery({
  broadcast_huds: [{ order_by: [{ name: order_by.asc }] }, hudLibraryFields],
});

export function broadcastHudLabel(hud: { name?: string | null; slug: string }) {
  return hud.name?.trim() || hud.slug;
}

export function useBroadcastHuds() {
  const { result, refetch } = useQuery<{
    broadcast_huds: Array<BroadcastHud>;
  }>(BROADCAST_HUDS_QUERY);

  return {
    huds: computed(() =>
      (result.value?.broadcast_huds ?? [])
        .filter((hud) => hud.enabled)
        .sort((a, b) => a.source.localeCompare(b.source)),
    ),
    refetch,
  };
}
