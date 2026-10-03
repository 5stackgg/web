import { describe, expect, it } from "vitest";
import {
  chatErrorAction,
  chatErrorDescription,
  chatErrorFailed,
  chatErrorTitle,
} from "~/utilities/chatErrors";
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

  it("tells a gagged player why the send was refused", () => {
    expect(chatErrorDescription({ code: "gagged", action: "send" }, t)).toBe(
      "chat.gagged",
    );
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

describe("chat error actions", () => {
  it("reads a missing action as a send, like an older api sends", () => {
    expect(chatErrorAction({ code: "too_long" })).toBe("send");
    expect(chatErrorTitle({ code: "too_long" }, t)).toBe("chat.send_failed");
  });

  it("titles a failed delete as a delete", () => {
    expect(chatErrorTitle({ code: "not_allowed", action: "delete" }, t)).toBe(
      "chat.delete_failed",
    );
  });

  it("reports a message someone else removed first as gone, not failed", () => {
    const error = { code: "not_found", action: "delete" as const };

    expect(chatErrorFailed(error)).toBe(false);
    expect(chatErrorTitle(error, t)).toBe("chat.message_already_gone");
    expect(chatErrorDescription(error, t)).toBeUndefined();
  });

  it("only treats not_found as gone for a delete", () => {
    expect(chatErrorFailed({ code: "not_found" })).toBe(true);
    expect(chatErrorFailed({ code: "not_allowed", action: "delete" })).toBe(
      true,
    );
  });

  it("says a delete the api never answered may still go through", () => {
    expect(chatErrorDescription({ code: "timeout", action: "delete" }, t)).toBe(
      "chat.delete_timeout",
    );
  });

  it("says why the author's own delete came too late", () => {
    expect(
      chatErrorDescription({ code: "window_closed", action: "delete" }, t),
    ).toBe("chat.own_message_window_closed");
  });

  it.each(["not_allowed", "offline", "gagged", "too_long"])(
    "adds nothing to a failed delete for %s",
    (code) => {
      expect(
        chatErrorDescription({ code, action: "delete" }, t),
      ).toBeUndefined();
    },
  );
});

describe("chat edit errors", () => {
  it("titles every edit error as a failed edit", () => {
    for (const code of ["not_allowed", "not_found", "window_closed"]) {
      const error = { code, action: "edit" as const };

      expect(chatErrorTitle(error, t)).toBe("chat.edit_failed");
      expect(chatErrorFailed(error)).toBe(true);
    }
  });

  it.each([
    ["window_closed", "chat.edit_window_closed"],
    ["not_found", "chat.message_already_gone"],
    ["gagged", "chat.gagged"],
    ["timeout", "chat.edit_timeout"],
  ])("describes %s", (code, description) => {
    expect(chatErrorDescription({ code, action: "edit" }, t)).toBe(
      description,
    );
  });

  it("says when edits are coming too fast", () => {
    expect(
      chatErrorDescription({ code: "rate_limited", action: "edit" }, t),
    ).toBe(t("chat.edit_rate_limited"));
  });

  it("says how long an edit can be", () => {
    expect(
      chatErrorDescription({ code: "too_long", action: "edit", max: 2000 }, t),
    ).toBe('chat.message_too_long {"max":2000}');
  });

  it.each(["not_allowed", "invalid", "offline"])(
    "adds nothing to a failed edit for %s",
    (code) => {
      expect(chatErrorDescription({ code, action: "edit" }, t)).toBeUndefined();
    },
  );
});

describe("chat react errors", () => {
  it("titles every react error as a failed reaction", () => {
    for (const code of ["rate_limited", "gagged", "not_found", "invalid"]) {
      const error = { code, action: "react" as const };

      expect(chatErrorTitle(error, t)).toBe("chat.react_failed");
      expect(chatErrorFailed(error)).toBe(true);
    }
  });

  it.each([
    ["rate_limited", "chat.react_rate_limited"],
    ["gagged", "chat.react_gagged"],
    ["not_found", "chat.message_already_gone"],
    ["timeout", "chat.react_timeout"],
  ])("describes %s", (code, description) => {
    expect(chatErrorDescription({ code, action: "react" }, t)).toBe(
      description,
    );
  });

  it.each(["not_allowed", "invalid", "offline"])(
    "adds nothing to a failed reaction for %s",
    (code) => {
      expect(
        chatErrorDescription({ code, action: "react" }, t),
      ).toBeUndefined();
    },
  );
});
