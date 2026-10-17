// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import {
  readRememberedView,
  saveRememberedView,
  useRememberedView,
} from "~/composables/useRememberedView";

const defaults = () => ({
  search: "",
  sort: "name",
  regions: [] as string[],
  hideOffline: false,
});

const stored = () => JSON.parse(localStorage.getItem("admin-view:list")!);

afterEach(() => localStorage.clear());

describe("readRememberedView", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(readRememberedView("list", defaults())).toEqual(defaults());
  });

  it("restores stored fields and drops ones the defaults don't name", () => {
    localStorage.setItem(
      "admin-view:list",
      JSON.stringify({ search: "fra", regions: ["eu"], legacy: 1 }),
    );
    const view = readRememberedView("list", defaults());
    expect(view).toEqual({
      search: "fra",
      sort: "name",
      regions: ["eu"],
      hideOffline: false,
    });
    expect(view).not.toHaveProperty("legacy");
  });

  it("falls back per field on the wrong shape or a failed validator", () => {
    localStorage.setItem(
      "admin-view:list",
      JSON.stringify({
        search: 5,
        sort: "bogus",
        regions: "eu",
        hideOffline: true,
      }),
    );
    const view = readRememberedView("list", defaults(), {
      sort: (value) => value === "name" || value === "nodes",
    });
    expect(view).toEqual({ ...defaults(), hideOffline: true });
  });

  it("survives unreadable storage", () => {
    localStorage.setItem("admin-view:list", "{not json");
    expect(readRememberedView("list", defaults())).toEqual(defaults());
    localStorage.setItem("admin-view:list", JSON.stringify(["array"]));
    expect(readRememberedView("list", defaults())).toEqual(defaults());
  });

  it("never hands back the caller's defaults object", () => {
    const base = defaults();
    const view = readRememberedView("list", base);
    view.regions.push("eu");
    expect(base.regions).toEqual([]);
  });
});

describe("saveRememberedView", () => {
  it("stores only the fields the defaults name", () => {
    saveRememberedView(
      "list",
      { ...defaults(), search: "x", extra: true } as any,
      defaults(),
    );
    expect(stored()).toEqual({ ...defaults(), search: "x" });
  });
});

describe("useRememberedView", () => {
  it("saves every change under admin-view:<key>", async () => {
    const view = useRememberedView("list", defaults());
    view.search = "nyc";
    view.regions.push("us");
    await nextTick();
    expect(stored()).toEqual({ ...defaults(), search: "nyc", regions: ["us"] });
  });

  it("starts from what was stored", () => {
    localStorage.setItem("admin-view:list", JSON.stringify({ sort: "nodes" }));
    expect(useRememberedView("list", defaults()).sort).toBe("nodes");
  });
});
