import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatGifPickerPanel from "~/components/chat/ChatGifPickerPanel.vue";

const { apiSearch } = vi.hoisted(() => ({
  apiSearch: vi.fn(async () => ({
    results: [{ id: "fromapi1", title: "", width: 480, height: 270 }],
    next: null,
  })),
}));

vi.mock("~/composables/chatGifSearch", () => ({
  searchChatGifs: apiSearch,
}));

const gif = (id: string) => ({ id, title: `${id} title`, width: 480, height: 270 });

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const tiles = (wrapper: Wrapper) => wrapper.findAll("[data-gif-id]");

describe("ChatGifPickerPanel", () => {
  let search: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    search = vi.fn(async (query: string, offset: number) => ({
      results: query
        ? [gif(`${query}${offset}`)]
        : offset === 0
          ? [gif("trending1"), gif("trending2")]
          : [gif(`trending${offset}`)],
      next: offset === 0 ? 24 : null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const mount = () =>
    mountSuspended(ChatGifPickerPanel, { props: { search } });

  it("opens on what is trending", async () => {
    const wrapper = await mount();
    await flushPromises();

    expect(search).toHaveBeenCalledWith("", 0);
    expect(tiles(wrapper).map((tile) => tile.attributes("data-gif-id"))).toEqual(
      ["trending1", "trending2"],
    );
  });

  // What the composer actually mounts: no search handed in.
  it("searches through the API when no search is handed in", async () => {
    const wrapper = await mountSuspended(ChatGifPickerPanel);
    await flushPromises();

    expect(apiSearch).toHaveBeenCalledWith("", 0);
    expect(
      tiles(wrapper).map((tile) => tile.attributes("data-gif-id")),
    ).toEqual(["fromapi1"]);
  });

  it("loads GIFs from GIPHY by id, never through a url it was handed", async () => {
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.find("img").attributes("src")).toBe(
      "https://i.giphy.com/media/trending1/200w.webp",
    );
  });

  it("credits GIPHY", async () => {
    const wrapper = await mount();

    expect(wrapper.text()).toContain("Powered by GIPHY");
  });

  it("searches once typing stops", async () => {
    vi.useFakeTimers();
    const wrapper = await mount();
    await flushPromises();

    await wrapper.get("input").setValue("cl");
    await wrapper.get("input").setValue("clutch");
    vi.advanceTimersByTime(400);
    await flushPromises();

    expect(search.mock.calls.map(([query]) => query)).toEqual(["", "clutch"]);
    expect(tiles(wrapper).map((tile) => tile.attributes("data-gif-id"))).toEqual(
      ["clutch0"],
    );
  });

  it("searches a suggestion straight away", async () => {
    const wrapper = await mount();
    await flushPromises();

    await wrapper.get("[data-gif-suggestion='gg']").trigger("click");
    await flushPromises();

    expect(search).toHaveBeenLastCalledWith("gg", 0);
  });

  it("sends the GIF that was clicked", async () => {
    const wrapper = await mount();
    await flushPromises();

    await tiles(wrapper)[1].trigger("click");

    expect(wrapper.emitted("select")).toEqual([
      [{ id: "trending2", width: 480, height: 270 }],
    ]);
  });

  it("loads the next page at the bottom, and stops at the end", async () => {
    const wrapper = await mount();
    await flushPromises();

    await wrapper.get("[data-gif-scroll]").trigger("scroll");
    await flushPromises();
    await wrapper.get("[data-gif-scroll]").trigger("scroll");
    await flushPromises();

    expect(search.mock.calls).toEqual([
      ["", 0],
      ["", 24],
    ]);
    expect(tiles(wrapper)).toHaveLength(3);
  });

  it("says when nothing matched", async () => {
    search.mockResolvedValue({ results: [], next: null });
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.text()).toContain("No GIFs found");
  });

  it("says when searching too fast", async () => {
    search.mockResolvedValue("rate_limited");
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.text()).toContain("Too many searches");
  });

  it("says GIFs are busy when the panel's allowance is spent", async () => {
    search.mockResolvedValue("busy");
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.text()).toContain("GIFs are busy, try again soon");
  });

  // CSS columns rebalance the whole grid each time it grows, so a GIF under
  // the pointer could jump to the other column as the next page loaded.
  it("keeps every GIF in its column as more load, filling the shorter one", async () => {
    const sized = (id: string, width: number, height: number) => ({
      id,
      title: id,
      width,
      height,
    });
    search.mockImplementation(async (_query: string, offset: number) =>
      offset === 0
        ? {
            results: [sized("wide1", 480, 270), sized("square1", 480, 480)],
            next: 2,
          }
        : { results: [sized("wide2", 480, 270)], next: null },
    );
    const wrapper = await mount();
    await flushPromises();

    const columns = () =>
      wrapper
        .findAll("[data-gif-column]")
        .map((column) =>
          column.findAll("[data-gif-id]").map((tile) => tile.attributes("data-gif-id")),
        );

    expect(columns()).toEqual([["wide1"], ["square1"]]);

    await wrapper.get("[data-gif-scroll]").trigger("scroll");
    await flushPromises();

    expect(columns()).toEqual([["wide1", "wide2"], ["square1"]]);
  });

  it("shows still frames to anyone who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.find("img").attributes("src")).toBe(
      "https://i.giphy.com/media/trending1/200w_s.gif",
    );
  });

  it("says when GIPHY cannot be reached", async () => {
    search.mockResolvedValue("unavailable");
    const wrapper = await mount();
    await flushPromises();

    expect(wrapper.text()).toContain("GIPHY is unavailable");
  });
});
