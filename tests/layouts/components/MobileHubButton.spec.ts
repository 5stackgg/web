import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MobileHubButton from "~/layouts/components/MobileHubButton.vue";
import { useChatTabs } from "~/composables/useChatTabs";

const hub = vi.hoisted(() => ({
  notifications: 0,
  openLastOrDefaultHub: () => {},
}));

vi.mock("@/composables/useHubState", () => ({
  useHubState: () => ({
    openLastOrDefaultHub: () => hub.openLastOrDefaultHub(),
  }),
}));

vi.mock("~/composables/useNotificationBadge", async () => {
  const { computed } = await import("vue");
  return {
    useNotificationBadge: () => ({
      unreadNotificationCount: computed(() => hub.notifications),
    }),
  };
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useChatTabs().clearAll();
  hub.notifications = 0;
  hub.openLastOrDefaultHub = () => {};
});

async function mountButton() {
  const wrapper = await mountSuspended(MobileHubButton);
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function badge(wrapper: Awaited<ReturnType<typeof mountButton>>) {
  return wrapper.find("span.bg-red-500");
}

describe("MobileHubButton", () => {
  it("shows no badge when nothing is unread", async () => {
    const wrapper = await mountButton();

    expect(badge(wrapper).exists()).toBe(false);
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar",
    );
  });

  it("adds chat unread across tabs to unread notifications", async () => {
    const { setUnread } = useChatTabs();
    setUnread("lobby", 2);
    setUnread("direct:1", 3);
    hub.notifications = 4;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("9");
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar (9 unread)",
    );
  });

  it("counts chat alone when there are no notifications", async () => {
    useChatTabs().setUnread("lobby", 1);

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("1");
    expect(wrapper.find(".animate-ping").exists()).toBe(false);
  });

  it("pings while notifications are unread", async () => {
    hub.notifications = 1;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("1");
    expect(wrapper.find(".animate-ping").exists()).toBe(true);
  });

  it("pops the badge in when a message arrives", async () => {
    const wrapper = await mountButton();
    expect(badge(wrapper).exists()).toBe(false);

    useChatTabs().incrementUnread("lobby");
    await flushPromises();

    expect(badge(wrapper).text()).toBe("1");
  });

  it("caps the badge at 100+", async () => {
    useChatTabs().setUnread("lobby", 99);
    hub.notifications = 2;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("100+");
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar (100+ unread)",
    );
  });

  it("shows exactly 100 without the cap", async () => {
    useChatTabs().setUnread("lobby", 100);

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("100");
  });

  it("opens the hub on click", async () => {
    const open = vi.fn();
    hub.openLastOrDefaultHub = open;

    const wrapper = await mountButton();
    await wrapper.find("button").trigger("click");

    expect(open).toHaveBeenCalledTimes(1);
  });
});
