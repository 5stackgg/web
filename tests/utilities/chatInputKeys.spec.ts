import { describe, expect, it } from "vitest";
import { chatEnterAction } from "~/utilities/chatInputKeys";

const key = (overrides: Partial<KeyboardEvent> = {}) =>
  ({
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  }) as KeyboardEvent;

describe("chatEnterAction", () => {
  it("sends on a bare enter", () => {
    expect(chatEnterAction(key())).toBe("send");
  });

  it("makes a new line on shift+enter", () => {
    expect(chatEnterAction(key({ shiftKey: true }))).toBe("newline");
  });

  it("sends to the other channel on ctrl or cmd enter", () => {
    expect(chatEnterAction(key({ ctrlKey: true }))).toBe("send-other");
    expect(chatEnterAction(key({ metaKey: true }))).toBe("send-other");
  });

  it("leaves an in-progress IME composition alone", () => {
    // enter confirms the candidate in a Japanese or Korean IME; sending there
    // would cut the word off mid-composition
    expect(chatEnterAction(key({ isComposing: true }))).toBe("newline");
  });

  it("prefers the other channel over a new line when both modifiers are held", () => {
    expect(chatEnterAction(key({ shiftKey: true, ctrlKey: true }))).toBe(
      "send-other",
    );
  });
});
