import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";
import socket from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

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

describe("ChatMessage editing", () => {
  const ME = "76561198000000001";
  const ROOM = { type: "match", id: "match-1" };
  const TRIGGER = 'button[aria-label="Message actions"]';

  const own = (overrides: Record<string, unknown> = {}) => ({
    id: "7f1d0c2e-8b1a-4c6e-9f00-000000000001",
    message: "gg",
    source: "web",
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    from: { steam_id: ME, name: "Me" },
    ...overrides,
  });

  let unmount: (() => void) | undefined;

  beforeEach(() => {
    useAuthStore().me = { steam_id: ME, role: "user" } as any;
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    useAuthStore().me = undefined;
    vi.restoreAllMocks();
    toast.mockClear();
  });

  async function mountMessage(props: Record<string, unknown> = {}) {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: own(), room: ROOM, ...props },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  const textarea = (wrapper: Awaited<ReturnType<typeof mountMessage>>) =>
    wrapper.get("textarea").element as HTMLTextAreaElement;

  const press = async (
    wrapper: Awaited<ReturnType<typeof mountMessage>>,
    key: string,
    options: Record<string, unknown> = {},
  ) => {
    await wrapper.get("textarea").trigger("keydown", { key, ...options });
    await flushPromises();
  };

  it("offers the author an edit on their own recent message", async () => {
    const wrapper = await mountMessage();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    const edit = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === "Edit Message");
    edit!.click();
    await flushPromises();

    expect(wrapper.emitted("edit")).toHaveLength(1);
  });

  it("takes the trigger away and says why once the window has closed", async () => {
    const wrapper = await mountMessage();
    const sentAt = Date.parse(own().timestamp);
    vi.spyOn(Date, "now").mockReturnValue(sentAt + 10 * 60_000);

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.find(TRIGGER).exists()).toBe(false);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(toast).toHaveBeenCalledWith({
      title: "You can only edit or delete your messages for 10 minutes.",
    });
    expect(useRightSidebar().hoverCloseSuspended.value).toBe(false);
  });

  it("opens the editor on the current text, focused", async () => {
    const wrapper = await mountMessage({ editing: true });

    expect(textarea(wrapper).value).toBe("gg");
    expect(document.activeElement).toBe(textarea(wrapper));
    expect(textarea(wrapper).selectionStart).toBe(2);
    expect(wrapper.text()).toContain("Enter to save · Esc to cancel");
    expect(wrapper.find(TRIGGER).exists()).toBe(false);
  });

  it("saves the trimmed text on Enter and closes", async () => {
    const editMessage = vi
      .spyOn(socket, "editMessage")
      .mockResolvedValue(undefined);
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("  fixed  ");
    await press(wrapper, "Enter");

    expect(editMessage).toHaveBeenCalledWith(
      "match",
      "match-1",
      own().id,
      "fixed",
    );
    expect(wrapper.emitted("edit-end")).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it("breaks the line on Shift+Enter instead of saving", async () => {
    const editMessage = vi.spyOn(socket, "editMessage");
    const wrapper = await mountMessage({ editing: true });

    await press(wrapper, "Enter", { shiftKey: true });

    expect(editMessage).not.toHaveBeenCalled();
    expect(wrapper.emitted("edit-end")).toBeUndefined();
  });

  it("cancels on Esc without saving", async () => {
    const editMessage = vi.spyOn(socket, "editMessage");
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("fixed");
    await press(wrapper, "Escape");

    expect(editMessage).not.toHaveBeenCalled();
    expect(wrapper.emitted("edit-end")).toHaveLength(1);
  });

  it("just closes when nothing changed", async () => {
    const editMessage = vi.spyOn(socket, "editMessage");
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue(" gg ");
    await press(wrapper, "Enter");

    expect(editMessage).not.toHaveBeenCalled();
    expect(wrapper.emitted("edit-end")).toHaveLength(1);
  });

  it("won't save an empty message", async () => {
    const editMessage = vi.spyOn(socket, "editMessage");
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("   ");
    await press(wrapper, "Enter");

    expect(editMessage).not.toHaveBeenCalled();
    expect(wrapper.emitted("edit-end")).toBeUndefined();
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("counts down near the cap and refuses to go over it", async () => {
    const editMessage = vi.spyOn(socket, "editMessage");
    const wrapper = await mountMessage({ editing: true });

    await wrapper
      .get("textarea")
      .setValue("a".repeat(CHAT_MESSAGE_MAX_LENGTH - 150));
    expect(wrapper.find(".tabular-nums").text()).toBe("150");

    await wrapper
      .get("textarea")
      .setValue("a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1));
    expect(wrapper.find(".tabular-nums").text()).toBe("-1");
    expect(wrapper.find(".tabular-nums").classes()).toContain(
      "text-destructive",
    );

    await press(wrapper, "Enter");

    expect(editMessage).not.toHaveBeenCalled();
    expect(wrapper.emitted("edit-end")).toBeUndefined();
    expect(toast).toHaveBeenCalledWith({
      title: "Failed to edit message",
      description: "Messages can be up to 2000 characters.",
      variant: "destructive",
    });
  });

  it("stays open with the text when the edit fails", async () => {
    vi.spyOn(socket, "editMessage").mockRejectedValue({
      code: "timeout",
      action: "edit",
    });
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("fixed");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.emitted("edit-end")).toBeUndefined();
    expect(textarea(wrapper).value).toBe("fixed");
    expect(toast).toHaveBeenCalledWith({
      title: "Failed to edit message",
      description: "The server didn't answer. Your edit may still be saved.",
      variant: "destructive",
    });
  });

  it.each(["gagged", "not_allowed"])(
    "closes on %s, which no retry can fix",
    async (code) => {
      vi.spyOn(socket, "editMessage").mockRejectedValue({
        code,
        action: "edit",
      });
      const wrapper = await mountMessage({ editing: true });

      await wrapper.get("textarea").setValue("fixed");
      await press(wrapper, "Enter");

      expect(wrapper.emitted("edit-end")).toHaveLength(1);
    },
  );

  it("won't cancel while a save is in flight", async () => {
    let finish: () => void = () => {};
    vi.spyOn(socket, "editMessage").mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("fixed");
    await press(wrapper, "Enter");
    await press(wrapper, "Escape");

    expect(wrapper.emitted("edit-end")).toBeUndefined();
    const cancel = wrapper
      .findAll("button")
      .find((button) => button.text() === "Cancel");
    expect(cancel!.attributes("disabled")).toBeDefined();

    finish();
    await flushPromises();

    expect(wrapper.emitted("edit-end")).toHaveLength(1);
  });

  it("offers no edit to a gagged author in a group room", async () => {
    useAuthStore().me = { steam_id: ME, role: "user", is_gagged: true } as any;
    const wrapper = await mountMessage();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    const items = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent?.trim());
    expect(items).toEqual(["Delete Message"]);
  });

  it("closes and explains when the window closed first", async () => {
    vi.spyOn(socket, "editMessage").mockRejectedValue({
      code: "window_closed",
      action: "edit",
    });
    const wrapper = await mountMessage({ editing: true });

    await wrapper.get("textarea").setValue("fixed");
    await press(wrapper, "Enter");

    expect(wrapper.emitted("edit-end")).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith({
      title: "Failed to edit message",
      description: "You can only edit a message for 10 minutes.",
      variant: "destructive",
    });
  });

  it("marks an edited message, with the time in a tooltip", async () => {
    const wrapper = await mountMessage({
      message: own({ edited_at: new Date().toISOString() }),
    });

    const marker = wrapper.get("[data-chat-edited]");
    expect(marker.text()).toBe("(edited)");
    expect(marker.attributes("data-state")).toBe("closed");
  });

  it("leaves an unedited message unmarked", async () => {
    const wrapper = await mountMessage();

    expect(wrapper.find("[data-chat-edited]").exists()).toBe(false);
  });
});
