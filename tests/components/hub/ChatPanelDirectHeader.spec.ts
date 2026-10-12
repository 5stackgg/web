import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPanel from "~/components/hub/ChatPanel.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { directTabId } from "~/composables/useDirectMessages";
import { useRightSidebar } from "~/composables/useRightSidebar";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    hidesAuthor: () => false,
    markLobbyRead() {},
    lobbyMessages: () => [],
  },
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";
const ROOM = `${ME}:${FRIEND}`;
const AVATAR = "https://avatars.test/dana.jpg";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;

function onPhone(phone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: phone,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })),
  );
}

function openDirect(extra: Record<string, unknown> = {}) {
  useChatTabs().openTab({
    id: directTabId(ROOM),
    label: "Dana",
    instance: "direct",
    type: "direct",
    lobbyId: ROOM,
    avatarUrl: AVATAR,
    steamId: FRIEND,
    ...extra,
  } as any);
}

// The test environment's RouterLink only prevents the click's default, the
// way the real one does right before it navigates.
async function press(link: ReturnType<typeof profileLinks>[number]) {
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  const click = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  link.element.dispatchEvent(down);
  link.element.dispatchEvent(click);
  await flushPromises();
  return { down, click };
}

async function mountPanel() {
  wrapper = await mountSuspended(ChatPanel, {
    props: { isSidebarOpen: true, isTabActive: true },
    global: { stubs: { ChatLobby: true, ChatParticipants: true } },
  });
  await flushPromises();
  return wrapper;
}

const profileLinks = () =>
  wrapper!.findAll(`a[href="/players/${FRIEND}"]`);

beforeEach(() => {
  onPhone(false);
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: ME } as any;
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ conversations: [] }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  useRightSidebar().setRightSidebarOpen(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatPanel direct message header", () => {
  it("shows the other player's avatar and name, both linking to their profile", async () => {
    openDirect();
    await mountPanel();

    const links = profileLinks();
    expect(links).toHaveLength(2);
    expect(links[0].find("img").attributes("src")).toBe(AVATAR);
    expect(links[1].text()).toBe("Dana");
  });

  it("keeps the avatar out of the tab order, so the player is one stop", async () => {
    openDirect();
    await mountPanel();

    const [avatar, name] = profileLinks();
    expect(avatar.attributes("tabindex")).toBe("-1");
    expect(avatar.attributes("aria-hidden")).toBe("true");
    expect(name.attributes("tabindex")).toBeUndefined();
  });

  it("still shows the initials when the player has no avatar", async () => {
    openDirect({ avatarUrl: undefined });
    await mountPanel();

    expect(profileLinks()[0].text()).toBe("DA");
  });

  it("finds the player from the room when the tab never learned their id", async () => {
    openDirect({ steamId: undefined });
    await mountPanel();

    expect(profileLinks()).toHaveLength(2);
  });

  it("keeps group rooms' plain titles", async () => {
    useChatTabs().openTab({
      id: "matchmaking:lobby-1",
      label: "Lobby",
      instance: "matchmaking",
      type: "matchmaking",
      lobbyId: "lobby-1",
      pinned: true,
    } as any);
    await mountPanel();

    expect(wrapper!.findAll('a[href^="/players/"]')).toHaveLength(0);
    expect(wrapper!.text()).toContain("Lobby");
  });

  it("lets the link have the press instead of the header keeping it for the composer", async () => {
    openDirect();
    await mountPanel();

    const { down, click } = await press(profileLinks()[1]);

    expect(down.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(true);
  });

  it("closes the hub first on a phone, where it covers the page", async () => {
    onPhone(true);
    openDirect();
    useRightSidebar().setRightSidebarOpen(true);
    await mountPanel();

    const { click } = await press(profileLinks()[1]);

    expect(useRightSidebar().rightSidebarOpen.value).toBe(false);
    expect(click.defaultPrevented).toBe(true);
  });

  it("leaves the hub open on a desktop", async () => {
    openDirect();
    useRightSidebar().setRightSidebarOpen(true);
    await mountPanel();

    await press(profileLinks()[0]);

    expect(useRightSidebar().rightSidebarOpen.value).toBe(true);
  });
});
