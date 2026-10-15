import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatReadState } from "~/composables/useChatReadState";
import { chatThreadKey } from "~/utilities/chatThread";

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 15, 12, minute)).toISOString();

async function hydrateWith(lastReadAt: string) {
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [{ thread: chatThreadKey("tournament", "t-1"), lastReadAt }],
    }),
  );
  await useChatReadState().hydrate();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatReadState seen", () => {
  it("lights nothing until the server has said where each room was left", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await useChatReadState().hydrate();

    expect(useChatReadState().isUnseen("tournament", "t-1", at(5))).toBe(
      false,
    );
  });

  it("counts a line past where the room was left as unseen", async () => {
    await hydrateWith(at(2));
    const { isUnseen } = useChatReadState();

    expect(isUnseen("tournament", "t-1", at(1))).toBe(false);
    expect(isUnseen("tournament", "t-1", at(3))).toBe(true);
    expect(isUnseen("tournament", "never-opened", at(1))).toBe(true);
  });

  it("holds still while the room is read, and moves on only when it is left", async () => {
    await hydrateWith(at(2));
    const { isUnseen, markRead, markSeen } = useChatReadState();

    markRead("tournament", "t-1");
    expect(isUnseen("tournament", "t-1", at(3))).toBe(true);

    markSeen("tournament", "t-1", new Date(at(3)).getTime());
    expect(isUnseen("tournament", "t-1", at(3))).toBe(false);
    expect(isUnseen("tournament", "t-1", at(4))).toBe(true);

    markSeen("tournament", "t-1", new Date(at(1)).getTime());
    expect(isUnseen("tournament", "t-1", at(3))).toBe(false);
  });
});
