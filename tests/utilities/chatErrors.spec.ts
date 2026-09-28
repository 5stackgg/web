import { describe, expect, it } from "vitest";
import { chatErrorMessage } from "~/utilities/chatErrors";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

describe("chatErrorMessage", () => {
  it("says how long a message can be", () => {
    expect(chatErrorMessage({ code: "too_long", max: 1500 }, t)).toBe(
      'chat.message_too_long {"max":1500}',
    );
  });

  it("falls back to the local limit when the api sends no max", () => {
    expect(chatErrorMessage({ code: "too_long" }, t)).toBe(
      `chat.message_too_long {"max":${CHAT_MESSAGE_MAX_LENGTH}}`,
    );
  });

  it("reports a refused send as a failed send", () => {
    // not_allowed can be a send queued offline that beat its lobby rejoin
    expect(chatErrorMessage({ code: "not_allowed" }, t)).toBe(
      "chat.send_failed",
    );
  });

  it.each(["invalid", "some_future_code", ""])(
    "treats %j as a failed send",
    (code) => {
      expect(chatErrorMessage({ code }, t)).toBe("chat.send_failed");
    },
  );

  it("survives a payload with no code", () => {
    expect(chatErrorMessage(undefined as any, t)).toBe("chat.send_failed");
  });
});
