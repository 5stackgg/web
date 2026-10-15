import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MobileHubButton from "~/layouts/components/MobileHubButton.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

// Reactive so a notification can arrive after mount.
const hub = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return reactive({
    notifications: 0,
    openLastOrDefaultHub: () => {},
  });
});

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

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";

const pendingFriend = (steamId: string, invitedBy: string) => ({
  steam_id: steamId,
  name: steamId,
  status: "Pending",
  invited_by_steam_id: invitedBy,
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useChatTabs().clearAll();
  useMatchmakingStore().friends = [] as any;
  useAuthStore().me = undefined;
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

function freshBadge(wrapper: Awaited<ReturnType<typeof mountButton>>) {
  return wrapper.find("span.bg-zinc-50");
}

function openRoom(id: string, type: "matchmaking" | "match" | "direct") {
  useChatTabs().openTab({
    id,
    label: id,
    instance: type,
    type,
    lobbyId: id,
    activate: false,
  });
}

function ring(wrapper: Awaited<ReturnType<typeof mountButton>>) {
  return wrapper.find("span.bg-red-400");
}

describe("MobileHubButton", () => {
  it("shows no badge when nothing is unread", async () => {
    const wrapper = await mountButton();

    expect(badge(wrapper).exists()).toBe(false);
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar",
    );
  });

  it("counts notifications and direct messages in red, leaving room chatter out", async () => {
    openRoom("lobby", "matchmaking");
    openRoom("direct:1", "direct");
    const { setUnread } = useChatTabs();
    setUnread("lobby", 2);
    setUnread("direct:1", 3);
    hub.notifications = 4;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("7");
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar (7 unread)",
    );
  });

  it("shows room chatter alone in white", async () => {
    openRoom("lobby", "matchmaking");
    useChatTabs().setUnread("lobby", 1);

    const wrapper = await mountButton();

    expect(badge(wrapper).exists()).toBe(false);
    expect(freshBadge(wrapper).text()).toBe("1");
    expect(ring(wrapper).exists()).toBe(false);
  });

  it("turns red for a tag, even in a match room whose chatter is never counted", async () => {
    openRoom("lobby", "matchmaking");
    openRoom("match:1", "match");
    useChatTabs().setUnread("lobby", 3);
    useChatTabs().incrementMention("match:1", "tagged");

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("1");
    expect(freshBadge(wrapper).exists()).toBe(false);
  });

  it("sits still on notifications that were already unread", async () => {
    hub.notifications = 1;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("1");
    expect(ring(wrapper).exists()).toBe(false);
  });

  it("rings once when a notification arrives", async () => {
    const wrapper = await mountButton();

    hub.notifications = 1;
    await flushPromises();

    expect(badge(wrapper).text()).toBe("1");
    expect(ring(wrapper).exists()).toBe(true);

    await ring(wrapper).trigger("animationend");

    expect(ring(wrapper).exists()).toBe(false);
  });

  it("pops the badge in when a message arrives", async () => {
    openRoom("lobby", "matchmaking");
    const wrapper = await mountButton();
    expect(freshBadge(wrapper).exists()).toBe(false);

    useChatTabs().incrementUnread("lobby");
    await flushPromises();

    expect(freshBadge(wrapper).text()).toBe("1");
  });

  it("caps the badge at 100+", async () => {
    openRoom("direct:1", "direct");
    useChatTabs().setUnread("direct:1", 99);
    hub.notifications = 2;

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("100+");
    expect(wrapper.find("button").attributes("aria-label")).toBe(
      "Toggle Right Sidebar (100+ unread)",
    );
  });

  it("shows exactly 100 without the cap", async () => {
    openRoom("lobby", "matchmaking");
    useChatTabs().setUnread("lobby", 100);

    const wrapper = await mountButton();

    expect(freshBadge(wrapper).text()).toBe("100");
  });

  it("opens the hub on click", async () => {
    const open = vi.fn();
    hub.openLastOrDefaultHub = open;

    const wrapper = await mountButton();
    await wrapper.find("button").trigger("click");

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("counts friend requests waiting on the player, as the hub's social icon does", async () => {
    useAuthStore().me = { steam_id: ME } as any;
    useMatchmakingStore().friends = [
      pendingFriend(DANA, DANA),
      pendingFriend(EVAN, ME),
    ] as any;
    openRoom("lobby", "matchmaking");
    useChatTabs().setUnread("lobby", 1);

    const wrapper = await mountButton();

    expect(badge(wrapper).text()).toBe("1");
    expect(ring(wrapper).exists()).toBe(false);
  });
});
