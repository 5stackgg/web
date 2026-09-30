import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessageReactions from "~/components/chat/ChatMessageReactions.vue";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const ME = "76561198000000001";
const DANA = "76561198000000002";
const ELI = "76561198000000003";
const ROOM = { type: "match", id: "reactions-match" };

const message = (reactions?: Record<string, string[]>) => ({
  id: "7f1d0c2e-8b1a-4c6e-9f00-000000000001",
  message: "gg",
  source: "web",
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, 0)).toISOString(),
  from: { steam_id: DANA, name: "Dana" },
  reactions,
});

const everything = { canReact: true, canAddReaction: true };

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  delete useMatchLobbyStore().lobbyChat[`${ROOM.type}:${ROOM.id}`];
});

async function mountPills(
  reactions: Record<string, string[]> | undefined,
  props: Record<string, unknown> = {},
) {
  const wrapper = await mountSuspended(ChatMessageReactions, {
    props: {
      message: message(reactions),
      room: ROOM,
      permissions: everything,
      viewerSteamId: ME,
      ...props,
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

const pills = (wrapper: Awaited<ReturnType<typeof mountPills>>) =>
  wrapper.findAll("button[data-reaction]");

describe("ChatMessageReactions", () => {
  it("renders nothing for a message nobody has reacted to", async () => {
    for (const reactions of [undefined, {}]) {
      const wrapper = await mountPills(reactions);

      expect(pills(wrapper)).toHaveLength(0);
      expect(wrapper.find("div").exists()).toBe(false);

      unmount?.();
      unmount = undefined;
    }
  });

  it("shows each reaction's glyph and count in the list's order", async () => {
    const wrapper = await mountPills({
      sad: [ELI],
      thumbsup: [DANA, ELI],
      party: [DANA],
      laugh: [],
    });

    expect(
      pills(wrapper).map((pill) => pill.attributes("data-reaction")),
    ).toEqual(["thumbsup", "sad"]);
    expect(pills(wrapper).map((pill) => pill.text())).toEqual(["👍2", "😢1"]);
    expect(pills(wrapper)[0].attributes("aria-label")).toBe(
      "React with 👍 (2)",
    );
  });

  it("marks the reactions the viewer holds", async () => {
    const wrapper = await mountPills({
      thumbsup: [DANA],
      heart: [DANA, ME],
    });

    const [thumbsup, heart] = pills(wrapper);

    expect(thumbsup.attributes("aria-pressed")).toBe("false");
    expect(heart.attributes("aria-pressed")).toBe("true");
    expect(heart.classes()).toContain("!text-[hsl(var(--tac-amber))]");
    expect(thumbsup.classes()).not.toContain("!text-[hsl(var(--tac-amber))]");
  });

  it("toggles the reaction it shows", async () => {
    const wrapper = await mountPills({
      thumbsup: [DANA],
      heart: [ME],
    });

    await pills(wrapper)[0].trigger("click");
    await pills(wrapper)[1].trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([["thumbsup"], ["heart"]]);
  });

  it("only lets a gagged viewer take back what they hold", async () => {
    const wrapper = await mountPills(
      { thumbsup: [DANA], heart: [ME] },
      { permissions: { canReact: true, canAddReaction: false } },
    );

    const [thumbsup, heart] = pills(wrapper);

    expect(thumbsup.attributes("aria-disabled")).toBe("true");
    expect(heart.attributes("aria-disabled")).toBeUndefined();

    await thumbsup.trigger("click");
    await heart.trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([["heart"]]);
  });

  it("shows reactions to a viewer who can't react, without toggling", async () => {
    const wrapper = await mountPills(
      { thumbsup: [DANA] },
      { permissions: { canReact: false, canAddReaction: false } },
    );

    await pills(wrapper)[0].trigger("click");

    expect(pills(wrapper)).toHaveLength(1);
    expect(pills(wrapper)[0].attributes("aria-disabled")).toBe("true");
    expect(wrapper.emitted("toggle")).toBeUndefined();
  });

  it("keeps a held pill amber without a hover once it can't be toggled", async () => {
    const wrapper = await mountPills(
      { heart: [ME] },
      { permissions: { canReact: false, canAddReaction: false } },
    );

    const classes = pills(wrapper)[0].classes();

    expect(classes).toContain("!text-[hsl(var(--tac-amber))]");
    expect(classes.some((name) => name.startsWith("hover:"))).toBe(false);
  });

  describe("who reacted", () => {
    const tooltip = async (wrapper: Awaited<ReturnType<typeof mountPills>>) => {
      const pill = pills(wrapper)[0];
      await pill.trigger("pointermove", { pointerType: "mouse" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await flushPromises();

      return document.body
        .querySelector('[role="tooltip"]')
        ?.textContent?.trim();
    };

    it("names the viewer first, then who else it knows", async () => {
      useMatchLobbyStore().set(`${ROOM.type}:${ROOM.id}`, [
        { steam_id: ELI, name: "Eli", avatar_url: "" },
      ]);

      const wrapper = await mountPills({ heart: [ELI, ME] });

      expect(await tooltip(wrapper)).toBe("You and Eli reacted with ❤️");
    });

    it("counts who it can't name", async () => {
      useMatchLobbyStore().set(`${ROOM.type}:${ROOM.id}`, [
        { steam_id: ELI, name: "Eli", avatar_url: "" },
      ]);

      const wrapper = await mountPills({
        fire: [ELI, "76561198000000008", "76561198000000009"],
      });

      expect(await tooltip(wrapper)).toBe("Eli and 2 others reacted with 🔥");
    });

    it("falls back to a count when it can name nobody", async () => {
      const wrapper = await mountPills({ sad: [DANA] });

      expect(await tooltip(wrapper)).toBe("1 player reacted with 😢");
    });
  });
});

describe("ChatMessageReactions picker", () => {
  const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');

  it("offers every reaction beside the pills, and toggles the pick", async () => {
    const wrapper = await mountPills({ thumbsup: [DANA] });

    const add = wrapper.get('button[aria-label="Add Reaction"]');
    add.element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
    await flushPromises();

    expect(
      menu()?.querySelectorAll('[role="menuitemcheckbox"]').length,
    ).toBeGreaterThan(6);

    menu()!.querySelector<HTMLElement>('[data-reaction="fire"]')!.click();
    await flushPromises();

    expect(wrapper.emitted("toggle")).toEqual([["fire"]]);
  });

  it("offers no picker to a viewer who can't react", async () => {
    const wrapper = await mountPills(
      { thumbsup: [DANA] },
      { permissions: { canReact: false, canAddReaction: false } },
    );

    expect(wrapper.find('button[aria-label="Add Reaction"]').exists()).toBe(
      false,
    );
  });
});

