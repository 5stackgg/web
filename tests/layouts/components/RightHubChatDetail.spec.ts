import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import RightHub from "~/layouts/components/RightHub.vue";
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

const ME = "76561198000000001";

let unmount: (() => void) | undefined;

async function mountHub() {
  const wrapper = await mountSuspended(RightHub, {
    global: {
      stubs: {
        SocialPanel: true,
        RecentGamesPanel: true,
        SidebarChatTab: true,
        ChatPanel: true,
        NotificationsPanel: true,
        LobbyPanel: true,
        VoicePanel: true,
        HubVoiceBar: true,
        MiniDisplay: true,
      },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

// The Chat icon's own button: its accessible name is its label and detail.
const chatIcon = (wrapper: Awaited<ReturnType<typeof mountHub>>) =>
  wrapper
    .findAll("button")
    .find((button) => button.attributes("aria-label")?.startsWith("Chat"));

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

describe("RightHub's Chat icon", () => {
  it("describes what its count shows for a match room set to nothing", async () => {
    useChatTabs().openTab({
      id: "match:m-1",
      label: "A vs B",
      instance: "match",
      type: "match",
      lobbyId: "m-1",
      activate: false,
    });
    useChatTabs().incrementMention("match:m-1", "tag-1");
    useChatTabs().incrementMention("match:m-1", "tag-2");
    fake.api.rooms([room("chat:match:m-1", { notify: "nothing" })]);

    const wrapper = await mountHub();
    const icon = chatIcon(wrapper);

    expect(icon?.attributes("aria-label")).toBe("Chat, 2 unread");
    expect(wrapper.find("[data-hub-dock-badge]").text()).toBe("2");
  });

  it("says nothing new once every room with something waiting is muted", async () => {
    useChatTabs().openTab({
      id: "matchmaking:l-1",
      label: "Lobby",
      instance: "matchmaking",
      type: "matchmaking",
      lobbyId: "l-1",
      activate: false,
    });
    useChatTabs().setUnread("matchmaking:l-1", 3);
    fake.api.rooms([room("chat:matchmaking:l-1", { muted: true })]);

    const wrapper = await mountHub();

    expect(chatIcon(wrapper)?.attributes("aria-label")).toBe(
      "Chat, Nothing new",
    );
  });
});
