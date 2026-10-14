import { describe, expect, it } from "vitest";
import { parseStreamLink } from "~/components/watch/streamPlatform";

describe("parseStreamLink", () => {
  it("reads a platform from an http(s) link", () => {
    expect(parseStreamLink("https://www.youtube.com/watch?v=abc123")).toEqual({
      platform: "youtube",
      id: "abc123",
    });
    expect(parseStreamLink("http://twitch.tv/Caster")).toEqual({
      platform: "twitch",
      id: "caster",
    });
  });

  it.each([
    "javascript://www.youtube.com/watch?v=abc123",
    "javascript://twitch.tv/caster",
    "data:text/html,<p>stream</p>",
  ])("finds no platform in %s", (link) => {
    expect(parseStreamLink(link)).toEqual({ platform: "iframe", id: null });
  });
});
