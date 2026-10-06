import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import {
  useRestoredData,
  useRestoredRefs,
} from "~/composables/useRestoredState";

// Stands in for the history layer: what a back/forward hands back, and the
// snapshot each helper registers for when the entry is left.
const history = vi.hoisted(() => ({
  saved: null as Record<string, unknown> | null,
  readers: new Map<string, () => unknown>(),
}));

vi.mock("~/composables/useScrollRestoration", () => ({
  useHistoryState: (id: string, read: () => unknown) => {
    history.readers.set(id, read);
    return history.saved;
  },
}));

beforeEach(() => {
  history.saved = null;
  history.readers.clear();
});

describe("useRestoredRefs", () => {
  it("leaves refs alone on an ordinary visit", () => {
    const page = ref(1);
    const sort = ref("name");

    expect(useRestoredRefs("list", { page, sort })).toBe(false);
    expect(page.value).toBe(1);
    expect(sort.value).toBe("name");
  });

  it("puts refs back to what they held on a back/forward", () => {
    history.saved = { page: 3, sort: "rating" };
    const page = ref(1);
    const sort = ref("name");

    expect(useRestoredRefs("list", { page, sort })).toBe(true);
    expect(page.value).toBe(3);
    expect(sort.value).toBe("rating");
  });

  it("keeps a ref the saved entry does not mention", () => {
    history.saved = { page: 2 };
    const page = ref(1);
    const query = ref("kai");

    useRestoredRefs("list", { page, query });

    expect(query.value).toBe("kai");
  });

  it("snapshots the refs' current values when the entry is left", () => {
    const page = ref(1);
    const sort = ref("name");
    useRestoredRefs("list", { page, sort });

    page.value = 4;
    sort.value = "active";

    expect(history.readers.get("list")?.()).toEqual({
      page: 4,
      sort: "active",
    });
  });
});

describe("useRestoredData", () => {
  // Called from data(), as the list pages do.
  const List = defineComponent({
    data() {
      const restored = useRestoredData("list", ["page"]);
      return { page: restored?.page ?? 1 };
    },
    render() {
      return h("span", String(this.page));
    },
  });

  it("starts an Options API component's data from the saved entry", () => {
    history.saved = { page: 5 };

    expect(mount(List).text()).toBe("5");
  });

  it("starts from the default on an ordinary visit", () => {
    expect(mount(List).text()).toBe("1");
  });

  it("snapshots the component's data when the entry is left", async () => {
    const wrapper = mount(List);
    (wrapper.vm as any).page = 7;

    expect(history.readers.get("list")?.()).toEqual({ page: 7 });
  });
});
