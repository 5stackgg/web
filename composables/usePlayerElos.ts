import { reactive } from "vue";
import { $ } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";

// Tournament rosters show elo only in opened rows, so the live rosters leave
// it out and it is read here when a row opens.
const elos = reactive(new Map<string, unknown>());

const PLAYER_ELOS = generateQuery({
  players: [
    { where: { steam_id: { _in: $("steamIds", "[bigint!]!") } } },
    { steam_id: true, elo: true },
  ],
} as any);

export async function loadPlayerElos(
  steamIds: Array<string | number | null | undefined>,
): Promise<void> {
  const ids = [...new Set(steamIds.filter((id) => id != null).map(String))];
  if (ids.length === 0 || typeof window === "undefined") {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: PLAYER_ELOS,
      variables: { steamIds: ids },
      fetchPolicy: "network-only",
    });
    for (const player of (data as any)?.players ?? []) {
      elos.set(String(player.steam_id), player.elo);
    }
  } catch (error) {
    console.error("[player-elos] query error", error);
  }
}

export function withPlayerElo<T extends { steam_id?: unknown }>(
  player: T | null | undefined,
): T | null | undefined {
  if (!player) {
    return player;
  }
  const key = String(player.steam_id);
  return elos.has(key) ? { ...player, elo: elos.get(key) } : player;
}
