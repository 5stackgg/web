import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const region = (value: string, description: string, is_lan: boolean) => ({
  value,
  description,
  is_lan,
  status: "Online",
  has_node: true,
});

const tournament = (regions: string[]) => ({
  id: "tournament-1",
  status: "Setup",
  options: {
    id: "options-1",
    type: "Competitive",
    mr: 12,
    best_of: 1,
    tv_delay: 115,
    veto_pick_timeout: 60,
    region_veto: false,
    regions,
    check_in_setting: "Captains",
    ready_setting: "Players",
    tech_timeout_setting: "Admin",
    match_mode: "auto",
    knife_round: true,
    default_models: true,
    overtime: true,
    coaches: true,
    number_of_substitutes: 0,
    timeout_setting: "Admin",
    map_pool: { id: "pool-1", maps: [] },
  },
});

let unmount: (() => void) | null = null;

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];

  useApplicationSettingsStore().availableRegions = [
    region("eu", "Europe", false),
    region("lan", "Main Hall", true),
  ];
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
});

async function mountStageForm(regions: string[]) {
  const wrapper = await mountSuspended(TournamentStageForm, {
    props: { order: 1, tournament: tournament(regions) },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function regionCard(wrapper: Awaited<ReturnType<typeof mountStageForm>>) {
  const card = wrapper
    .findAll("div.p-6.space-y-6")
    .find((div) => div.text().includes("Region Settings"));
  expect(card).toBeDefined();
  return card!;
}

function regionTrigger(wrapper: Awaited<ReturnType<typeof mountStageForm>>) {
  return regionCard(wrapper).find("button[role='combobox']");
}

async function openRegions(
  wrapper: Awaited<ReturnType<typeof mountStageForm>>,
) {
  await regionTrigger(wrapper).trigger("pointerdown", {
    button: 0,
    pointerType: "mouse",
  });
  await flushPromises();

  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="option"]'),
  ).map((option) => option.textContent?.trim());
}

function lanSwitch(wrapper: Awaited<ReturnType<typeof mountStageForm>>) {
  const row = regionCard(wrapper)
    .findAll("div.flex.justify-between.items-center")
    .find((div) => div.text().includes("LAN Match"));
  return row?.find("button[role='switch']");
}

describe("TournamentStageForm region settings", () => {
  it("shows the inherited online region as the current selection", async () => {
    const wrapper = await mountStageForm(["eu"]);

    expect(regionTrigger(wrapper).text()).toContain("Europe");
  });

  it("shows the inherited LAN region as the current selection", async () => {
    const wrapper = await mountStageForm(["lan"]);

    expect(regionTrigger(wrapper).text()).toContain("Main Hall");
    expect(lanSwitch(wrapper)?.attributes("aria-checked")).toBe("true");
    expect((wrapper.vm as any).isDirty).toBe(false);
  });

  it("offers the LAN regions once the LAN switch is on", async () => {
    const wrapper = await mountStageForm(["eu"]);

    expect(await openRegions(wrapper)).toEqual(["Europe"]);

    await lanSwitch(wrapper)!.trigger("click");
    await flushPromises();

    expect(await openRegions(wrapper)).toEqual(["Main Hall"]);
    expect((wrapper.vm as any).form.values.regions).toEqual(["lan"]);
  });

  it("turns region veto off while the stage is on LAN", async () => {
    const wrapper = await mountStageForm(["eu"]);

    (wrapper.vm as any).form.setFieldValue("region_veto", true);
    await flushPromises();

    await lanSwitch(wrapper)!.trigger("click");
    await flushPromises();

    expect((wrapper.vm as any).form.values.region_veto).toBe(false);
  });

  it("hides the LAN switch when no LAN region exists", async () => {
    useApplicationSettingsStore().availableRegions = [
      region("eu", "Europe", false),
      region("na", "North America", false),
    ];

    const wrapper = await mountStageForm(["eu"]);

    expect(lanSwitch(wrapper)).toBeUndefined();
  });
});
