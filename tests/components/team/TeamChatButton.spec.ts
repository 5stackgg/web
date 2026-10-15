import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamChatButton from "~/components/team/TeamChatButton.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { currentHub, setActiveHub } from "~/composables/useHubState";

const ME = "76561198000000001";
const NORTHWIND = {
  id: "6f1c1c1e-5b1a-4c55-9a51-111111111111",
  name: "Northwind",
  short_name: "NW",
  avatar_url: null,
};
const TAB = `team:${NORTHWIND.id}`;

let unmount: (() => void) | undefined;

function signIn(teams: unknown[]) {
  useAuthStore().me = { steam_id: ME, role: "administrator", teams } as any;
}

async function mountButton() {
  const wrapper = await mountSuspended(TeamChatButton, {
    props: { team: NORTHWIND },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  useChatTabs().clearAll();
  setActiveHub("lobby");
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useRightSidebar().setRightSidebarOpen(false);
  useChatTabs().clearAll();
});

describe("TeamChatButton", () => {
  it("is offered only to the team's roster and owner, never to staff off it", async () => {
    signIn([]);
    let wrapper = await mountButton();
    expect(wrapper.find("button").exists()).toBe(false);
    unmount?.();

    signIn([{ ...NORTHWIND, role: "Member" }]);
    wrapper = await mountButton();
    expect(wrapper.get("button").text()).toContain("Team Chat");
  });

  it("opens the hub on the team's room", async () => {
    signIn([{ ...NORTHWIND, role: "Member" }]);
    const wrapper = await mountButton();

    await wrapper.get("button").trigger("click");

    expect(useChatTabs().activeTabId.value).toBe(TAB);
    expect(useChatTabs().tabs.value.find(({ id }) => id === TAB)?.label).toBe(
      "Northwind",
    );
    expect(useRightSidebar().rightSidebarOpen.value).toBe(true);
    expect(currentHub()).toBe("chat");
  });

  it("badges chatter white, and a tag red", async () => {
    signIn([{ ...NORTHWIND, role: "Member" }]);
    const chat = useChatTabs();
    chat.openTab({
      id: TAB,
      label: "Northwind",
      instance: "team",
      type: "team",
      lobbyId: NORTHWIND.id,
      activate: false,
    });
    chat.setUnread(TAB, 4);
    const wrapper = await mountButton();

    let badge = wrapper.get("[data-chat-room-badge]");
    expect(badge.attributes("data-tone")).toBe("fresh");
    expect(badge.text()).toBe("4");

    chat.incrementMention(TAB, "line-1");
    await flushPromises();

    badge = wrapper.get("[data-chat-room-badge]");
    expect(badge.attributes("data-tone")).toBe("red");
    expect(badge.text()).toBe("1");
  });
});
