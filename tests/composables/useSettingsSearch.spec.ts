import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import {
  useSettingsSearch,
  useSettingsSearchReveal,
} from "~/composables/useSettingsSearch";

async function mountSearch() {
  let search!: ReturnType<typeof useSettingsSearch>;
  const container = ref<HTMLElement | null>(null);
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        search = useSettingsSearch();
        useSettingsSearchReveal(container);
        return () => h("div", { ref: container });
      },
    }),
    { attachTo: document.body },
  );
  return { search, container, wrapper };
}

describe("useSettingsSearch", () => {
  it("finds a setting by a word in its label, under its page", async () => {
    const { search } = await mountSearch();
    const groups = search.search("veto");
    const matchmaking = groups.find(
      (group) => group.path === "/settings/application/matchmaking",
    );
    expect(matchmaking?.hits.map((hit) => hit.label)).toContain(
      "Veto Pick Timer",
    );
  });

  it("narrows by page name", async () => {
    const { search } = await mountSearch();
    const groups = search.search("discord webhook");
    expect(groups.map((group) => group.path)).toEqual([
      "/settings/application/discord",
    ]);
    expect(groups[0].hits.length).toBeGreaterThan(0);
  });

  it("lists a page whose name matches even when none of its settings do", async () => {
    const { search } = await mountSearch();
    expect(search.search("map pools")).toContainEqual({
      path: "/settings/application/map-pools",
      label: "Map Pools",
      hits: [],
    });
  });

  it("returns nothing for nonsense", async () => {
    const { search } = await mountSearch();
    expect(search.search("qqzzxv")).toEqual([]);
  });

  it("waits for an opened setting to render, then scrolls to it and marks it", async () => {
    const { search, container, wrapper } = await mountSearch();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const pane = document.createElement("div");
    pane.dataset.settingsPane = "/settings/application/matchmaking";
    container.value!.append(pane);

    const hit = search
      .search("veto pick timer")
      .flatMap((group) => group.hits)[0];
    search.select(hit);
    await nextTick();
    expect(scrollIntoView).not.toHaveBeenCalled();

    // The page's data arrives and the field renders.
    pane.innerHTML = `
      <section id="matchmaking">
        <div class="row">
          <label>  ${hit.label}  </label>
          <p>${hit.description}</p>
        </div>
      </section>`;
    // happy-dom lays nothing out, so every element reads as hidden.
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    const row = pane.querySelector(".row")!;
    expect(scrollIntoView.mock.contexts[0]).toBe(row);
    expect(row.classList).toContain("settings-search-hit");
    expect(pane.querySelector("label")!.classList).toContain(
      "settings-search-hit-label",
    );
    wrapper.unmount();
  });
});
