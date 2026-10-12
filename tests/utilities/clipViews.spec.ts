import { describe, expect, it } from "vitest";
import { clipPlaybackUrl } from "~/utilities/clipViews";

describe("clipPlaybackUrl", () => {
  it("marks a Worker clip URL, keeping its download name and version", () => {
    const url = new URL(
      clipPlaybackUrl(
        "https://cf.5stack.gg/clips/765/0b7c.mp4?name=ace-on-B.mp4&v=1759990000",
      ),
    );

    expect(url.pathname).toBe("/clips/765/0b7c.mp4");
    expect(url.searchParams.get("name")).toBe("ace-on-B.mp4");
    expect(url.searchParams.get("v")).toBe("1759990000");
    expect(url.searchParams.get("noview")).toBe("1");
  });

  it("marks an api-served clip URL the same way", () => {
    expect(clipPlaybackUrl("https://demos.5stack.gg/clips/0b7c-uuid")).toBe(
      "https://demos.5stack.gg/clips/0b7c-uuid?noview=1",
    );
  });

  it("gives the same URL every time, so a warmed clip is a cache hit", () => {
    const once = clipPlaybackUrl("https://cf.5stack.gg/clips/1/a.mp4?v=1");

    expect(clipPlaybackUrl(once)).toBe(once);
  });

  it("leaves something that isn't a URL alone", () => {
    expect(clipPlaybackUrl("not a url")).toBe("not a url");
  });
});
