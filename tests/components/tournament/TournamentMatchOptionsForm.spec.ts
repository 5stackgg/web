import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentMatchOptionsForm from "~/components/tournament/TournamentMatchOptionsForm.vue";

const tournament = (status: string, substitutes_enabled = true) => ({
  id: "tournament-1",
  status,
  auto_start: true,
  scheduling_mode: "auto",
  substitutes_enabled,
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 12,
    best_of: 1,
    map_pool: { id: "pool-1", maps: [] },
  },
});

describe("TournamentMatchOptionsForm substitutes switch", () => {
  let unmount: (() => void) | null = null;

  afterEach(() => {
    unmount?.();
    unmount = null;
  });

  async function substitutesSwitch(status: string, enabled = true) {
    const wrapper = await mountSuspended(TournamentMatchOptionsForm, {
      props: { tournament: tournament(status, enabled) },
      global: {
        stubs: {
          MatchOptions: { template: "<div><slot /></div>" },
          SettingsSaveBar: true,
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const row = wrapper
      .findAll("div.flex.flex-row")
      .find((div) => div.text().includes("Allow Substitutes"));
    expect(row).toBeDefined();
    return row!;
  }

  it("can still be turned off while registration is open", async () => {
    const row = await substitutesSwitch("RegistrationOpen");

    expect(row.find("button[role='switch']").attributes("disabled")).toBe(
      undefined,
    );
    expect(row.text()).not.toContain("once registration has closed");
  });

  it("is locked on once registration has closed", async () => {
    const row = await substitutesSwitch("Live");

    expect(
      row.find("button[role='switch']").attributes("disabled"),
    ).toBeDefined();
    expect(row.text()).toContain("once registration has closed");
  });

  it("can still be turned back on after registration has closed", async () => {
    const row = await substitutesSwitch("Live", false);

    expect(row.find("button[role='switch']").attributes("disabled")).toBe(
      undefined,
    );
  });
});
