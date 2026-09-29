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

  it("folds under an older line that stored the sender id as a number", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: {
        previousMessage: {
          ...line("76561198000000000", 0, "first"),
          from: {
            steam_id: 76561198000000000,
            name: "Player 76561198000000000",
          },
        },
        message: line("76561198000000000", 1, "second"),
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
