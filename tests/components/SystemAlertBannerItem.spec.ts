import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SystemAlertBannerItem from "~/components/SystemAlertBannerItem.vue";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountBanner(message: string, preview = false) {
  const wrapper = await mountSuspended(SystemAlertBannerItem, {
    props: { type: "info", message, preview },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("SystemAlertBannerItem message links", () => {
  it("renders own-site links in the app and others in a new tab", async () => {
    const wrapper = await mountBanner(
      `Join [the cup](/tournaments/abc) or read https://example.com/rules. Also https://${window.location.host}/play`,
    );

    const links = wrapper.findAll("a");
    expect(links).toHaveLength(3);

    expect(wrapper.findAllComponents({ name: "NuxtLink" })).toHaveLength(2);

    expect(links[0].text()).toBe("the cup");
    expect(links[0].attributes("href")).toBe("/tournaments/abc");
    expect(links[0].attributes("target")).toBeUndefined();

    expect(links[1].text()).toBe("https://example.com/rules");
    expect(links[1].attributes("href")).toBe("https://example.com/rules");
    expect(links[1].attributes("target")).toBe("_blank");
    expect(links[1].attributes("rel")).toBe("noopener noreferrer");

    expect(links[2].attributes("href")).toBe("/play");
    expect(links[2].attributes("target")).toBeUndefined();

    expect(wrapper.find("p").text()).toBe(
      `Join the cup or read https://example.com/rules. Also https://${window.location.host}/play`,
    );
  });

  it("loads api-served paths on this site with a real page load", async () => {
    const wrapper = await mountBanner(
      `[Discord](/discord-invite) or https://${window.location.host}/auth/steam`,
    );

    const links = wrapper.findAll("a");
    expect(links).toHaveLength(2);
    expect(wrapper.findAllComponents({ name: "NuxtLink" })).toHaveLength(0);
    for (const link of links) {
      expect(link.attributes("target")).toBeUndefined();
    }
    expect(links[0].attributes("href")).toBe("/discord-invite");
    expect(links[1].attributes("href")).toBe("/auth/steam");
  });

  it("never renders the message as html", async () => {
    const message =
      '<img src=x onerror="alert(1)"> [x](javascript:alert(1))';
    const wrapper = await mountBanner(message);

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.find("p").text()).toBe(message);
  });

  it("keeps preview links out of reach", async () => {
    const wrapper = await mountBanner(
      "[a](/tournaments) [b](https://example.com)",
      true,
    );

    const links = wrapper.findAll("a");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.attributes("tabindex")).toBe("-1");
      expect(link.classes()).toContain("pointer-events-none");
    }
  });

  it("does not follow a preview link a screen reader clicks", async () => {
    const before = useRouter().currentRoute.value.fullPath;
    const wrapper = await mountBanner(
      "[a](/tournaments) [b](/discord-invite) [c](https://example.com)",
      true,
    );

    for (const link of wrapper.findAll("a")) {
      expect(link.attributes("aria-disabled")).toBe("true");
      const click = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      link.element.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
    }
    await flushPromises();

    expect(useRouter().currentRoute.value.fullPath).toBe(before);
  });

  it("leaves live links focusable", async () => {
    const wrapper = await mountBanner("[a](/tournaments)");

    const link = wrapper.find("a");
    expect(link.attributes("tabindex")).toBeUndefined();
    expect(link.classes()).not.toContain("pointer-events-none");
  });
});
