// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SLOW_MS,
  deadFraction,
  deadSeverity,
  explorerLink,
  hitSeverity,
  lockWaitCount,
  msSeverity,
  readSlowThreshold,
  relationMatches,
  runSeverity,
  saveSlowThreshold,
  slowSeverityFor,
  slowStats,
  tableSeverity,
  touchesTable,
} from "~/components/database/dbHealth";

const q = (id: string, query: string, mean: number, max: number) => ({
  queryid: id,
  query,
  calls: 100,
  mean_exec_time: mean,
  max_exec_time: max,
  total_exec_time: mean * 100,
});

describe("slow-query threshold", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to 1 s when storage is missing, blocked or holds junk", () => {
    expect(readSlowThreshold()).toBe(DEFAULT_SLOW_MS);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readSlowThreshold()).toBe(1000);
    vi.stubGlobal("localStorage", { getItem: () => "750" });
    expect(readSlowThreshold()).toBe(1000);
  });

  it("remembers one of the offered thresholds", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    saveSlowThreshold(250);
    expect(readSlowThreshold()).toBe(250);
  });

  it("never throws when saving is blocked", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => saveSlowThreshold(5000)).not.toThrow();
  });
});

describe("severity rules", () => {
  it("flags averages over the threshold, critical at ten times it", () => {
    expect(msSeverity(900, 1000)).toBe("");
    expect(msSeverity(1500, 1000)).toBe("warn");
    expect(msSeverity(10001, 1000)).toBe("bad");
  });

  it("makes a running query critical at 10x the threshold or past a minute", () => {
    expect(runSeverity(0.2, 250)).toBe("");
    expect(runSeverity(0.3, 250)).toBe("warn");
    expect(runSeverity(2.5, 250)).toBe("bad");
    expect(runSeverity(30, 5000)).toBe("warn");
    expect(runSeverity(61, 5000)).toBe("bad");
  });

  it("splits slow statements into averaging over, peaking over and running now", () => {
    const stats = slowStats(
      [
        q("a", "select 1", 1200, 3000),
        q("b", "select 2", 40, 2000),
        q("c", "select 3", 5, 50),
      ],
      [
        { pid: 1, state: "active", duration_seconds: 4, query: "x" },
        {
          pid: 2,
          state: "idle in transaction",
          duration_seconds: 400,
          query: "y",
        },
        { pid: 3, state: "active", duration_seconds: 0.2, query: "z" },
      ],
      1000,
    );
    expect(stats.avg.map((s) => s.queryid)).toEqual(["a"]);
    expect(stats.max.map((s) => s.queryid)).toEqual(["a", "b"]);
    expect(stats.run.map((c) => c.pid)).toEqual([1]);
  });

  it("computes dead share over every row, so it never passes 100%", () => {
    expect(deadFraction(0, 1221)).toBe(1);
    expect(deadFraction(4, 1221)).toBeLessThanOrEqual(1);
    expect(deadFraction(0, 0)).toBe(0);
    expect(deadFraction(75, 25)).toBe(0.25);
  });

  it("only flags dead rows past 10k", () => {
    expect(deadSeverity(4, 1221)).toBe("");
    expect(deadSeverity(100000, 15000)).toBe("warn");
    expect(deadSeverity(100000, 30000)).toBe("bad");
    expect(deadSeverity(1000000, 12000)).toBe("");
  });

  it("grades cache hit ratios", () => {
    expect(hitSeverity(null)).toBe("");
    expect(hitSeverity(0.99)).toBe("");
    expect(hitSeverity(0.9)).toBe("warn");
    expect(hitSeverity(0.7)).toBe("bad");
  });
});

describe("tables", () => {
  it("matches a statement on the bare or quoted table name only", () => {
    expect(
      touchesTable('SELECT * FROM "public"."matches" WHERE id = $1', "matches"),
    ).toBe(true);
    expect(touchesTable("select * from match_maps", "matches")).toBe(false);
    expect(touchesTable("select * from match_maps", "match_maps")).toBe(true);
    expect(touchesTable("update players_elo set x = 1", "players")).toBe(false);
  });

  it("rates a table on slow statements touching it", () => {
    const queries = [
      q("a", 'SELECT * FROM "public"."notifications"', 1500, 2000),
      q("b", "SELECT * FROM players", 12000, 15000),
    ];
    expect(slowSeverityFor(queries, "notifications", 1000)).toBe("warn");
    expect(slowSeverityFor(queries, "players", 1000)).toBe("bad");
    expect(slowSeverityFor(queries, "teams", 1000)).toBe("");
  });

  it("puts lock waits first, then the worst of bloat, slowness and unused indexes", () => {
    const base = {
      live: 1000,
      dead: 10,
      lockWaiting: false,
      unusedIndex: false,
      slow: "" as const,
    };
    expect(tableSeverity(base)).toBe("");
    expect(tableSeverity({ ...base, unusedIndex: true })).toBe("warn");
    expect(tableSeverity({ ...base, lockWaiting: true })).toBe("bad");
    expect(tableSeverity({ ...base, live: 50000, dead: 20000 })).toBe("bad");
  });

  it("reads pg_locks relation names with or without their schema", () => {
    expect(relationMatches("matches", "public", "matches")).toBe(true);
    expect(
      relationMatches("hdb_catalog.event_log", "hdb_catalog", "event_log"),
    ).toBe(true);
    expect(relationMatches('"public"."teams"', "public", "teams")).toBe(true);
    expect(relationMatches("event_log_pkey", "hdb_catalog", "event_log")).toBe(
      false,
    );
    expect(relationMatches(null, "public", "matches")).toBe(false);
  });

  it("counts sessions waiting on a lock, not every session with a wait event", () => {
    expect(
      lockWaitCount([
        { pid: 1, granted: true },
        { pid: 2, granted: false },
        { pid: 2, granted: false },
        { pid: 3, granted: false },
      ]),
    ).toBe(2);
    expect(lockWaitCount([])).toBe(0);
    expect(lockWaitCount(null)).toBe(0);
  });
});

describe("explorerLink", () => {
  it("opens a statement from ?query=", () => {
    expect(explorerLink({ tab: "queries", query: "-42" })).toEqual({
      queryid: "-42",
      slowOnly: false,
    });
    expect(explorerLink({ query: ["7", "8"] }).queryid).toBe("7");
    expect(explorerLink({ query: "" }).queryid).toBeNull();
    expect(explorerLink({}).queryid).toBeNull();
  });

  it("turns slow-only on only for ?slow=1 on the queries tab", () => {
    expect(explorerLink({ tab: "queries", slow: "1" }).slowOnly).toBe(true);
    expect(explorerLink({ tab: "locks", slow: "1" }).slowOnly).toBe(false);
    expect(explorerLink({ tab: "queries", slow: "0" }).slowOnly).toBe(false);
    expect(explorerLink({ slow: "1" }).slowOnly).toBe(false);
  });
});
