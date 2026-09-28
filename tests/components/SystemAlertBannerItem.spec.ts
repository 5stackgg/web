import { afterEach, describe, expect, it } from "vitest";
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

  it("leaves live links focusable", async () => {
    const wrapper = await mountBanner("[a](/tournaments)");

    const link = wrapper.find("a");
    expect(link.attributes("tabindex")).toBeUndefined();
    expect(link.classes()).not.toContain("pointer-events-none");
  });
});
