import { describe, expect, it } from "vitest";
import { chatErrorMessage } from "~/utilities/chatErrors";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

describe("chatErrorMessage", () => {
  it("says how long a message can be", () => {
    expect(chatErrorMessage({ code: "too_long", max: 1500 })).toEqual({
      key: "chat.message_too_long",
      params: { max: 1500 },
    });
  });

  it("falls back to the local limit when the api sends no max", () => {
    expect(chatErrorMessage({ code: "too_long" })).toEqual({
      key: "chat.message_too_long",
      params: { max: CHAT_MESSAGE_MAX_LENGTH },
    });
  });

  it("reports a refused send as a failed send", () => {
    // not_allowed can be a send queued offline that beat its lobby rejoin
    expect(chatErrorMessage({ code: "not_allowed" })).toEqual({
      key: "chat.send_failed",
      params: {},
    });
  });

  it.each(["invalid", "some_future_code", ""])(
    "treats %j as a failed send",
    (code) => {
      expect(chatErrorMessage({ code })).toEqual({
        key: "chat.send_failed",
        params: {},
      });
    },
  );

  it("survives a payload with no code", () => {
    expect(chatErrorMessage(undefined as any)).toEqual({
      key: "chat.send_failed",
      params: {},
    });
  });
});
