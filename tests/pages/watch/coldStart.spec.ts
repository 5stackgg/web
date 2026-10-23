import { describe, expect, it } from "vitest";
import { parse, print } from "graphql";
import WatchPage from "~/pages/watch/index.vue";

const subscriptions = (WatchPage as any).apollo.$subscribe;
const computed = (WatchPage as any).computed;

const root = (document: any) =>
  (parse(print(document)).definitions[0] as any).selectionSet.selections[0];

describe("watch page cold start", () => {
  it.each([
    ["hasMatches", "matches"],
    ["hasTournaments", "tournaments"],
  ])("%s asks for one %s, not a count", (key, field) => {
    const node = root(subscriptions[key].query);
    expect(node.name.value).toBe(field);
    expect(
      node.arguments.find((a: any) => a.name.value === "limit").value.value,
    ).toBe("1");
  });

  const page = (matches: unknown[] | null, tournaments: unknown[] | null) => {
    const vm: Record<string, any> = { hasMatches: null, hasTournaments: null };
    if (matches)
      subscriptions.hasMatches.result.call(vm, { data: { matches } });
    if (tournaments) {
      subscriptions.hasTournaments.result.call(vm, { data: { tournaments } });
    }
    return computed.feedIsEmpty.call(vm);
  };

  it("shows the cold start only once both answered and both are empty", () => {
    expect(page(null, null)).toBe(false);
    expect(page([], null)).toBe(false);
    expect(page([], [])).toBe(true);
    expect(page([{ id: "m" }], [])).toBe(false);
    expect(page([], [{ id: "t" }])).toBe(false);
  });
});
