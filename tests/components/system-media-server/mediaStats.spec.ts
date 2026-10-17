// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  kindRows,
  pushHistory,
  unusedKinds,
  type MediaStats,
} from "~/components/system-media-server/mediaStats";

const stats = (byKind: MediaStats["byKind"]): MediaStats => ({
  paths: 0,
  ready: 0,
  webrtcSessions: 0,
  byKind,
});

describe("kindRows", () => {
  it("lists only kinds with a path, heaviest first, with shares of what came in", () => {
    const rows = kindRows(
      stats({
        gameStreams: { paths: 1, ready: 1, bytesReceived: 3000 },
        playerCameras: { paths: 0, ready: 0, bytesReceived: 0 },
        voice: { paths: 4, ready: 3, bytesReceived: 1000 },
        videoCalls: { paths: 0, ready: 0, bytesReceived: 0 },
        cameraTalkback: { paths: 1, ready: 0, bytesReceived: 0 },
      }),
    );
    expect(rows.map((row) => row.kind)).toEqual([
      "gameStreams",
      "voice",
      "cameraTalkback",
    ]);
    expect(rows.map((row) => row.share)).toEqual([0.75, 0.25, 0]);
  });

  it("does not divide by zero when every open path is idle", () => {
    const rows = kindRows(
      stats({ voice: { paths: 2, ready: 0, bytesReceived: 0 } }),
    );
    expect(rows).toEqual([
      { kind: "voice", paths: 2, ready: 0, bytesReceived: 0, share: 0 },
    ]);
  });
});

describe("unusedKinds", () => {
  it("treats a kind the api left out as unused", () => {
    expect(
      unusedKinds(
        stats({ gameStreams: { paths: 1, ready: 1, bytesReceived: 1 } }),
      ),
    ).toEqual(["playerCameras", "voice", "videoCalls", "cameraTalkback"]);
  });
});

describe("pushHistory", () => {
  it("keeps the newest values up to the window", () => {
    expect(pushHistory([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
    expect(pushHistory<number | null>([1], null, 3)).toEqual([1, null]);
  });
});
