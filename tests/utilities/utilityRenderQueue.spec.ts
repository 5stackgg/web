import { describe, expect, it } from "vitest";
import {
  liveUtilityRenderIds,
  utilityLineupsRendering,
} from "~/utilities/utilityRenderQueue";

const CDN = "https://cf.5stack.gg/clips/utility";

function render(
  id: string,
  lineup: string,
  status: string,
  previewUrl: string | null = null,
) {
  return {
    id,
    utility_lineup_id: lineup,
    status: status as any,
    lineup: { preview_url: previewUrl },
  };
}

describe("liveUtilityRenderIds", () => {
  it("marks the done render the lineup's preview is filed under", () => {
    const live = liveUtilityRenderIds([
      render("r-2", "l-1", "done", `${CDN}/l-1/r-2.mp4`),
      render("r-1", "l-1", "done", `${CDN}/l-1/r-2.mp4`),
      render("r-0", "l-1", "error", `${CDN}/l-1/r-2.mp4`),
    ]);

    expect([...live]).toEqual(["r-2"]);
  });

  it("gives an older lineup-keyed preview to its only done render", () => {
    expect([
      ...liveUtilityRenderIds([
        render("r-1", "l-1", "done", `${CDN}/l-1.mp4?v=3`),
        render("r-0", "l-1", "error", `${CDN}/l-1.mp4?v=3`),
      ]),
    ]).toEqual(["r-1"]);
  });

  it("gives a lineup-keyed preview to no one when two done renders could own it", () => {
    expect(
      liveUtilityRenderIds([
        render("r-1", "l-1", "done", `${CDN}/l-1.mp4`),
        render("r-2", "l-1", "done", `${CDN}/l-1.mp4`),
      ]).size,
    ).toBe(0);
  });

  it("marks nothing for a lineup without a preview", () => {
    expect(liveUtilityRenderIds([render("r-1", "l-1", "done")]).size).toBe(0);
  });
});

describe("utilityLineupsRendering", () => {
  it("names the lineups with a render queued, filming or uploading", () => {
    const rendering = utilityLineupsRendering([
      render("r-1", "l-1", "queued"),
      render("r-2", "l-2", "rendering"),
      render("r-3", "l-3", "uploading"),
      render("r-4", "l-4", "done"),
      render("r-5", "l-5", "error"),
    ]);

    expect([...rendering].sort()).toEqual(["l-1", "l-2", "l-3"]);
  });
});
