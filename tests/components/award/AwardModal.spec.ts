import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import AwardModal from "~/components/award/AwardModal.vue";

const manualTournamentGrant = {
  id: "manual-tournament-1",
  source: "manual",
  placement: null,
  placement_tier: null,
  tournament_id: "tournament-1",
  created_at: "2026-04-05T12:00:00Z",
  note: null,
  award: {
    id: "award-spirit",
    name: "Spirit of the Cup",
    description: null,
    tier: "special",
    silhouette: null,
    image_url: null,
  },
  tournament: {
    name: "Spring Cup",
    start: "2026-03-01T12:00:00Z",
    stages: [],
  },
  tournament_award: null,
};

describe("AwardModal manual grant made inside a tournament", () => {
  let unmount: (() => void) | null = null;

  afterEach(() => {
    unmount?.();
    unmount = null;
  });

  async function openModal() {
    const wrapper = await mountSuspended(AwardModal, {
      props: { open: true, award: manualTournamentGrant },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    return dialog!;
  }

  it("is titled and dated by the award, not the tournament", async () => {
    const dialog = await openModal();

    expect(dialog.querySelector("h2")?.textContent?.trim()).toBe(
      "Spirit of the Cup",
    );
    expect(dialog.textContent).toContain("APR 5, 2026");
    expect(dialog.textContent).not.toContain("MAR 1, 2026");
  });

  it("still links to both the tournament and the award", async () => {
    const dialog = await openModal();

    expect(
      dialog.querySelector('a[href="/tournaments/tournament-1"]'),
    ).not.toBeNull();
    expect(
      dialog.querySelector('a[href="/awards/award-spirit"]'),
    ).not.toBeNull();
  });
});
