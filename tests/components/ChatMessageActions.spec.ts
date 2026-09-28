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
        permissions: { canDelete: true, canEdit: false },
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

describe("ChatMessageActions for the author", () => {
  const menuItems = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent?.trim());

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

  async function openMenu(
    permissions = { canDelete: true, canEdit: true },
    own = true,
  ) {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: MESSAGE,
        room: { type: "direct", id: "1:2" },
        permissions,
        own,
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    return wrapper;
  }

  it("asks the row to re-check its window before the menu opens", async () => {
    const wrapper = await openMenu();

    expect(wrapper.emitted("open")).toHaveLength(1);
  });

  it("puts Edit first, and Delete after a separator", async () => {
    await openMenu();

    expect(menuItems()).toEqual(["Edit Message", "Delete Message"]);
    expect(
      document.body.querySelector('[role="menu"] [role="separator"]'),
    ).not.toBeNull();
  });

  it("leaves the separator out when there is nothing to separate", async () => {
    await openMenu({ canDelete: false, canEdit: true });

    expect(menuItems()).toEqual(["Edit Message"]);
    expect(
      document.body.querySelector('[role="menu"] [role="separator"]'),
    ).toBeNull();
  });

  it("hands the edit to the row and lets go of the hub", async () => {
    const wrapper = await openMenu();

    menuItem("Edit Message")!.click();
    await flushPromises();

    expect(wrapper.emitted("edit")).toHaveLength(1);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(useRightSidebar().hoverCloseSuspended.value).toBe(false);
  });

  it("asks about the author's own message in their own terms", async () => {
    await openMenu();

    menuItem("Delete Message")!.click();
    await flushPromises();

    expect(dialog()?.textContent).toContain("Delete Message?");
    expect(dialog()?.textContent).toContain(
      "Your message will be removed for everyone in this chat.",
    );
  });

  it("closes the confirm once the window has closed", async () => {
    vi.spyOn(socket, "deleteMessage").mockRejectedValue({
      code: "window_closed",
      action: "delete",
    });

    const wrapper = await openMenu();

    menuItem("Delete Message")!.click();
    await flushPromises();
    dialogButton("Delete")!.click();
    await flushPromises();

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to delete message",
      description: "You can only edit or delete your messages for 10 minutes.",
      variant: "destructive",
    });
    expect(dialog()).toBeNull();
    expect(wrapper.emitted("expired")).toHaveLength(1);
  });
});

describe("ChatMessageActions reactions", () => {
  const ME = "76561198000000001";
  const everything = {
    canDelete: true,
    canEdit: true,
    canReact: true,
    canAddReaction: true,
  };

  const hubHeld = () => useRightSidebar().hoverCloseSuspended.value;

  const menuItems = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent?.trim());

  const menuItem = (label: string) =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === label);

  const picker = () =>
    document.body.querySelector<HTMLElement>('[role="dialog"]');

  const choices = () =>
    Array.from(
      picker()?.querySelectorAll<HTMLButtonElement>("button[data-reaction]") ??
        [],
    );

  const choice = (reaction: string) =>
    choices().find((button) => button.dataset.reaction === reaction)!;

  beforeEach(() => {
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  async function openPicker(
    permissions = everything,
    reactions: Record<string, string[]> = {},
  ) {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: { ...MESSAGE, reactions },
        room: { type: "match", id: "match-1" },
        permissions,
        viewerSteamId: ME,
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    const trigger = wrapper.get(TRIGGER);
    (trigger.element as HTMLElement).focus();
    await trigger.trigger("keydown", { key: "Enter" });
    await flushPromises();

    menuItem("Add Reaction")!.click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    return wrapper;
  }

  it("puts Add Reaction above Edit, and Delete after a separator", async () => {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: MESSAGE,
        room: { type: "match", id: "match-1" },
        permissions: everything,
        viewerSteamId: ME,
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(menuItems()).toEqual([
      "Add Reaction",
      "Edit Message",
      "Delete Message",
    ]);
    expect(
      document.body.querySelectorAll('[role="menu"] [role="separator"]'),
    ).toHaveLength(1);
  });

  it("opens the picker from the menu, with focus in it, holding the hub", async () => {
    await openPicker();

    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(picker()?.hasAttribute("data-right-hub-interactive")).toBe(true);
    expect(choices().map((button) => button.textContent?.trim())).toEqual([
      "👍",
      "❤️",
      "😂",
      "🔥",
      "😮",
      "😢",
    ]);
    expect(choice("thumbsup").getAttribute("aria-label")).toBe(
      "React with 👍",
    );
    expect(picker()?.contains(document.activeElement)).toBe(true);
    expect(hubHeld()).toBe(true);
  });

  it("reacts with the pick, closes, and hands focus back", async () => {
    const wrapper = await openPicker();

    choice("fire").click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["fire"]]);
    expect(picker()).toBeNull();
    expect(hubHeld()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(TRIGGER).element);
  });

  it("marks what the viewer already holds, to take it back", async () => {
    await openPicker(everything, { heart: [ME], fire: ["76561198000000002"] });

    expect(choice("heart").getAttribute("aria-pressed")).toBe("true");
    expect(choice("fire").getAttribute("aria-pressed")).toBe("false");
  });

  it("lets a gagged viewer take a reaction back but not add one", async () => {
    const wrapper = await openPicker(
      { ...everything, canAddReaction: false },
      { heart: [ME] },
    );

    expect(
      choices()
        .filter((button) => !button.disabled)
        .map((button) => button.dataset.reaction),
    ).toEqual(["heart"]);
    expect(picker()?.textContent).toContain(
      "You're gagged and can't add reactions.",
    );

    choice("fire").click();
    choice("heart").click();
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["heart"]]);
  });

  it("closes on Escape and lets go of the hub", async () => {
    const wrapper = await openPicker();

    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(picker()).toBeNull();
    expect(wrapper.emitted("react")).toBeUndefined();
    expect(hubHeld()).toBe(false);
  });

  it("lets go of the hub when the message goes away mid-pick", async () => {
    await openPicker();

    unmount?.();
    unmount = undefined;

    expect(hubHeld()).toBe(false);
  });
});
