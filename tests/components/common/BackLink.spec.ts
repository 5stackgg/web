import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { RouterLink } from "vue-router";
import { useRouter } from "#app";
import BackLink from "~/components/common/BackLink.vue";
import { Button } from "~/components/ui/button";

// The test runtime swaps in a RouterLink whose navigate does nothing.
const global = { components: { RouterLink } };

const cameFrom = (back: string | null) =>
  window.history.replaceState({ ...window.history.state, back }, "");

function spyRouter() {
  const router = useRouter();
  return {
    back: vi.spyOn(router, "back").mockImplementation(() => {}),
    push: vi.spyOn(router, "push").mockImplementation(async () => undefined),
  };
}

async function mountLink(to: string = "/news") {
  const wrapper = await mountSuspended(BackLink, {
    props: { to },
    slots: { default: () => "News" },
    global,
  });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  cameFrom(null);
  vi.restoreAllMocks();
});

describe("BackLink", () => {
  it("steps back when the list it names is the page before, whatever filters that list had", async () => {
    cameFrom("/news?tag=cup");
    const router = spyRouter();
    const wrapper = await mountLink();

    expect(wrapper.get("a").attributes("href")).toBe("/news");
    await wrapper.get("a").trigger("click");

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the list as a page when the viewer came from somewhere else", async () => {
    cameFrom("/notifications");
    const router = spyRouter();
    const wrapper = await mountLink();

    await wrapper.get("a").trigger("click");

    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/news");
  });

  it("opens the list when this was the first page of the visit", async () => {
    cameFrom(null);
    const router = spyRouter();
    const wrapper = await mountLink();

    await wrapper.get("a").trigger("click");

    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/news");
  });

  it.each(["ctrlKey", "metaKey", "shiftKey"])(
    "leaves a %s click to the browser, to open the list in a new tab",
    async (modifier) => {
      cameFrom("/news");
      const router = spyRouter();
      const wrapper = await mountLink();

      await wrapper.get("a").trigger("click", { [modifier]: true });

      expect(router.back).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it("follows a hash link back to its page", async () => {
    cameFrom("/faq#demo-match");
    const router = spyRouter();
    const wrapper = await mountLink("/faq#demo-match");

    await wrapper.get("a").trigger("click");

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("takes a button's look when a Button wraps it", async () => {
    cameFrom("/plugins");
    const router = spyRouter();
    const wrapper = await mountSuspended(
      defineComponent({
        render: () =>
          h(Button, { asChild: true, variant: "ghost", size: "sm" }, () =>
            h(BackLink, { to: "/plugins" }, () => "All plugins"),
          ),
      }),
      { global },
    );
    await flushPromises();

    const link = wrapper.get("a");
    expect(link.attributes("href")).toBe("/plugins");
    expect(link.classes()).toContain("inline-flex");

    await link.trigger("click");

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
