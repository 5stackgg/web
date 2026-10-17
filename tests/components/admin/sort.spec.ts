// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ariaSortFor, nextSort, useSort } from "~/components/admin/sort";

describe("nextSort", () => {
  it("flips the sorted column", () => {
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({
      key: "name",
      dir: "desc",
    });
  });

  it("switches columns in their natural direction, else ascending", () => {
    const natural = { players: "desc" } as const;
    expect(nextSort({ key: "name", dir: "asc" }, "players", natural)).toEqual({
      key: "players",
      dir: "desc",
    });
    expect(nextSort({ key: "players", dir: "asc" }, "name", natural)).toEqual({
      key: "name",
      dir: "asc",
    });
  });
});

describe("ariaSortFor", () => {
  it("reads sorted when any of the header's keys is active", () => {
    const current = { key: "status", dir: "desc" as const };
    expect(ariaSortFor(current, ["server", "status"])).toBe("descending");
    expect(ariaSortFor(current, "server")).toBe("none");
    expect(ariaSortFor({ key: null, dir: "asc" }, "server")).toBe("none");
  });
});

describe("useSort", () => {
  it("toggles or switches, and reports aria-sort and the comparator sign", () => {
    const sort = useSort<"name" | "players">("name", "asc", {
      players: "desc",
    });
    sort.toggle("players");
    expect([sort.key.value, sort.dir.value]).toEqual(["players", "desc"]);
    expect(sort.sign()).toBe(-1);
    expect(sort.ariaSort("players")).toBe("descending");
    sort.toggle("players");
    expect(sort.dir.value).toBe("asc");
    expect(sort.ariaSort("name")).toBe("none");
  });
});
