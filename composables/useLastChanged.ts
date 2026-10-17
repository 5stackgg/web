import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import { schemaHasField } from "~/utilities/schemaHasType";

// Who last changed an admin row's settings, and when. The api stamps
// last_changed_at / last_changed_by on these tables only for admin edits,
// never for status writes; rows edited before it shipped have nulls.

export type LastChangedType =
  | "servers"
  | "game_server_nodes"
  | "seasons"
  | "server_regions"
  | "system_alerts"
  | "awards";

export type LastChangedBy = { name: string | null; steam_id: string };

const PRIMARY_KEY: Record<LastChangedType, { arg: string; type: string }> = {
  servers: { arg: "id", type: "uuid" },
  game_server_nodes: { arg: "id", type: "String" },
  seasons: { arg: "id", type: "uuid" },
  server_regions: { arg: "value", type: "String" },
  system_alerts: { arg: "id", type: "uuid" },
  awards: { arg: "id", type: "uuid" },
};

// The columns an admin edits from the web. A change to any of them in a live
// row means the stamp may have moved, so it is read again; status columns are
// left out so a live page doesn't re-ask on every heartbeat.
const SETTINGS: Record<LastChangedType, string[]> = {
  servers: [
    "label",
    "host",
    "port",
    "tv_port",
    "region",
    "type",
    "game",
    "game_mode_id",
    "enabled",
    "max_players",
    "featured",
    "steam_relay",
    "access_min_role",
    "access_restricted",
    "map_rotation_shuffle",
  ],
  game_server_nodes: [
    "label",
    "region",
    "enabled",
    "enabled_for_match_making",
    "accepting_new_matches",
    "start_port_range",
    "end_port_range",
    "pin_build_id",
    "pin_plugin_version",
    "pin_plugin_runtime",
    "demo_network_limiter",
    "gpu_rendering_enabled",
    "gpu_streaming_enabled",
    "gpu_demos_enabled",
    "cs2_video_settings",
  ],
  seasons: ["number", "description", "starts_at", "ends_at"],
  server_regions: ["description", "is_lan", "steam_relay"],
  system_alerts: [
    "type",
    "title",
    "message",
    "is_active",
    "dismissible",
    "expires_at",
    "updated_at",
  ],
  awards: [
    "name",
    "description",
    "tier",
    "allow_multiple",
    "image_url",
    "silhouette",
    "tournament_id",
    "event_id",
    "season_id",
    "league_season_id",
    "updated_at",
  ],
};

export function lastChangedId(
  type: LastChangedType,
  row: Record<string, any> | null | undefined,
): string | null {
  const id = row?.[PRIMARY_KEY[type].arg];
  return id == null || id === "" ? null : String(id);
}

export function lastChangedKey(
  type: LastChangedType,
  row: Record<string, any> | null | undefined,
): string | null {
  return row ? JSON.stringify(SETTINGS[type].map((field) => row[field])) : null;
}

// Raw documents: the columns are newer than the generated Zeus types.
function lastChangedQuery(type: LastChangedType, withBy: boolean) {
  const key = PRIMARY_KEY[type];
  return gql`
    query LastChanged($key: ${key.type}!) {
      ${type}_by_pk(${key.arg}: $key) {
        last_changed_at
        ${withBy ? "last_changed_by { name steam_id }" : ""}
      }
    }
  `;
}

// An optimistic edit moves the live row before the write lands, so a re-read
// waits for it to settle.
const SETTLE_MS = 600;

export function useLastChanged(
  type: LastChangedType,
  id: MaybeRefOrGetter<string | number | null | undefined>,
  refreshKey?: MaybeRefOrGetter<unknown>,
) {
  const apollo = useApolloClient();
  const at = ref<string | null>(null);
  const by = ref<LastChangedBy | null>(null);

  let request = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function load() {
    const token = ++request;
    const key = toValue(id);
    if (key == null || key === "") {
      return;
    }

    // A quiet line never takes the page down with it, so the client is
    // resolved here, where a failure only leaves it blank.
    try {
      const client = apollo.client;
      // Introspection is per role, so this also answers false for a role
      // that can't read the column.
      if (!(await schemaHasField(client, type, "last_changed_at"))) {
        return;
      }
      const withBy = await schemaHasField(client, type, "last_changed_by");
      const { data } = await client.query({
        query: lastChangedQuery(type, withBy),
        variables: { key },
        // Kept out of the cache: the page's own queries on this root field
        // select other columns, and sharing the slot would make them refetch.
        fetchPolicy: "no-cache",
        context: { optional: true },
      });
      if (token !== request) {
        return;
      }
      const row = (data as any)?.[`${type}_by_pk`];
      at.value = row?.last_changed_at ?? null;
      by.value = (row?.last_changed_at && row?.last_changed_by) || null;
    } catch {
      if (token === request) {
        at.value = null;
        by.value = null;
      }
    }
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  watch(
    [() => toValue(id), () => toValue(refreshKey)],
    ([nextId], previous) => {
      cancel();
      if (!previous || nextId !== previous[0]) {
        request++;
        at.value = null;
        by.value = null;
        void load();
        return;
      }
      // The live row arriving is not an edit.
      if (previous[1] == null) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        void load();
      }, SETTLE_MS);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    cancel();
    request++;
  });

  return { at, by };
}
