import { describe, expect, it } from "vitest";
import {
  clipDisplayTitle,
  clipKillTier,
  clipQueueItem,
  formatClipDuration,
} from "~/utilities/clipDisplay";
import type { Clip } from "~/types/clip";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("clipDisplayTitle", () => {
  it("strips the auto-title's player prefix", () => {
    expect(clipDisplayTitle("k1tty — Best Round (4K)", "k1tty")).toBe(
      "Best Round (4K)",
    );
    expect(clipDisplayTitle("K1TTY - Highlights", "k1tty")).toBe("Highlights");
  });

  it("keeps titles without the prefix and escapes regex characters", () => {
    expect(clipDisplayTitle("Ace on B", "k1tty")).toBe("Ace on B");
    expect(clipDisplayTitle("a.b+ — Recap", "a.b+")).toBe("Recap");
  });

  it("returns null for an empty title", () => {
    expect(clipDisplayTitle("  ", "k1tty")).toBeNull();
    expect(clipDisplayTitle(null, "k1tty")).toBeNull();
  });
});

describe("clipKillTier", () => {
  it("marks single-round multi-kills by tier", () => {
    expect(clipKillTier({ kills_count: 5, round: 14 }, t)).toEqual({
      marks: true,
      filled: 5,
      label: "clips.tile.kills.ace",
    });
    expect(clipKillTier({ kills_count: 4, round: 3 }, t)).toEqual({
      marks: true,
      filled: 4,
      label: 'clips.tile.kills.multi:{"n":4}',
    });
    expect(clipKillTier({ kills_count: 1, round: 3 }, t)?.label).toBe(
      "clips.tile.kills.one",
    );
  });

  it("falls back to a total for recaps and multi-round clips", () => {
    expect(clipKillTier({ kills_count: 12, round: null }, t)).toEqual({
      marks: false,
      filled: 0,
      label: 'clips.tile.kills.total:{"count":12}',
    });
    expect(clipKillTier({ kills_count: 3, round: null }, t)?.marks).toBe(false);
    expect(clipKillTier({ kills_count: 7, round: 9 }, t)?.marks).toBe(false);
  });

  it("shows nothing without kills", () => {
    expect(clipKillTier({ kills_count: 0, round: 4 }, t)).toBeNull();
    expect(clipKillTier({ kills_count: null, round: null }, t)).toBeNull();
  });
});

describe("formatClipDuration", () => {
  it("formats m:ss and skips empty durations", () => {
    expect(formatClipDuration(24_000)).toBe("0:24");
    expect(formatClipDuration(75_400)).toBe("1:15");
    expect(formatClipDuration(0)).toBeNull();
    expect(formatClipDuration(null)).toBeNull();
  });
});

describe("clipQueueItem", () => {
  it("maps a clip onto the modal's playlist item", () => {
    const clip = {
      id: "c1",
      title: "Ace",
      duration_ms: 24000,
      thumbnail_download_url: "thumb.jpg",
      target: { steam_id: "1", name: "k1tty", avatar_url: null },
      match_map: { map: { poster: "poster.jpg" } },
    } as unknown as Clip;
    expect(clipQueueItem(clip)).toEqual({
      id: "c1",
      title: "Ace",
      playerName: "k1tty",
      teamName: null,
      durationMs: 24000,
      thumbnailUrl: "thumb.jpg",
      posterUrl: "poster.jpg",
      killsCount: null,
      round: null,
      mapLabel: null,
    });
  });

  it("carries the kill count, round and map for the queue's tiles", () => {
    const clip = {
      id: "c2",
      kills_count: 4,
      round: 13,
      match_map: { map: { name: "de_mirage", label: null } },
    } as unknown as Clip;
    expect(clipQueueItem(clip)).toMatchObject({
      killsCount: 4,
      round: 13,
      mapLabel: "Mirage",
    });
    expect(
      clipQueueItem({
        ...clip,
        match_map: { map: { name: "de_mirage", label: "Mirage (Classic)" } },
      } as unknown as Clip).mapLabel,
    ).toBe("Mirage (Classic)");
  });
});
