import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MobileHubButton from "~/layouts/components/MobileHubButton.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import {
  resetChatRoomSettings,
  syncChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import { fakeRoomSettingsClient, room } from "../../helpers/fakeRoomSettings";

const fake = vi.hoisted(() => ({ api: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => fake.api.client,
}));

vi.mock("@/composables/useHubState", () => ({
  useHubState: () => ({ openLastOrDefaultHub: () => {} }),
}));

vi.mock("~/composables/useNotificationBadge", async () => {
  const { computed } = await import("vue");
  return {
    useNotificationBadge: () => ({
      unreadNotificationCount: computed(() => 0),
    }),
  };
});

const ME = "76561198000000001";

let unmount: (() => void) | undefined;

function openRoom(id: string, type: "matchmaking" | "direct", lobbyId: string) {
  useChatTabs().openTab({
    id,
    label: id,
    instance: type,
    type,
    lobbyId,
    activate: false,
  });
}

async function mountButton() {
  const wrapper = await mountSuspended(MobileHubButton);
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  fake.api = fakeRoomSettingsClient();
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  await syncChatRoomSettings(ME);
  await flushPromises();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  resetChatRoomSettings();
  useChatTabs().clearAll();
  useAuthStore().me = undefined;
});

describe("MobileHubButton with rooms the player muted", () => {
  it("leaves a muted conversation and a muted room out of the count", async () => {
    openRoom("direct:a", "direct", "1:2");
    openRoom("lobby", "matchmaking", "lobby-1");
    useChatTabs().setUnread("direct:a", 3);
    useChatTabs().setUnread("lobby", 2);
    fake.api.rooms([
      room("chat:direct:1:2", { muted: true }),
      room("chat:matchmaking:lobby-1", { muted: true }),
    ]);

    const wrapper = await mountButton();

    expect(wrapper.find("span.bg-red-500").exists()).toBe(false);
    expect(wrapper.find("span.bg-zinc-50").exists()).toBe(false);
  });

  it("still counts a tag that broke through a mute in red", async () => {
    openRoom("lobby", "matchmaking", "lobby-1");
    useChatTabs().setUnread("lobby", 2);
    useChatTabs().incrementMention("lobby", "tagged");
    fake.api.rooms([room("chat:matchmaking:lobby-1", { muted: true })]);

    const wrapper = await mountButton();

    expect(wrapper.find("span.bg-red-500").text()).toBe("1");
  });
});
