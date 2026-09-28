import { describe, expect, it } from "vitest";
import { chatErrorDescription } from "~/utilities/chatErrors";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

describe("chatErrorDescription", () => {
  it("says how long a message can be", () => {
    expect(chatErrorDescription({ code: "too_long", max: 1500 }, t)).toBe(
      'chat.message_too_long {"max":1500}',
    );
  });

  it("falls back to the local limit when the api sends no max", () => {
    expect(chatErrorDescription({ code: "too_long" }, t)).toBe(
      `chat.message_too_long {"max":${CHAT_MESSAGE_MAX_LENGTH}}`,
    );
  });

  it("adds nothing to the failed-send title for a refused send", () => {
    // not_allowed can be a send queued offline that beat its lobby rejoin
    expect(chatErrorDescription({ code: "not_allowed" }, t)).toBeUndefined();
  });

  it.each(["invalid", "some_future_code", ""])(
    "treats %j as a plain failed send",
    (code) => {
      expect(chatErrorDescription({ code }, t)).toBeUndefined();
    },
  );

  it("survives a payload with no code", () => {
    expect(chatErrorDescription(undefined as any, t)).toBeUndefined();
  });
});
