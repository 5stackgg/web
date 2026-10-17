// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  countLevels,
  groupRepeats,
  highlight,
  insertSorted,
  parseMessage,
  serviceStatus,
  signatureOf,
  toLogLine,
  volumeBuckets,
  type LogLine,
} from "~/components/system-logs/logLines";

const at = (iso: string) => Date.parse(iso);
let id = 0;
const line = (
  service: string,
  log: string,
  timestamp = "2026-10-16T14:02:01.123456789Z",
  pod = `${service}-0`,
  previous?: LogLine,
) => toLogLine(++id, service, { log: ` ${log}`, pod, timestamp }, previous);

describe("parseMessage", () => {
  it("reads Nest lines into level, context and message", () => {
    expect(
      parseMessage(
        "[Nest] 1  - 10/16/2026, 4:12:01 PM     WARN [RconService] rcon timeout on 10.42.0.17:27015",
      ),
    ).toEqual({
      level: "WARN",
      ctx: "RconService",
      msg: "rcon timeout on 10.42.0.17:27015",
    });
    expect(
      parseMessage(
        "[Nest] 1  - 10/16/2026, 4:12:01 PM   ERROR [DemosService] upload failed",
      ).level,
    ).toBe("ERROR");
  });

  it("knows each service's own level markers", () => {
    expect(
      parseMessage('{"type":"http-log","level":"error","detail":{}}').level,
    ).toBe("ERROR");
    expect(
      parseMessage('{"type":"livequery-poller-log","level":"warn"}').level,
    ).toBe("WARN");
    expect(
      parseMessage("W20261016 14:02:01.123 1 http_client.cpp:139] Slow request")
        .level,
    ).toBe("WARN");
    expect(
      parseMessage("I20261016 14:02:01.123 1 raft_server.cpp:693] Term: 3")
        .level,
    ).toBe("LOG");
    expect(parseMessage("[412] ERROR:  deadlock detected").level).toBe("ERROR");
    expect(
      parseMessage("[412] WARNING:  there is no transaction in progress").level,
    ).toBe("WARN");
    expect(parseMessage("[412] LOG:  checkpoint complete").level).toBe("LOG");
    expect(
      parseMessage(
        "WAR [WebRTC] [session 1a2b3c] ICE connection state: disconnected",
      ).level,
    ).toBe("WARN");
    expect(
      parseMessage("ERR [path camera] no stream is available on path").level,
    ).toBe("ERROR");
    expect(
      parseMessage(
        "1:M 16 Oct 2026 14:02:01.123 # WARNING Memory overcommit must be enabled.",
      ).level,
    ).toBe("WARN");
    expect(
      parseMessage("1:M 16 Oct 2026 14:02:01.123 * DB saved on disk").level,
    ).toBe("LOG");
    expect(
      parseMessage("ERROR rustfs::api: PUT demos/x.dem 503 SlowDown").level,
    ).toBe("ERROR");
    expect(
      parseMessage("[nitro] FetchError: request to http://api:5585 failed")
        .level,
    ).toBe("ERROR");
    expect(parseMessage("GET /matches 200 12ms").level).toBe("LOG");
  });
});

describe("toLogLine", () => {
  it("drops the space the api leaves after the timestamp, and ANSI colour", () => {
    const l = line("web", "\u001b[32mGET / 200\u001b[39m");
    expect(l.raw).toBe("GET / 200");
    expect(l.t).toBe(at("2026-10-16T14:02:01.123Z"));
  });

  it("shows a stack frame at the level of the line it continues, without counting it", () => {
    const err = line(
      "api",
      "[Nest] 1  - 10/16/2026, 4:12:01 PM   ERROR [X] boom",
    );
    const frame = line(
      "api",
      "    at Foo (/app/dist/main.js:1:1)",
      undefined,
      "api-0",
      err,
    );
    expect(frame.cont).toBe(true);
    expect(frame.level).toBe("ERROR");
    expect(countLevels([err, frame])).toEqual({ warn: 0, error: 1 });
  });

  it("carries a line cut across two chunks on the time of the one before it", () => {
    const head = line(
      "timescaledb",
      "LOG:  statement: SELECT * FROM",
      "2026-10-16T14:02:05.500Z",
    );
    const tail = toLogLine(
      ++id,
      "timescaledb",
      { log: "matches WHERE id = $1", pod: "timescaledb-0" },
      head,
    );
    expect(tail.cont).toBe(true);
    expect(tail.t).toBe(head.t);
    expect(tail.timestamp).toBe(head.timestamp);

    // Without a line before it from the same pod there is nothing to carry.
    const orphan = toLogLine(
      ++id,
      "timescaledb",
      { log: "x", pod: "other-0" },
      head,
    );
    expect(orphan.cont).toBe(false);
    expect(orphan.t).toBe(0);
  });
});

