// @vitest-environment node
import { describe, expect, it } from "vitest";
import { orderByIds } from "~/utilities/orderByIds";

describe("orderByIds", () => {
  it("returns rows in the order of the ids", () => {
    const rows = [{ id: "b" }, { id: "c" }, { id: "a" }];
    expect(orderByIds(rows, ["a", "b", "c"]).map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("drops an id whose row is gone and ignores rows nobody asked for", () => {
    const rows = [{ id: "a" }, { id: "z" }, { id: "c" }];
    expect(orderByIds(rows, ["c", "b", "a"]).map((row) => row.id)).toEqual([
      "c",
      "a",
    ]);
  });

  it("is empty without ids", () => {
    expect(orderByIds([{ id: "a" }], [])).toEqual([]);
  });
});
