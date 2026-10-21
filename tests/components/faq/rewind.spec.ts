import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchRoundsTab from "~/components/match/rounds/MatchRoundsTab.vue";
import DemoScoreboard from "~/components/faq/demo/DemoScoreboard.vue";
import FaqContent from "~/components/faq/FaqContent.vue";
import { demoRewindRounds } from "~/utilities/demoMatch";
import { useFaqSearch } from "~/composables/useFaq";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

describe("the Rounds tab's rewind", () => {
  it("previews a round and offers to restore it", async () => {
    const wrapper = await mountSuspended(MatchRoundsTab, {
      props: {
        data: demoRewindRounds({ connected: true }),
        lineup1: "Kestrel",
        lineup2: "Ironside",
        canRewind: true,
        liveKills: 3,
        liveDamage: 380,
      },
    });

    expect(wrapper.text()).toContain("Round 17 in progress");
    expect(wrapper.text()).toContain("Click any round to restore");
    const round14 = wrapper.find(
      'button[aria-label="Restore from the start of round 14"]',
    );
    await round14.trigger("click");
    expect(wrapper.emitted("update:rewinding")?.at(-1)).toEqual([true]);
    expect(wrapper.emitted("update:target")?.at(-1)).toEqual([14]);

    await wrapper.setProps({ rewinding: true, target: 16 });
    expect(wrapper.text()).toContain("Back to the Start of Round 16");
    expect(wrapper.text()).toContain("12 kills");
    expect(wrapper.text()).toContain("1,512 damage");

    const restore = wrapper
      .findAll("button")
      .find((button) => button.text() === "Restore Round 16");
    expect(restore?.attributes("disabled")).toBeUndefined();
    await restore!.trigger("click");
    expect(wrapper.emitted("restore")?.at(-1)).toEqual([16]);
  });

  it("holds the restore while a player is missing", async () => {
    const wrapper = await mountSuspended(MatchRoundsTab, {
      props: {
        data: demoRewindRounds({ connected: false }),
        lineup1: "Kestrel",
        lineup2: "Ironside",
        canRewind: true,
        rewinding: true,
        target: 16,
      },
    });

    expect(wrapper.text()).toContain("9/10 connected");
    const restore = wrapper
      .findAll("button")
      .find((button) => button.text() === "Restore Round 16");
    expect(restore?.attributes("disabled")).toBeDefined();
  });
});

describe("the Rounds tab's guards", () => {
  it("previews Bring Back instead of restoring past a missing player", async () => {
    const wrapper = await mountSuspended(MatchRoundsTab, {
      props: {
        data: demoRewindRounds({ live: 16, undoneFrom: 16, connected: false }),
        lineup1: "Kestrel",
        lineup2: "Ironside",
        canRewind: true,
      },
    });

    const bringBack = wrapper
      .findAll("button")
      .find((button) => button.text() === "Bring Back");
    await bringBack!.trigger("click");
    expect(wrapper.emitted("restore")).toBeUndefined();
    expect(wrapper.emitted("update:target")?.at(-1)).toEqual([17]);

    await wrapper.setProps({ rewinding: true, target: 17 });
    const restore = wrapper
      .findAll("button")
      .find((button) => button.text() === "Restore Round 17");
    expect(restore?.attributes("disabled")).toBeDefined();
  });

  it("leaves the preview alone when Escape belongs to an open dialog", async () => {
    const wrapper = await mountSuspended(MatchRoundsTab, {
      props: {
        data: demoRewindRounds({ connected: true }),
        lineup1: "Kestrel",
        lineup2: "Ironside",
        canRewind: true,
        rewinding: true,
        target: 14,
      },
    });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wrapper.emitted("update:rewinding")).toBeUndefined();

    dialog.remove();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wrapper.emitted("update:rewinding")?.at(-1)).toEqual([false]);
  });
});

describe("the demo scoreboard", () => {
  it("is drawn inert, so the real player menus can't act on fake players", async () => {
    const wrapper = await mountSuspended(DemoScoreboard, {
      props: { data: demoRewindRounds() },
      global: { stubs: { LineupOverview: true } },
    });
    expect(wrapper.find("[inert]").exists()).toBe(true);
    expect(wrapper.find("[inert] lineup-overview-stub").exists()).toBe(true);
  });
});

describe("the FAQ", () => {
  it("draws every part and its figures for a player", async () => {
    useAuthStore().me = undefined;
    const wrapper = await mountSuspended(FaqContent);
    const text = wrapper.text();
    for (const heading of [
      "Something Went Wrong?",
      "Restoring a Round",
      "Fixing the Veto",
      "Playing Here",
      "Tournaments",
      "Joining a Tournament",
    ]) {
      expect(text).toContain(heading);
    }
    expect(wrapper.find("#restore-wait").exists()).toBe(true);
    expect(text).toContain("Rewind to Step 3 · Kestrel Picks Again");
    expect(text).not.toContain("For Administrators");
    expect(wrapper.html()).not.toContain("docs.5stack.gg");
  });

  it("adds hosting and the docs for an administrator", async () => {
    useAuthStore().me = {
      steam_id: "1",
      role: e_player_roles_enum.administrator,
    } as never;
    const wrapper = await mountSuspended(FaqContent);
    expect(wrapper.text()).toContain("For Administrators");
    expect(wrapper.html()).toContain("docs.5stack.gg/install/");
    useAuthStore().me = undefined;
  });

  it("draws only the asked-for section in the dialog", async () => {
    const wrapper = await mountSuspended(FaqContent, {
      props: { only: "veto-fix" },
    });
    expect(wrapper.find("#veto-fix").exists()).toBe(true);
    expect(wrapper.find("#restore").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Part 1 of 5");
  });
});

describe("searching the FAQ", () => {
  async function searchFor(query: string) {
    let found: string[] = [];
    await mountSuspended(
      defineComponent({
        setup() {
          found = useFaqSearch()
            .search(query)
            .map((hit) => hit.id);
          return () => h("div");
        },
      }),
    );
    return found;
  }

  it("finds the fix an organizer would describe in their own words", async () => {
    expect((await searchFor("server crashed")).slice(0, 2)).toEqual(
      expect.arrayContaining(["restore", "server"]),
    );
    expect((await searchFor("wrong map"))[0]).toBe("veto-fix");
    expect(await searchFor("go back a round")).toContain("restore");
    expect((await searchFor("restore round"))[0]).toBe("restore");
    expect((await searchFor("redo veto"))[0]).toBe("veto-fix");
    expect(await searchFor("team didn't check in")).toContain("t-check-in");
    expect((await searchFor("reset winner"))[0]).toBe("t-results");
    expect(await searchFor("add a substitute")).toContain("t-roster");
  });
});