describe("merging and triage", () => {
  it("keeps the merged list in time order however lines arrive", () => {
    const list: LogLine[] = [];
    insertSorted(list, line("api", "b", "2026-10-16T14:02:02.000Z"));
    insertSorted(list, line("hasura", "c", "2026-10-16T14:02:03.000Z"));
    insertSorted(list, line("redis", "a", "2026-10-16T14:02:01.000Z"));
    expect(list.map((l) => l.raw)).toEqual(["a", "b", "c"]);
  });

  it("groups repeating warnings and errors by message shape, errors first", () => {
    const lines = [
      line(
        "api",
        "[Nest] 1  - 10/16/2026, 4:12:01 PM    WARN [Rcon] rcon timeout on 10.42.0.17:27015 after 5000ms",
      ),
      line(
        "api",
        "[Nest] 1  - 10/16/2026, 4:12:02 PM    WARN [Rcon] rcon timeout on 10.42.0.33:27015 after 5000ms",
      ),
      line(
        "rustfs",
        "ERROR rustfs::api: PUT demos/0b8e0f6a-3a51-4c1b-9d47-35a7f3a4c2e1/de_nuke.dem 503 SlowDown",
      ),
      line(
        "rustfs",
        "ERROR rustfs::api: PUT demos/9c1d2e3f-0000-4c1b-9d47-35a7f3a4c2e1/de_nuke.dem 503 SlowDown",
      ),
      line(
        "api",
        "[Nest] 1  - 10/16/2026, 4:12:03 PM    WARN [Steam] 429 once",
      ),
    ];
    const groups = groupRepeats(lines);
    expect(groups).toHaveLength(2);
    expect(groups[0].level).toBe("ERROR");
    expect(groups[0].count).toBe(2);
    expect(groups[1].ctx).toBe("Rcon");
    expect(signatureOf(lines[0])).toBe(signatureOf(lines[1]));
  });

  it("buckets volume per minute by level over the loaded window", () => {
    const now = at("2026-10-16T14:05:00.000Z");
    const buckets = volumeBuckets(
      [
        line("api", "[412] ERROR:  x", "2026-10-16T14:01:30.000Z"),
        line("api", "[412] LOG:  y", "2026-10-16T14:04:10.000Z"),
        line("api", "[412] WARNING:  z", "2026-10-16T14:04:20.000Z"),
      ],
      now,
    );
    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toMatchObject({ ERROR: 1, WARN: 0, LOG: 0 });
    expect(buckets[3]).toMatchObject({ ERROR: 0, WARN: 1, LOG: 1 });
  });

  it("widens bars so a long window stays within the strip", () => {
    const now = at("2026-10-16T18:00:00.000Z");
    const buckets = volumeBuckets(
      [line("api", "x", "2026-10-16T14:00:00.000Z")],
      now,
      120,
    );
    expect(buckets.length).toBeLessThanOrEqual(120);
    expect(buckets[0].size).toBe(2 * 60000);
  });

  it("judges a service on its last five minutes", () => {
    const now = at("2026-10-16T14:30:00.000Z");
    const old = line("api", "[412] ERROR:  old", "2026-10-16T14:00:00.000Z");
    const recent = line(
      "api",
      "[412] WARNING:  new",
      "2026-10-16T14:29:00.000Z",
    );
    expect(serviceStatus([], now)).toBe("off");
    expect(serviceStatus([old], now)).toBe("ok");
    expect(serviceStatus([old, recent], now)).toBe("warn");
  });

  it("splits text around search hits", () => {
    expect(highlight("Rcon timeout, rcon retry", "rcon")).toEqual([
      { text: "Rcon", hit: true },
      { text: " timeout, ", hit: false },
      { text: "rcon", hit: true },
      { text: " retry", hit: false },
    ]);
  });
});
