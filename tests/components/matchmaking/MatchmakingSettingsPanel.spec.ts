import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchmakingSettingsPanel from "~/components/matchmaking/MatchmakingSettingsPanel.vue";

function screen({ phone }: { phone: boolean }) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

async function mountPanel(open: boolean) {
  const wrapper = await mountSuspended(MatchmakingSettingsPanel, {
    props: { open },
    slots: { trigger: '<button type="button">Settings</button>' },
    global: {
      stubs: { MatchmakingSettings: { template: "<div>settings body</div>" } },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("MatchmakingSettingsPanel", () => {
  it("opens as a drawer you can swipe down on a phone", async () => {
    screen({ phone: true });
    const wrapper = await mountPanel(true);

    expect(document.querySelector("[data-vaul-drawer]")).not.toBeNull();
    expect(document.body.textContent).toContain("settings body");
    wrapper.unmount();
  });

  it("opens as a popover on desktop", async () => {
    screen({ phone: false });
    const wrapper = await mountPanel(false);
    await wrapper.find("button").trigger("click");
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(document.querySelector("[data-vaul-drawer]")).toBeNull();
    expect(document.body.textContent).toContain("settings body");
    wrapper.unmount();
  });
});
