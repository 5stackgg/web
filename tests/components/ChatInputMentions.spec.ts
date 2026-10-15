import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatInput from "~/components/chat/ChatInput.vue";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const KAIRO = "76561198000000002";
const KASPR = "76561198000000003";
const KALANI = "76561198000000004";

const member = (steam_id: string, name: string, extra = {}) => ({
  steam_id,
  name,
  avatar_url: null,
  team: null,
  organizer: false,
  ...extra,
});

const MEMBERS = [
  member(KAIRO, "kairo", { team: "Northwind" }),
  member(KASPR, "kaspr", { team: "Iron Lotus" }),
  member(KALANI, "kalani", { organizer: true }),
  member("76561198000000005", "rook"),
  member("76561198000000006", "okami"),
  member("76561198000000007", "ruu"),
];

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

let counter = 0;
let fetchMembers: ReturnType<typeof vi.fn>;

async function mountInput(type = "tournament") {
  return await mountSuspended(ChatInput, {
    props: { mentionRoom: { type, id: `room-${++counter}` } },
  });
}

async function typeText(wrapper: Wrapper, text: string) {
  await wrapper.get("textarea").setValue(text);
  await flushPromises();
}

async function press(wrapper: Wrapper, key: string, init = {}) {
  await wrapper.get("textarea").trigger("keydown", { key, ...init });
  await flushPromises();
}

const list = (wrapper: Wrapper) => wrapper.find("[data-chat-mention-list]");
const rows = (wrapper: Wrapper) =>
  wrapper.findAll("[data-chat-mention-option]");
const textarea = (wrapper: Wrapper) =>
  wrapper.get("textarea").element as HTMLTextAreaElement;

