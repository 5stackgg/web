import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { unfurlCacheHeaders } from "~/server/utils/unfurl";

const MIDDLEWARE = path.resolve(__dirname, "../../server/middleware");

// The share-link shims answer a crawler with a card and a person with the app,
// at the same URL, on the user-agent alone.
const shims = fs
  .readdirSync(MIDDLEWARE)
  .filter((file) => file.endsWith("-unfurl.ts"));

describe("the cache headers on a share link's card", () => {
  it("keeps the card out of shared caches, and says what it varies on", () => {
    expect(unfurlCacheHeaders(300)).toEqual({
      "Cache-Control": "private, max-age=300",
      Vary: "User-Agent",
    });
    expect(unfurlCacheHeaders(120)["Cache-Control"]).toBe(
      "private, max-age=120",
    );
  });

  it("covers every page that has one", () => {
    expect(shims).toEqual(
      expect.arrayContaining([
        "events-unfurl.ts",
        "matches-unfurl.ts",
        "news-unfurl.ts",
        "utility-unfurl.ts",
      ]),
    );
  });

  // A card stored by a shared cache is served to people, and anyone can ask
  // for one with a crawler's user-agent.
  it.each(shims)("%s sends them, and never a public cache header", (file) => {
    const source = fs.readFileSync(path.join(MIDDLEWARE, file), "utf8");

    expect(source).toMatch(
      /setResponseHeaders\(event, unfurlCacheHeaders\(\d+\)\)/,
    );
    expect(source).not.toMatch(/Cache-Control"?,\s*"public/);
  });
});
