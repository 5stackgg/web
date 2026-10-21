import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { RouterLink } from "vue-router";
import { useRouter } from "#app";
import NewsPostPage from "~/pages/news/[slug].vue";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query: () => new Promise(() => {}) }),
}));

const cameFrom = (back: string | null) =>
  window.history.replaceState({ ...window.history.state, back }, "");

let unmount: (() => void) | undefined;

async function mountPost() {
  const wrapper = await mountSuspended(NewsPostPage, {
    route: "/news/autumn-cup",
    // The test runtime swaps in a RouterLink whose navigate does nothing.
    global: { components: { RouterLink } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("a News post's link back to News", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [
      { name: "public.news_enabled", value: "true" },
    ] as any;
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    cameFrom(null);
    vi.restoreAllMocks();
    useApplicationSettingsStore().settings = [];
  });

  it("steps back when the post was opened from the News list, so the list keeps its place", async () => {
    const wrapper = await mountPost();
    cameFrom("/news");
    const router = useRouter();
    const back = vi.spyOn(router, "back").mockImplementation(() => {});
    const push = vi
      .spyOn(router, "push")
      .mockImplementation(async () => undefined);

    await wrapper.get('a[href="/news"]').trigger("click");

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the News list when the post was opened from somewhere else", async () => {
    const wrapper = await mountPost();
    cameFrom("/notifications");
    const router = useRouter();
    const back = vi.spyOn(router, "back").mockImplementation(() => {});
    const push = vi
      .spyOn(router, "push")
      .mockImplementation(async () => undefined);

    await wrapper.get('a[href="/news"]').trigger("click");

    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/news");
  });
});
