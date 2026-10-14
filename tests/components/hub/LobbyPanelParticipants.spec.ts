import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import LobbyPanel from "~/components/hub/LobbyPanel.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { setActiveHub } from "~/composables/useHubState";
import { useRightSidebar } from "~/composables/useRightSidebar";

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({ playMatchFoundSound: vi.fn() }),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";

let unmount: (() => void) | undefined;

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  // happy-dom focuses any element; a browser ignores focus() on an element it
  // can't focus, which is where a popover with nothing tabbable leaves focus.
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (this.hasAttribute("tabindex") || this.matches("button, a, input")) {
      focus.call(this, options);
    }
  });

  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  useMatchmakingStore().lobbies = [
    {
      id: "lobby-1",
      players: [
        {
          captain: true,
          status: "Accepted",
          player: { steam_id: ME, name: "Me" },
        },
      ],
    },
  ] as any;
  useRightSidebar().setRightSidebarOpen(true);
  setActiveHub("lobby");
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useRightSidebar().setRightSidebarOpen(false);
  useMatchmakingStore().lobbies = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function openParticipants() {
  const wrapper = await mountSuspended(LobbyPanel, {
    attachTo: document.body,
    global: {
      stubs: { PartySeats: true, PartyQueueLine: true, LobbyInvites: true },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();

  const trigger = wrapper
    .findAll("button")
    .find((button) => button.text().endsWith("in chat"))!
    .element as HTMLElement;
  trigger.click();
  await flushPromises();
  expect(popup()).not.toBeNull();
  return trigger;
}

const popup = () => document.body.querySelector<HTMLElement>("[role='dialog']");

describe("LobbyPanel participants popover", () => {
  it("closes when the hub switches to another app", async () => {
    const trigger = await openParticipants();

    setActiveHub("voice");
    await flushPromises();

    expect(popup()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when the hub closes", async () => {
    const trigger = await openParticipants();

    useRightSidebar().setRightSidebarOpen(false);
    await flushPromises();

    expect(popup()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
