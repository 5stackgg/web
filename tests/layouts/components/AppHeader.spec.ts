import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppHeader from "~/layouts/components/AppHeader.vue";
import { emulateDevice, userAgents } from "../../helpers/pwaDevice";

const stubs = {
  BreadCrumbs: true,
  UtilityPracticeNav: true,
  DraftRoomNav: true,
  MatchLobbies: true,
  SystemUpdate: true,
  SystemStatus: true,
  MobileHubButton: true,
};

const cameFrom = (back: string | null) =>
  window.history.replaceState({ ...window.history.state, back }, "");

let unmount: (() => void) | undefined;

async function mountHeader() {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(AppHeader)),
    }),
    { global: { stubs } },
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const arrow = (wrapper: Awaited<ReturnType<typeof mountHeader>>) =>
  wrapper.find('button[aria-label="Back"]');

afterEach(() => {
  unmount?.();
  unmount = undefined;
  cameFrom(null);
  vi.restoreAllMocks();
});

describe("AppHeader back arrow", () => {
  it("puts the Back arrow after the sidebar button on a phone, and it steps back", async () => {
    emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
    cameFrom("/leaderboard");

    const wrapper = await mountHeader();
    const back = arrow(wrapper);

    expect(back.exists()).toBe(true);
    expect(
      back.element.compareDocumentPosition(
        wrapper.get('[data-sidebar="trigger"]').element,
      ) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();

    const step = vi.spyOn(useRouter(), "back").mockImplementation(() => {});
    await back.trigger("click");

    expect(step).toHaveBeenCalledTimes(1);
  });

  it("has no Back arrow on the first page of a visit", async () => {
    emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
    cameFrom(null);

    const wrapper = await mountHeader();

    expect(arrow(wrapper).exists()).toBe(false);
  });

  it("leaves the desktop header as it is", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
    cameFrom("/leaderboard");

    const wrapper = await mountHeader();

    expect(arrow(wrapper).exists()).toBe(false);
  });
});
