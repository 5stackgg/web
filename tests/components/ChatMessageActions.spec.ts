import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import ChatMessageActions from "~/components/chat/ChatMessageActions.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import socket from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const MESSAGE = {
  id: "7f1d0c2e-8b1a-4c6e-9f00-000000000001",
  message: "gg",
  source: "web",
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, 0)).toISOString(),
  from: { steam_id: "76561198000000002", name: "Dana" },
};

const TRIGGER = 'button[aria-label="Message actions"]';

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
  toast.mockClear();
});

describe("ChatMessage actions", () => {
  async function mountMessage(props: Record<string, unknown>) {
    const wrapper = await mountSuspended(ChatMessage, {
      props: { message: MESSAGE, ...props },
    });
    unmount = () => wrapper.unmount();
    return wrapper;
  }

  it("offers them to a moderator in a group room", async () => {
    const wrapper = await mountMessage({
      canModerate: true,
      room: { type: "match", id: "match-1" },
    });

    expect(wrapper.find(TRIGGER).exists()).toBe(true);
  });

  it("offers nothing in a direct conversation", async () => {
    const wrapper = await mountMessage({
      canModerate: true,
      room: { type: "direct", id: "1:2" },
    });

    expect(wrapper.find(TRIGGER).exists()).toBe(false);
  });

  it("offers nothing to a player who can't moderate", async () => {
    const wrapper = await mountMessage({
      canModerate: false,
      room: { type: "match", id: "match-1" },
    });

    expect(wrapper.find(TRIGGER).exists()).toBe(false);
  });

  it("offers nothing where the room is unknown", async () => {
    const wrapper = await mountMessage({ canModerate: true });

    expect(wrapper.find(TRIGGER).exists()).toBe(false);
  });
});

describe("ChatMessageActions", () => {
  const hubHeld = () => useRightSidebar().hoverCloseSuspended.value;

  const menuItem = (label: string) =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === label);

  const dialog = () =>
    document.body.querySelector<HTMLElement>('[role="alertdialog"]');

  const dialogButton = (label: string) =>
    Array.from(dialog()?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === label,
    );

  beforeEach(() => {
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  async function openConfirm() {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: MESSAGE,
        room: { type: "match_team", id: "match-1:lineup-1" },
        permissions: { canDelete: true },
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(hubHeld()).toBe(true);
    expect(
      document.body
        .querySelector('[role="menu"]')
        ?.hasAttribute("data-right-hub-interactive"),
    ).toBe(true);

    menuItem("Delete Message")!.click();
    await flushPromises();

    expect(dialog()?.hasAttribute("data-right-hub-interactive")).toBe(true);

    return wrapper;
  }

  it("asks before deleting, from the room the message lives in", async () => {
    const deleteMessage = vi
      .spyOn(socket, "deleteMessage")
      .mockResolvedValue(undefined);

    await openConfirm();

    expect(dialog()?.textContent).toContain("Delete Message?");
    expect(dialog()?.textContent).toContain(
      "The message from Dana will be removed for everyone in this chat.",
    );
    expect(dialog()?.querySelector("blockquote")?.textContent?.trim()).toBe(
      "gg",
    );
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(hubHeld()).toBe(true);

    dialogButton("Delete")!.click();
    await flushPromises();

    expect(deleteMessage).toHaveBeenCalledWith(
      "match_team",
      "match-1:lineup-1",
      MESSAGE.id,
    );
    expect(dialog()).toBeNull();
    expect(hubHeld()).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it("stays open and reports a delete that failed", async () => {
    vi.spyOn(socket, "deleteMessage").mockRejectedValue({
      code: "not_allowed",
      action: "delete",
    });

    await openConfirm();

    dialogButton("Delete")!.click();
    await flushPromises();

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to delete message",
      description: undefined,
      variant: "destructive",
    });
    expect(dialog()).not.toBeNull();
    expect(hubHeld()).toBe(true);
  });

  it("closes quietly when the message was already gone", async () => {
    vi.spyOn(socket, "deleteMessage").mockRejectedValue({
      code: "not_found",
      action: "delete",
    });

    await openConfirm();

    dialogButton("Delete")!.click();
    await flushPromises();

    expect(toast).toHaveBeenCalledWith({ title: "Message already removed" });
    expect(dialog()).toBeNull();
    expect(hubHeld()).toBe(false);
  });

  it("does nothing on cancel", async () => {
    const deleteMessage = vi.spyOn(socket, "deleteMessage");

    await openConfirm();

    dialogButton("Cancel")!.click();
    await flushPromises();

    expect(deleteMessage).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
    expect(hubHeld()).toBe(false);
  });

  it("lets go of the hub when the message goes away mid-confirm", async () => {
    await openConfirm();

    unmount?.();
    unmount = undefined;

    expect(hubHeld()).toBe(false);
  });
});
