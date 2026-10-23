import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MainContent from "~/layouts/components/MainContent.vue";
import SystemAlertBanner from "~/components/SystemAlertBanner.vue";

const observers: Array<{ resize: () => void; targets: Array<Element> }> = [];
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const alertsHeight = () =>
  document.documentElement.style.getPropertyValue("--system-alerts-height");

async function mountContent() {
  wrapper = await mountSuspended(MainContent);
  await flushPromises();
  return wrapper;
}

const resizeBanners = (height: number) => {
  const banner = wrapper!.findComponent(SystemAlertBanner).element;
  const banners = banner.parentElement as HTMLElement;
  Object.defineProperty(banners, "offsetHeight", {
    configurable: true,
    value: height,
  });
  for (const observer of observers) {
    if (observer.targets.includes(banners)) {
      observer.resize();
    }
  }
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets: Array<Element> = [];
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          resize: () => callback([], this as unknown as ResizeObserver),
          targets: this.targets,
        });
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  observers.length = 0;
  vi.unstubAllGlobals();
});

describe("MainContent system alert banners", () => {
  it("leaves no room for them while none show", async () => {
    await mountContent();

    expect(alertsHeight()).toBe("0px");
  });

  it("publishes their height, and follows it as they come and go", async () => {
    await mountContent();

    resizeBanners(52);
    expect(alertsHeight()).toBe("52px");

    resizeBanners(0);
    expect(alertsHeight()).toBe("0px");
  });

  it("takes the height away once it unmounts", async () => {
    await mountContent();
    resizeBanners(52);

    wrapper!.unmount();
    wrapper = undefined;

    expect(alertsHeight()).toBe("");
  });
});
