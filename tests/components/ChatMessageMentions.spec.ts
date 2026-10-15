import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { useChatReadState } from "~/composables/useChatReadState";
import { chatThreadKey } from "~/utilities/chatThread";

const ME = "76561198000000001";
const VEXX = "76561198000000002";
const MARLOWE = "76561198000000003";

const line = (message: string, mentions?: unknown) => ({
  id: "c1d2e3f4-0000-4000-8000-000000000001",
  message,
  source: "web",
  timestamp: new Date(Date.UTC(2026, 9, 14, 12, 0)).toISOString(),
  from: { steam_id: VEXX, name: "vexx" },
  ...(mentions ? { mentions } : {}),
});

const ROOM = { type: "tournament", id: "t-1" };

async function mount(message: ReturnType<typeof line>) {
  return await mountSuspended(ChatMessage, { props: { message, room: ROOM } });
}

beforeEach(async () => {
  useAuthStore().me = { steam_id: ME, name: "kappa", role: "user" } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        {
          thread: chatThreadKey(ROOM.type, ROOM.id),
          lastReadAt: new Date(Date.UTC(2026, 9, 14, 11, 0)).toISOString(),
        },
      ],
    }),
  );
  await useChatReadState().hydrate();
});

afterEach(() => {
  useAuthStore().me = undefined;
  vi.unstubAllGlobals();
});

describe("ChatMessage mentions", () => {
  it("draws someone else's tag as a chip and leaves the row alone", async () => {
    const wrapper = await mount(
      line("@marlowe can you send the server IP?", [
        { steam_id: MARLOWE, name: "marlowe" },
      ]),
    );

    const chip = wrapper.get("[data-chat-mention]");

    expect(chip.text()).toBe("@marlowe");
    expect(chip.attributes("data-chat-mention")).toBe("other");
    expect(wrapper.find("[data-chat-mentions-me]").exists()).toBe(false);
    expect(wrapper.text()).toContain("can you send the server IP?");
  });

  it("marks a tag of the viewer, and the whole line, more strongly", async () => {
    const wrapper = await mount(
      line("@kappa you're up next on Nuke", [{ steam_id: ME, name: "kappa" }]),
    );

    expect(wrapper.get("[data-chat-mention]").attributes("data-chat-mention")).toBe(
      "self",
    );
    expect(wrapper.find("[data-chat-mentions-me]").exists()).toBe(true);
  });

  it("keeps only the tag once the room has been seen with the line in it", async () => {
    const message = line("@kappa you're up next on Nuke", [
      { steam_id: ME, name: "kappa" },
    ]);
    useChatReadState().markSeen(
      ROOM.type,
      ROOM.id,
      new Date(message.timestamp).getTime(),
    );

    const wrapper = await mount(message);

    expect(wrapper.get("[data-chat-mention]").attributes("data-chat-mention")).toBe(
      "self",
    );
    expect(wrapper.find("[data-chat-mentions-me]").exists()).toBe(false);
  });

  it("leaves an @name the server did not accept as plain text", async () => {
    const wrapper = await mount(line("@zed hello"));

    expect(wrapper.find("[data-chat-mention]").exists()).toBe(false);
    expect(wrapper.text()).toContain("@zed hello");
  });
});
