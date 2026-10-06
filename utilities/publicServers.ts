// Layout rules for the public servers page. Kept free of Vue so the choices
// (which two servers get the showcase, when the page turns into a list) are
// testable on their own.

// At or below this many online servers the rest show as tiles; above it they
// collapse into the filterable list.
export const SHOWCASE_LIMIT = 10;
export const FEATURED_COUNT = 2;

export type PublicServerSort = "players" | "ping";

export type PingTier = "excellent" | "good" | "fair" | "poor" | "unknown";

export interface RankableServer {
  id: string;
  label: string;
  featured?: boolean;
  hibernating?: boolean;
  players: number;
  max_players: number;
  // Undefined until the viewer has a latency reading for the region.
  ping?: number;
}

export function isFull(server: RankableServer): boolean {
  return server.max_players > 0 && server.players >= server.max_players;
}

// A ping we do not know sorts after every ping we do.
function comparePing(a: RankableServer, b: RankableServer): number {
  return (a.ping ?? Infinity) - (b.ping ?? Infinity);
}

// Awake before asleep, then the most people, then the closest.
export function compareBusiest(a: RankableServer, b: RankableServer): number {
  return (
    Number(!!a.hibernating) - Number(!!b.hibernating) ||
    b.players - a.players ||
    comparePing(a, b) ||
    a.label.localeCompare(b.label)
  );
}

export function sortServers<T extends RankableServer>(
  servers: T[],
  sort: PublicServerSort,
): T[] {
  if (sort === "ping") {
    return [...servers].sort(
      (a, b) => comparePing(a, b) || compareBusiest(a, b),
    );
  }
  return [...servers].sort(compareBusiest);
}

// Servers an admin pinned come first, in label order; the busiest fill the
// remaining slots. With nobody playing anywhere, busiest falls through to the
// closest, so the showcase is never empty while there are servers.
export function pickFeatured<T extends RankableServer>(
  servers: T[],
  count = FEATURED_COUNT,
): T[] {
  const pinned = servers
    .filter((server) => server.featured)
    .sort((a, b) => a.label.localeCompare(b.label));
  const others = servers
    .filter((server) => !server.featured)
    .sort(compareBusiest);
  return [...pinned, ...others].slice(0, count);
}

export function showcase<T extends RankableServer>(
  servers: T[],
): { featured: T[]; rest: T[]; layout: "tiles" | "list" } {
  const featured = pickFeatured(servers);
  const ids = new Set(featured.map((server) => server.id));
  return {
    featured,
    rest: servers.filter((server) => !ids.has(server.id)).sort(compareBusiest),
    layout: servers.length <= SHOWCASE_LIMIT ? "tiles" : "list",
  };
}

// Same thresholds as the matchmaking region readout (RegionLatency.vue).
export function pingTier(
  ping: number | undefined,
  maxAcceptableLatency = 100,
): PingTier {
  if (ping === undefined || Number.isNaN(ping)) {
    return "unknown";
  }
  if (ping < 30) {
    return "excellent";
  }
  if (ping < 50) {
    return "good";
  }
  if (ping < maxAcceptableLatency) {
    return "fair";
  }
  return "poor";
}