beforeEach(() => {
  toast.mockClear();
  fetchMembers = vi.fn().mockResolvedValue({ members: MEMBERS });
  vi.stubGlobal("$fetch", fetchMembers);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatInput mentions", () => {
  it("lists the room's members when @ is typed, best match first, five at most", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@");

    expect(fetchMembers).toHaveBeenCalledWith(
      expect.stringMatching(/\/chat\/rooms\/tournament\/room-\d+\/members$/),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(rows(wrapper)).toHaveLength(5);

    await typeText(wrapper, "nice one @ka");

    expect(rows(wrapper).map((row) => row.text())).toEqual([
      expect.stringContaining("kairo"),
      expect.stringContaining("kalani"),
      expect.stringContaining("kaspr"),
      expect.stringContaining("okami"),
    ]);
    expect(rows(wrapper)[0].text()).toContain("Northwind");
    expect(rows(wrapper)[1].text()).toContain("Organizer");
  });

  it("asks for a room's members once while the list is fresh", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@k");
    await typeText(wrapper, "@ka");
    await typeText(wrapper, "@kai");

    expect(fetchMembers).toHaveBeenCalledTimes(1);
  });

  it("moves with the arrows and writes the pick in on Enter, without sending", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "nice one @ka");
    await press(wrapper, "ArrowDown");

    expect(rows(wrapper)[1].attributes("aria-selected")).toBe("true");

    await press(wrapper, "Enter");

    expect(textarea(wrapper).value).toBe("nice one @kalani ");
    expect(wrapper.emitted("sendMessage")).toBeUndefined();
    expect(list(wrapper).exists()).toBe(false);
  });

  it("wraps from the first row up to the last", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@ka");
    await press(wrapper, "ArrowUp");

    expect(rows(wrapper)[3].attributes("aria-selected")).toBe("true");
    expect(wrapper.emitted("edit-last")).toBeUndefined();
  });

  it("picks with Tab too", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@kas");
    await press(wrapper, "Tab");

    expect(textarea(wrapper).value).toBe("@kaspr ");
  });

  it("picks the row that is tapped", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@ka");
    await rows(wrapper)[2].trigger("click");
    await flushPromises();

    expect(textarea(wrapper).value).toBe("@kaspr ");
  });

  it("closes on Escape and leaves the text as typed", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@ka");
    await press(wrapper, "Escape");

    expect(list(wrapper).exists()).toBe(false);
    expect(textarea(wrapper).value).toBe("@ka");
  });

  it("sends the tagged players with the message", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@kai");
    await press(wrapper, "Enter");
    await typeText(wrapper, `${textarea(wrapper).value}you're up`);
    await press(wrapper, "Enter");

    expect(wrapper.emitted("sendMessage")).toEqual([
      ["@kairo you're up", undefined, { mentions: [KAIRO] }],
    ]);
  });

  it("sends a plain message as it always did", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "gg wp");
    await press(wrapper, "Enter");

    expect(wrapper.emitted("sendMessage")).toEqual([["gg wp", undefined]]);
  });

  it("says when no one in the room matches", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@zed");

    expect(rows(wrapper)).toHaveLength(0);
    expect(list(wrapper).text()).toContain('No one in this room matches "zed"');
  });

  it("says when the players could not be loaded, and still sends the text", async () => {
    fetchMembers.mockRejectedValue(new Error("offline"));
    const wrapper = await mountInput();

    await typeText(wrapper, "@ka");

    expect(list(wrapper).text()).toContain("Couldn't load players");

    await press(wrapper, "Enter");

    expect(wrapper.emitted("sendMessage")).toEqual([["@ka", undefined]]);
  });

  it("offers no more names once ten are tagged", async () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      member(`7656119800000010${String(index).padStart(2, "0")}`, `p${index}`),
    );
    fetchMembers.mockResolvedValue({ members: many });
    const wrapper = await mountInput();

    await typeText(wrapper, "@");
    await typeText(
      wrapper,
      `${many
        .slice(0, 10)
        .map(({ name }) => `@${name}`)
        .join(" ")} check-in @`,
    );

    expect(rows(wrapper)).toHaveLength(0);
    expect(list(wrapper).text()).toContain(
      "You can tag up to 10 players in one message.",
    );
  });

  it("refuses more than ten tags before sending, and keeps the text", async () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      member(`7656119800000010${String(index).padStart(2, "0")}`, `p${index}`),
    );
    fetchMembers.mockResolvedValue({ members: many });
    const wrapper = await mountInput();
    const text = `${many.map(({ name }) => `@${name}`).join(" ")} check-in`;

    await typeText(wrapper, "@");
    await typeText(wrapper, text);
    await press(wrapper, "Enter");

    expect(wrapper.emitted("sendMessage")).toBeUndefined();
    expect(textarea(wrapper).value).toBe(text);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "A message can tag up to 10 players.",
        variant: "destructive",
      }),
    );
  });

  it("sends only the longer of two names that start alike", async () => {
    fetchMembers.mockResolvedValue({
      members: [
        member("76561198000000011", "Big"),
        member("76561198000000012", "Big Bob"),
      ],
    });
    const wrapper = await mountInput();

    await typeText(wrapper, "@");
    await typeText(wrapper, "@Big Bob gg");
    await press(wrapper, "Enter");

    expect(wrapper.emitted("sendMessage")).toEqual([
      ["@Big Bob gg", undefined, { mentions: ["76561198000000012"] }],
    ]);
  });

  it("asks for the room's members again once the list is a minute old", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const wrapper = await mountInput();

    await typeText(wrapper, "@k");
    await typeText(wrapper, "hi");
    now.mockReturnValue(1_000_000 + 30_000);
    await typeText(wrapper, "@k");

    expect(fetchMembers).toHaveBeenCalledTimes(1);

    await typeText(wrapper, "hi");
    now.mockReturnValue(1_000_000 + 61_000);
    await typeText(wrapper, "@k");

    expect(fetchMembers).toHaveBeenCalledTimes(2);
    expect(rows(wrapper).length).toBeGreaterThan(0);
  });

  it("loads the other room's members when the destination changes with the list open", async () => {
    const wrapper = await mountInput("match");

    await typeText(wrapper, "@ka");
    await wrapper.setProps({
      mentionRoom: { type: "match_team", id: `team-${counter}` },
    });
    await flushPromises();

    expect(fetchMembers).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/chat\/rooms\/match_team\/team-\d+\/members$/),
      expect.anything(),
    );
    expect(rows(wrapper).length).toBeGreaterThan(0);
  });

  it("leaves Tab and the arrows to an input method that is composing", async () => {
    const wrapper = await mountInput();

    await typeText(wrapper, "@ka");
    await press(wrapper, "ArrowDown", { isComposing: true });
    await press(wrapper, "Tab", { isComposing: true });

    expect(rows(wrapper)[0].attributes("aria-selected")).toBe("true");
    expect(textarea(wrapper).value).toBe("@ka");
  });

  it("reads to a screen reader as a combobox with the active option", async () => {
    const wrapper = await mountInput();
    const field = () => wrapper.get("textarea");

    expect(field().attributes("role")).toBe("combobox");
    expect(field().attributes("aria-expanded")).toBe("false");

    await typeText(wrapper, "@ka");

    const listId = list(wrapper).attributes("id");
    expect(listId).toBeTruthy();
    expect(field().attributes("aria-controls")).toBe(listId);
    expect(field().attributes("aria-expanded")).toBe("true");
    expect(field().attributes("aria-activedescendant")).toBe(
      rows(wrapper)[0].attributes("id"),
    );

    await press(wrapper, "ArrowDown");

    expect(field().attributes("aria-activedescendant")).toBe(
      rows(wrapper)[1].attributes("id"),
    );
  });

  it("offers nothing in a direct conversation", async () => {
    const wrapper = await mountSuspended(ChatInput, {
      props: { mentionRoom: null },
    });

    await typeText(wrapper, "@ka");

    expect(list(wrapper).exists()).toBe(false);
    expect(fetchMembers).not.toHaveBeenCalled();
  });
});
