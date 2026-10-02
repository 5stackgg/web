import { describe, expect, it } from "vitest";
import { pageKeyWithoutTabQuery } from "~/utilities/pageKey";

function keyOf(path: string) {
  return pageKeyWithoutTabQuery(useRouter().resolve(path));
}

describe("pageKeyWithoutTabQuery", () => {
  // Every key change remounts the page: the whole dedicated server page
  // reloaded on each tab and settings section click.
  it("keeps the dedicated server page mounted across its tabs and settings sections", () => {
    const base = "/dedicated-servers/server-1";
    const key = keyOf(base);

    expect(keyOf(`${base}?tab=console`)).toBe(key);
    expect(keyOf(`${base}?tab=settings`)).toBe(key);
    expect(keyOf(`${base}?tab=settings&settings=plugins`)).toBe(key);
    expect(keyOf(`${base}?settings=access`)).toBe(key);
  });

  it("still remounts on a query the page does not keep", () => {
    expect(keyOf("/dedicated-servers/server-1?other=1")).not.toBe(
      keyOf("/dedicated-servers/server-1"),
    );
  });
});
