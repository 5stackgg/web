import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentViewingSelect from "~/components/tournament/TournamentViewingSelect.vue";

const ME = "76561198000000001";

const entry = (
  id: string,
  players: string[],
  checkedIn = false,
): Record<string, any> => ({
  id,
  name: id,
  checked_in_at: checkedIn ? "2026-10-31T20:20:00Z" : null,
  roster: players.map((steam_id) => ({ player: { steam_id } })),
});

const teams = [
  entry("Northside", [ME, "2", "3", "4", "5"]),
  entry("Academy", ["6", "7", "8", "9"]),
  entry("Pinecone", ["10", "11", "12", "13", "14"], true),
];

let mounted: { unmount: () => void } | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  document.body.replaceChildren();
});

async function mountSelect(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(TournamentViewingSelect, {
    props: {
      teams,
      steamId: ME,
      maxPlayers: 5,
      modelValue: "Northside",
      ...props,
    },
    attachTo: document.body,
  });
  mounted = wrapper;
  return wrapper;
}

async function openMenu(wrapper: Awaited<ReturnType<typeof mountSelect>>) {
  wrapper
    .find("[data-tournament-viewing]")
    .element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  await flushPromises();

  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
  );
}

describe("TournamentViewingSelect", () => {
  it("labels the trigger with the team being viewed", async () => {
    const wrapper = await mountSelect({ modelValue: "Academy" });

    const trigger = wrapper.find("[data-tournament-viewing]");
    expect(trigger.text()).toContain("Viewing");
    expect(trigger.text()).toContain("Academy");
  });

  it("shows the first team when nothing is picked", async () => {
    const wrapper = await mountSelect({ modelValue: null });

    expect(wrapper.find("[data-tournament-viewing]").text()).toContain(
      "Northside",
    );
  });

  it("tags the team the viewer plays on and the ones they only own", async () => {
    const wrapper = await mountSelect();
    const items = await openMenu(wrapper);

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("You play"),
      expect.stringContaining("Owner"),
      expect.stringContaining("Owner"),
    ]);
    expect(items[1].textContent).toContain("4/5 players");
    expect(document.body.textContent).toContain(
      "You play on Northside. The others you registered as owner.",
    );
  });

  it("says every team is owned when the viewer plays on none", async () => {
    const wrapper = await mountSelect({ steamId: "76561198000000099" });
    const items = await openMenu(wrapper);

    expect(items.every((item) => item.textContent?.includes("Owner"))).toBe(
      true,
    );
    expect(document.body.textContent).toContain(
      "You registered these teams as owner.",
    );
  });

  it("leaves check-in out when there is no check-in", async () => {
    const wrapper = await mountSelect();
    const items = await openMenu(wrapper);

    expect(items[2].textContent).not.toContain("Checked in");
  });

  it("shows who still has to check in while the window is open", async () => {
    const wrapper = await mountSelect({ checkIn: "open" });
    const items = await openMenu(wrapper);

    expect(items[0].textContent).toContain("Not checked in");
    expect(items[2].textContent).toContain("Checked in");
  });

  it("says Missed check-in once the window has closed", async () => {
    const wrapper = await mountSelect({ checkIn: "closed" });
    const items = await openMenu(wrapper);

    expect(items[0].textContent).toContain("Missed check-in");
    expect(items[2].textContent).toContain("Checked in");
  });

  it("emits the picked team", async () => {
    const wrapper = await mountSelect();
    const items = await openMenu(wrapper);

    items[2].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "Pinecone",
    ]);
  });
});
