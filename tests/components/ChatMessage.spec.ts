import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";

const line = (steamId: string, minute: number, message: string) => ({
  id: message,
  message,
  source: "web",
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString(),
  from: { steam_id: steamId, name: `Player ${steamId}` },
});

describe("ChatMessage grouping", () => {
  it("folds a second line from the same sender under the first", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: {
        previousMessage: line("76561198000000001", 0, "first"),
        message: line("76561198000000001", 1, "second"),
      },
    });

    expect(wrapper.find("h4").exists()).toBe(false);
    expect(wrapper.text()).toContain("second");
  });

  it("names the sender when someone else spoke last", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: {
        previousMessage: line("76561198000000002", 0, "first"),
        message: line("76561198000000001", 1, "second"),
      },
    });

    expect(wrapper.get("h4").text()).toBe("Player 76561198000000001");
  });
});
