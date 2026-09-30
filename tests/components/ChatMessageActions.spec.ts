import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import ChatMessageActions from "~/components/chat/ChatMessageActions.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { CHAT_REACTIONS } from "~/constants/chat";
import socket from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const MESSAGE = {
  id: "7f1d0c2e-8b1a-4c6e-9f00-000000000001",
  message: "gg",
  source: "web" as const,
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, 0)).toISOString(),
  from: { steam_id: "76561198000000002", name: "Dana" },
};

const TRIGGER = 'button[aria-label="Message actions"]';

let unmount: (() => void) | undefined;

// The test window hovers; this is the phone the toolbar never reaches.
function touchScreen() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(hover: none)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

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

  it("puts Copy and Edit first, and Delete after a separator", async () => {
    await openMenu();

    expect(menuItems()).toEqual([
      "Copy Text",
      "Edit Message",
      "Delete Message",
    ]);
    expect(
      document.body.querySelector('[role="menu"] [role="separator"]'),
    ).not.toBeNull();
  });

  it("leaves the separator out when there is nothing to separate", async () => {
    await openMenu({ canDelete: false, canEdit: true });

    expect(menuItems()).toEqual(["Copy Text", "Edit Message"]);
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

// A touch screen never gets the toolbar, so the menu is where its reactions are.
describe("ChatMessageActions reactions on a touch screen", () => {
  const ME = "76561198000000001";
  const everything = {
    canDelete: true,
    canEdit: true,
    canReact: true,
    canAddReaction: true,
  };

  const hubHeld = () => useRightSidebar().hoverCloseSuspended.value;

  const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');

  const menuItems = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent?.trim());

  const choices = () =>
    Array.from(
      menu()?.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"][data-reaction]',
      ) ?? [],
    );

  const choice = (reaction: string) =>
    choices().find((item) => item.dataset.reaction === reaction)!;

  beforeEach(() => {
    touchScreen();
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  async function openMenu(
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

    return wrapper;
  }

  it("leads with the reactions, then Copy and Edit, and Delete after a separator", async () => {
    await openMenu();

    expect(choices().map((item) => item.textContent?.trim())).toEqual(
      CHAT_REACTIONS.map(({ glyph }) => glyph),
    );
    expect(menuItems()).toEqual([
      "Copy Text",
      "Edit Message",
      "Delete Message",
    ]);
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(2);
    expect(hubHeld()).toBe(true);
  });

  it("names the reactions for screen readers", async () => {
    await openMenu();

    expect(menu()?.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe(
      "React",
    );
    expect(choice("thumbsup").getAttribute("aria-label")).toBe(
      "React with 👍",
    );
  });

  it("offers no reactions where the viewer can't react", async () => {
    await openMenu({ ...everything, canReact: false, canAddReaction: false });

    expect(choices()).toHaveLength(0);
    expect(menuItems()).toEqual([
      "Copy Text",
      "Edit Message",
      "Delete Message",
    ]);
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it("reacts with the pick, closes, and hands focus back", async () => {
    const wrapper = await openMenu();

    choice("fire").click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["fire"]]);
    expect(menu()).toBeNull();
    expect(hubHeld()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(TRIGGER).element);
  });

  it("marks what the viewer already holds, to take it back", async () => {
    await openMenu(everything, { heart: [ME], fire: ["76561198000000002"] });

    expect(choice("heart").getAttribute("aria-checked")).toBe("true");
    expect(choice("fire").getAttribute("aria-checked")).toBe("false");
  });

  it("lets a gagged viewer take a reaction back but not add one", async () => {
    const wrapper = await openMenu(
      { ...everything, canAddReaction: false },
      { heart: [ME] },
    );

    expect(
      choices()
        .filter((item) => !item.hasAttribute("data-disabled"))
        .map((item) => item.dataset.reaction),
    ).toEqual(["heart"]);
    expect(menu()?.textContent).toContain(
      "You're gagged and can't add reactions.",
    );

    choice("fire").click();
    choice("heart").click();
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["heart"]]);
  });

  it("reacts once for a double click", async () => {
    const wrapper = await openMenu();

    const fire = choice("fire");
    fire.click();
    fire.click();
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["fire"]]);
  });

  it("copies the message text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    try {
      await openMenu();

      Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      )
        .find((item) => item.textContent?.trim() === "Copy Text")!
        .click();
      await flushPromises();

      expect(writeText).toHaveBeenCalledWith("gg");
      expect(toast).toHaveBeenCalledWith({ title: "Copied to Clipboard" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("ChatMessageActions toolbar", () => {
  const ME = "76561198000000001";
  const everything = {
    canDelete: true,
    canEdit: true,
    canReact: true,
    canAddReaction: true,
  };

  const hubHeld = () => useRightSidebar().hoverCloseSuspended.value;

  const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');

  beforeEach(() => {
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  async function mountToolbar(
    props: Record<string, unknown> = {},
    reactions: Record<string, string[]> = {},
  ) {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: { ...MESSAGE, reactions },
        room: { type: "match", id: "match-1" },
        permissions: everything,
        viewerSteamId: ME,
        hovered: true,
        ...props,
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  const quick = (wrapper: Awaited<ReturnType<typeof mountToolbar>>) =>
    wrapper.findAll<HTMLButtonElement>("button[data-quick-reaction]");

  it("is only the menu trigger until the line is hovered", async () => {
    const wrapper = await mountToolbar({ hovered: false });

    expect(quick(wrapper)).toHaveLength(0);
    expect(wrapper.find('button[aria-label="Add Reaction"]').exists()).toBe(
      false,
    );
    expect(wrapper.find(TRIGGER).exists()).toBe(true);

    await wrapper.setProps({ hovered: true });

    expect(quick(wrapper).map((button) => button.text())).toEqual([
      "👍",
      "❤️",
      "😂",
    ]);
    expect(wrapper.find('button[aria-label="Add Reaction"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('button[aria-label="Edit Message"]').exists()).toBe(
      true,
    );
  });

  it("reacts from a quick reaction", async () => {
    const wrapper = await mountToolbar();

    await wrapper.get('button[data-quick-reaction="heart"]').trigger("click");

    expect(wrapper.emitted("react")).toEqual([["heart"]]);
  });

  it("marks what the viewer holds, and what a gag won't let them add", async () => {
    const wrapper = await mountToolbar(
      { permissions: { ...everything, canAddReaction: false } },
      { heart: [ME] },
    );

    const heart = wrapper.get('button[data-quick-reaction="heart"]');
    expect(heart.attributes("aria-pressed")).toBe("true");
    expect(heart.attributes("disabled")).toBeUndefined();
    expect(
      wrapper
        .get('button[data-quick-reaction="thumbsup"]')
        .attributes("disabled"),
    ).toBeDefined();
  });

  it("offers no reactions where the viewer can't react", async () => {
    const wrapper = await mountToolbar({
      permissions: { ...everything, canReact: false, canAddReaction: false },
    });

    expect(quick(wrapper)).toHaveLength(0);
    expect(wrapper.find('button[aria-label="Add Reaction"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('button[aria-label="Edit Message"]').exists()).toBe(
      true,
    );
  });

  it("keeps reactions out of the menu, where the toolbar has them", async () => {
    const wrapper = await mountToolbar();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(menu()?.querySelectorAll("[data-reaction]")).toHaveLength(0);
    expect(
      Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).map((item) => item.textContent?.trim()),
    ).toEqual(["Copy Text", "Edit Message", "Delete Message"]);
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it("hands the edit to the row", async () => {
    const wrapper = await mountToolbar();

    await wrapper.get('button[aria-label="Edit Message"]').trigger("click");

    expect(wrapper.emitted("edit")).toHaveLength(1);
  });

  it("opens every reaction from the smiley and reacts once", async () => {
    const wrapper = await mountToolbar();

    await wrapper
      .get('button[aria-label="Add Reaction"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();

    const choices = Array.from(
      menu()?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]') ??
        [],
    );
    expect(choices.map((item) => item.dataset.reaction)).toEqual(
      CHAT_REACTIONS.map(({ id }) => id),
    );
    expect(choices.length).toBeGreaterThan(6);
    expect(hubHeld()).toBe(true);
    expect(wrapper.attributes("data-chat-menu-open")).toBeDefined();

    const fire = choices.find((item) => item.dataset.reaction === "fire")!;
    fire.click();
    fire.click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(wrapper.emitted("react")).toEqual([["fire"]]);
    expect(menu()).toBeNull();
    expect(hubHeld()).toBe(false);
  });

  // The smiley sits inside a tooltip, and reka's tooltip and menu share one
  // popper context: unanchored, the picker opened but never left its
  // off-screen starting point.
  it("positions the picker it opens on a mouse click", async () => {
    const wrapper = await mountToolbar();

    wrapper
      .get('button[aria-label="Add Reaction"]')
      .element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(menu()).not.toBeNull();
    expect(menu()!.parentElement!.style.transform).not.toBe(
      "translate(0, -200%)",
    );
  });

  it("stays out while one of its menus is open, after the pointer leaves", async () => {
    const wrapper = await mountToolbar();

    await wrapper
      .get('button[aria-label="Add Reaction"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    await wrapper.setProps({ hovered: false });

    expect(menu()).not.toBeNull();
    expect(quick(wrapper)).toHaveLength(3);
  });
});

describe("ChatMessageActions moderation", () => {
  const moderator = {
    canDelete: true,
    canEdit: false,
    canReact: false,
    canAddReaction: false,
    canSanction: true,
  };

  const hubHeld = () => useRightSidebar().hoverCloseSuspended.value;

  const menuItem = (label: string) =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === label);

  beforeEach(() => {
    while (useRightSidebar().hoverCloseSuspended.value) {
      useRightSidebar().resumeHoverClose();
    }
  });

  async function openMenu(permissions: Record<string, boolean>) {
    const wrapper = await mountSuspended(ChatMessageActions, {
      props: {
        message: MESSAGE,
        room: { type: "match", id: "match-1" },
        permissions,
      },
      attachTo: document.body,
    });
    unmount = () => wrapper.unmount();

    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    return wrapper;
  }

  it("puts the author's sanctions under Moderate, above Delete", async () => {
    await openMenu(moderator);

    const moderate = menuItem("Moderate Dana")!;
    expect(moderate.getAttribute("aria-haspopup")).toBe("menu");
    expect(
      Array.from(
        document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).map((item) => item.textContent?.trim()),
    ).toEqual(["Copy Text", "Moderate Dana", "Delete Message"]);

    moderate.focus();
    moderate.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();

    expect(
      Array.from(
        document.body.querySelectorAll<HTMLElement>("[data-sanction]"),
      ).map((item) => item.dataset.sanction),
    ).toEqual(["warning", "gag", "mute", "silence", "ban"]);
  });

  it("opens the sanction form for the pick, holding the hub", async () => {
    const wrapper = await openMenu(moderator);

    const moderate = menuItem("Moderate Dana")!;
    moderate.focus();
    moderate.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();

    document.body.querySelector<HTMLElement>('[data-sanction="gag"]')!.click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    const sanction = wrapper.findComponent({ name: "SanctionPlayer" });
    expect(sanction.props("presetType")).toBe("gag");
    expect((sanction.vm as any).sanctionType).toBe("gag");
    expect((sanction.vm as any).sanctioningPlayer).toBe(true);
    expect(document.body.querySelector("form")).not.toBeNull();
    expect(hubHeld()).toBe(true);
  });

  it("offers no moderation to someone who can't sanction", async () => {
    await openMenu({ ...moderator, canSanction: false });

    expect(menuItem("Moderate Dana")).toBeUndefined();
    expect(menuItem("Delete Message")).toBeDefined();
  });
});
