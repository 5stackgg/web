import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SortHeader from "~/components/admin/SortHeader.vue";

const mountHeader = (props: Record<string, unknown>) =>
  mountSuspended(SortHeader, {
    props: {
      sortKey: "name",
      label: "Name",
      active: null,
      dir: "asc",
      ...props,
    },
  });

describe("SortHeader", () => {
  it("is a keyboard-reachable button inside the header cell", async () => {
    const wrapper = await mountHeader({});
    expect(wrapper.element.tagName).toBe("TH");
    expect(wrapper.attributes("aria-sort")).toBe("none");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("sort")).toEqual([["name"]]);
  });

  it("puts the same direction on aria-sort and the arrow", async () => {
    const wrapper = await mountHeader({ active: "name", dir: "desc" });
    expect(wrapper.attributes("aria-sort")).toBe("descending");
    expect(wrapper.text()).toContain("▼");
  });

  it("announces a secondary key's sort on the shared header", async () => {
    const wrapper = await mountHeader({
      sortKey: "server",
      label: "Server",
      secondary: [{ key: "status", label: "Status" }],
      active: "status",
      dir: "asc",
    });
    expect(wrapper.attributes("aria-sort")).toBe("ascending");
    const [server, status] = wrapper.findAll("button");
    expect(server.find(".sr-only").exists()).toBe(false);
    expect(status.find(".sr-only").exists()).toBe(true);
    await status.trigger("click");
    expect(wrapper.emitted("sort")).toEqual([["status"]]);
  });

  it("renders a plain label when it can't sort", async () => {
    const wrapper = await mountHeader({ disabled: true });
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.attributes("aria-sort")).toBeUndefined();
    expect(wrapper.text()).toBe("Name");
  });

  it("gives a grid header the columnheader role", async () => {
    const wrapper = await mountHeader({ as: "span" });
    expect(wrapper.attributes("role")).toBe("columnheader");
  });
});
