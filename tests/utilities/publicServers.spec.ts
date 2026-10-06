import { describe, expect, it } from "vitest";
import {
  SHOWCASE_LIMIT,
  pickFeatured,
  pingTier,
  showcase,
  sortServers,
  type RankableServer,
} from "~/utilities/publicServers";

function server(
  id: string,
  overrides: Partial<RankableServer> = {},
): RankableServer {
  return { id, label: id, players: 0, max_players: 10, ...overrides };
}

const ids = (servers: RankableServer[]) => servers.map((s) => s.id);

describe("pickFeatured", () => {
  it("puts pinned servers first, then the busiest", () => {
    const servers = [
      server("busy", { players: 8 }),
      server("pinned", { featured: true }),
      server("quiet", { players: 1 }),
    ];

    expect(ids(pickFeatured(servers))).toEqual(["pinned", "busy"]);
  });

  it("keeps a hibernating server out while an awake one is free", () => {
    const servers = [
      server("asleep", { hibernating: true, ping: 5 }),
      server("awake", { ping: 90 }),
      server("other", { ping: 40 }),
    ];

    expect(ids(pickFeatured(servers))).toEqual(["other", "awake"]);
  });

  it("falls back to the closest servers when nobody is playing", () => {
    const servers = [
      server("far", { ping: 120 }),
      server("unknown"),
      server("near", { ping: 12 }),
    ];

    expect(ids(pickFeatured(servers))).toEqual(["near", "far"]);
  });

  it("shows at most two even when more are pinned", () => {
    const servers = [
      server("c", { featured: true }),
      server("a", { featured: true }),
      server("b", { featured: true }),
    ];

    expect(ids(pickFeatured(servers))).toEqual(["a", "b"]);
  });
});

describe("showcase", () => {
  it("uses tiles up to the limit and a list beyond it", () => {
    const few = Array.from({ length: SHOWCASE_LIMIT }, (_, i) =>
      server(`s${i}`),
    );
    const many = [...few, server("extra")];

    expect(showcase(few).layout).toBe("tiles");
    expect(showcase(many).layout).toBe("list");
  });

  it("never repeats a featured server in the rest", () => {
    const servers = [
      server("a", { players: 5 }),
      server("b", { players: 3 }),
      server("c", { players: 1 }),
    ];
    const { featured, rest } = showcase(servers);

    expect(ids(featured)).toEqual(["a", "b"]);
    expect(ids(rest)).toEqual(["c"]);
  });
});

describe("sortServers", () => {
  it("sorts by ping with unknown pings last", () => {
    const servers = [
      server("unknown", { players: 9 }),
      server("far", { ping: 80 }),
      server("near", { ping: 20 }),
    ];

    expect(ids(sortServers(servers, "ping"))).toEqual([
      "near",
      "far",
      "unknown",
    ]);
  });

  it("sorts by players with hibernating servers last", () => {
    const servers = [
      server("asleep", { hibernating: true }),
      server("one", { players: 1 }),
      server("five", { players: 5 }),
    ];

    expect(ids(sortServers(servers, "players"))).toEqual([
      "five",
      "one",
      "asleep",
    ]);
  });
});

describe("pingTier", () => {
  it("matches the matchmaking readout thresholds", () => {
    expect(pingTier(undefined)).toBe("unknown");
    expect(pingTier(12)).toBe("excellent");
    expect(pingTier(40)).toBe("good");
    expect(pingTier(70)).toBe("fair");
    expect(pingTier(70, 60)).toBe("poor");
  });
});
