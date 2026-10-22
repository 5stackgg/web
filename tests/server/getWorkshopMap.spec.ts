// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The parts of a real workshop page the lookup reads.
const workshopPage = (id: string, title: string, app = "730") => `
  <meta property="og:image" content="https://images.steamusercontent.com/ugc/1/${id}/?imw=512&amp;&amp;ima=fit">
  <div class="workshopItemTitle">${title}</div>
  <span onclick="ShowAddToCollection( '${id}', '${app}' );" id="AddToCollectionBtn"></span>`;

let details: Record<string, unknown>;
let page: string;
let pageFetches: Array<string>;

beforeEach(() => {
  vi.resetModules();
  pageFetches = [];
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async (event: any) => event.body);
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.startsWith("https://steamcommunity.com/")) {
      pageFetches.push(url);
      return new Response(page);
    }
    return new Response(
      JSON.stringify({ response: { publishedfiledetails: [details] } }),
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function lookup(workshopMapId: string) {
  const handler = (await import("~/server/api/get-workshop-map.post"))
    .default as any;
  return handler({ body: { workshop_map_id: workshopMapId } });
}

describe("the workshop map lookup", () => {
  it("returns a public item from Steam's API", async () => {
    details = {
      publishedfileid: "3070290240",
      result: 1,
      title: "Brewery",
      preview_url: "https://images.steamusercontent.com/ugc/2/brewery/",
    };

    expect(await lookup("3070290240")).toEqual(details);
    expect(pageFetches).toEqual([]);
  });

  // Steam's API answers an unlisted item with result 9, as it does a missing one.
  it("reads an unlisted item from its workshop page", async () => {
    details = { publishedfileid: "3820018883", result: 9 };
    page = workshopPage("3820018883", "de_lbt_mill &amp; co");

    expect(await lookup(" 3820018883 ")).toEqual({
      publishedfileid: "3820018883",
      title: "de_lbt_mill & co",
      preview_url: "https://images.steamusercontent.com/ugc/1/3820018883/",
    });
  });

  it("finds nothing when the workshop page is Steam's error page", async () => {
    details = { publishedfileid: "1", result: 9 };
    page = "<title>Steam Community :: Error</title>";

    expect(await lookup("1")).toBeNull();
  });

  it("never puts anything but a numeric id into the page link", async () => {
    details = { result: 9 };
    page = workshopPage("1", "de_dust2");

    expect(await lookup("1&id=1")).toBeNull();
    expect(pageFetches).toEqual([]);
  });

  it("finds nothing when the page is another game's item", async () => {
    details = { publishedfileid: "42", result: 9 };
    page = workshopPage("42", "Some Mod", "4000");

    expect(await lookup("42")).toBeNull();
  });
});
