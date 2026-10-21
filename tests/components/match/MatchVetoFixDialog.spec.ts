import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchVetoFixDialog from "~/components/match/veto/MatchVetoFixDialog.vue";
import { DEMO_VETO } from "~/utilities/demoMatch";

describe("Fix the Veto", () => {
  it("rewinds from the step the organizer clicks", async () => {
    const wrapper = await mountSuspended(MatchVetoFixDialog, {
      props: {
        open: true,
        steps: DEMO_VETO,
        done: 4,
        lineup1: "Kestrel",
        lineup2: "Ironside",
        initialStep: 4,
        bestOf: 3,
      },
      attachTo: document.body,
    });
    await flushPromises();

    expect(document.body.textContent).toContain("Veto · Best of 3");
    expect(document.body.textContent).toContain(
      "Rewind to Step 4 · Ironside Chooses a Side Again",
    );

    (
      document.body.querySelector(
        'button[aria-label="Rewind to step 3"]',
      ) as HTMLElement
    ).click();
    await flushPromises();

    expect(document.body.textContent).toContain(
      "Rewind to Step 3 · Kestrel Picks Again",
    );
    expect(document.body.textContent).toContain(
      "Clears Kestrel's pick of Mirage, Ironside's side on Mirage.",
    );

    (
      Array.from(document.body.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Rewind the Veto",
      ) as HTMLElement
    ).click();

    expect(wrapper.emitted("confirm")?.at(-1)).toEqual([3]);
    wrapper.unmount();
  });

  it("starts a finished veto at the last ban, since nobody chose the Decider", async () => {
    const wrapper = await mountSuspended(MatchVetoFixDialog, {
      props: {
        open: true,
        steps: DEMO_VETO,
        done: 9,
        lineup1: "Kestrel",
        lineup2: "Ironside",
        initialStep: 9,
        bestOf: 5,
      },
      attachTo: document.body,
    });
    await flushPromises();

    expect(document.body.textContent).toContain("Veto · Best of 5");
    expect(document.body.textContent).toContain("Rewind to Step 8");
    expect(
      (
        document.body.querySelector(
          'button[aria-label="Rewind to step 9"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    wrapper.unmount();
  });

  it("can't rewind a step that hasn't been taken", async () => {
    const wrapper = await mountSuspended(MatchVetoFixDialog, {
      props: {
        open: true,
        steps: DEMO_VETO,
        done: 4,
        lineup1: "Kestrel",
        lineup2: "Ironside",
        initialStep: 9,
        bestOf: 5,
      },
      attachTo: document.body,
    });
    await flushPromises();

    expect(document.body.textContent).toContain("Rewind to Step 4");
    expect(
      (
        document.body.querySelector(
          'button[aria-label="Rewind to step 6"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    wrapper.unmount();
  });
});
