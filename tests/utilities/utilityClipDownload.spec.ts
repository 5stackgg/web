import { describe, expect, it } from "vitest";
import {
  utilityClipDownload,
  utilityClipFileName,
} from "~/utilities/utilityDisplay";

describe("utilityClipFileName", () => {
  it("names the file for the map and the lineup", () => {
    expect(utilityClipFileName("de_mirage", "Window smoke (from T spawn)")).toBe(
      "mirage-window-smoke-from-t-spawn.mp4",
    );
  });

  it("keeps to ASCII, since the worker sends it back in a header", () => {
    expect(utilityClipFileName("de_nuke", "Смок на окно")).toBe("nuke.mp4");
    expect(utilityClipFileName(null, "日本")).toBe("lineup.mp4");
  });
});

describe("utilityClipDownload", () => {
  it("asks the clip worker for an attachment under that name", () => {
    const download = utilityClipDownload({
      preview_url: "https://cf.5stack.gg/clips/utility/l-1/r-1.mp4",
      map_name: "de_mirage",
      name: "Window smoke",
    } as any);

    expect(download?.name).toBe("mirage-window-smoke.mp4");
    const url = new URL(download!.href);
    expect(url.pathname).toBe("/clips/utility/l-1/r-1.mp4");
    expect(url.searchParams.get("dl")).toBe("1");
    expect(url.searchParams.get("name")).toBe("mirage-window-smoke.mp4");
  });

  it("offers nothing for a clip we did not render", () => {
    expect(
      utilityClipDownload({
        preview_url: null,
        map_name: "de_mirage",
        name: "Window smoke",
      } as any),
    ).toBeNull();
  });
});
