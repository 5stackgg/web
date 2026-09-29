import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";

const DANA = "76561198000000002";
const EVAN = "76561198000000003";

vi.mock("~/composables/usePlayerBlocks", () => ({
  usePlayerBlocks: () => ({
    isBlocked: (steamId?: string | number | null) => String(steamId) === DANA,
  }),
}));

const line = (steamId: string) => ({
  id: `from-${steamId}`,
  message: "hello",
  source: "web",
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, 0)).toISOString(),
  from: { steam_id: steamId, name: `Player ${steamId}` },
});

const tag = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper.findAll("span").filter((span) => span.text() === "Blocked");

describe("ChatMessage blocked tag", () => {
  it("marks a line from a player the viewer blocked", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: line(DANA) },
    });

    expect(tag(wrapper)).toHaveLength(1);
  });

  it("leaves everyone else's lines alone", async () => {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: line(EVAN) },
    });

    expect(tag(wrapper)).toHaveLength(0);
  });
});
