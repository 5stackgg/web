import { describe, expect, it } from "vitest";
import { pickEncoderMarker } from "~/utilities/encoderMarker";

const at = "2026-10-07T12:00:00.000Z";

describe("pickEncoderMarker", () => {
  it("picks the newest live entry whose stage starts with encoder:", () => {
    expect(
      pickEncoderMarker([
        {
          status: "launching_cs2",
          at,
          progress_stage: "verifying shader cache",
        },
        { status: "live", at, progress_stage: "encoder:x264enc" },
        { status: "connecting_to_game", at },
        { status: "live", at, progress_stage: "encoder:vah264enc" },
      ]),
    ).toEqual({ element: "vah264enc", warning: false });
  });

  it("finds the live marker on either side of a demo's playing entry", () => {
    const live = { status: "live", at, progress_stage: "encoder:vah264enc" };
    const playing = { status: "playing", at };
    const expected = { element: "vah264enc", warning: false };
    expect(pickEncoderMarker([live, playing])).toEqual(expected);
    expect(pickEncoderMarker([playing, live])).toEqual(expected);
  });

  it("gives null for null and undefined", () => {
    expect(pickEncoderMarker(null)).toBeNull();
    expect(pickEncoderMarker(undefined)).toBeNull();
  });

  it("gives null when no live entry carries a marker", () => {
    expect(pickEncoderMarker([])).toBeNull();
    expect(
      pickEncoderMarker([
        {
          status: "processing_shaders",
          at,
          progress: 100,
          progress_stage: "120 / 120",
        },
        { status: "launching_cs2", at, progress_stage: "encoder:vah264enc" },
        { status: "live", at },
      ]),
    ).toBeNull();
  });

  it("marks x264enc as a warning", () => {
    expect(
      pickEncoderMarker([
        { status: "live", at, progress_stage: "encoder:x264enc" },
      ]),
    ).toEqual({ element: "x264enc", warning: true });
  });

  it("skips an empty element and non-object entries, and needs an array", () => {
    expect(
      pickEncoderMarker([
        { status: "live", at, progress_stage: "encoder:vah265enc" },
        { status: "connecting_to_game", at },
        null,
        "live",
        { status: "live", at, progress_stage: "encoder:" },
      ]),
    ).toEqual({ element: "vah265enc", warning: false });
    expect(
      pickEncoderMarker({
        status: "live",
        progress_stage: "encoder:vah264enc",
      }),
    ).toBeNull();
  });
});
