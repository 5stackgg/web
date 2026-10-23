import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import InspectorCs2 from "~/components/game-server-nodes/InspectorCs2.vue";
import InspectorCsgo from "~/components/game-server-nodes/InspectorCsgo.vue";

const node = {
  id: "node-1",
  label: "Frankfurt 1",
  status: "Online",
  enabled: true,
  gpu: false,
  region: "eu",
  lan_ip: "10.0.0.4",
  build_id: 25966348,
};

const versions = [
  {
    build_id: 25971020,
    version: "public",
    current: true,
    updated_at: "2026-10-18T00:00:00Z",
  },
];

afterEach(() => {
  document.body.innerHTML = "";
});

async function mountCs2(overrides: Record<string, unknown>) {
  const wrapper = await mountSuspended(InspectorCs2, {
    attachTo: document.body,
    props: {
      node: { ...node, ...overrides } as any,
      gameVersions: versions,
      pluginVersions: [],
      pluginRuntime: "counterstrikesharp",
      supportsPinning: true,
      pinBuild: null,
      pinPlugin: null,
      currentBuildId: 25971020,
      nextStep: null,
      csgoShown: false,
    },
  });
  await flushPromises();
  return wrapper;
}

async function mountCsgo(overrides: Record<string, unknown>, latest: unknown) {
  const wrapper = await mountSuspended(InspectorCsgo, {
    attachTo: document.body,
    props: {
      node: { ...node, ...overrides } as any,
      latestBuildId: latest as any,
    },
  });
  await flushPromises();
  return wrapper;
}

async function menuItems(wrapper: { get: (selector: string) => any }) {
  await wrapper
    .get('button[aria-haspopup="menu"]')
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
}

const item = (items: Array<HTMLElement>, label: string) =>
  items.find((entry) => entry.textContent?.trim() === label);

describe("CS2 section", () => {
  it("says it's up to date with the installed build", async () => {
    const wrapper = await mountCs2({ build_id: 25971020 });
    expect(wrapper.text()).toContain("Up to date");
    expect(wrapper.text()).toContain("25971020");
  });

  it("offers the update with the build it moves to", async () => {
    const wrapper = await mountCs2({});
    expect(wrapper.text()).toContain("Update available");
    expect(wrapper.text()).toContain("On 25966348, update to 25971020");
    expect(wrapper.find("button.gsn-st-update").exists()).toBe(true);
  });

  it("leaves the update to the header when it is the node's next step", async () => {
    const wrapper = await mountCs2({});
    await wrapper.setProps({ nextStep: "update_cs2" });
    expect(wrapper.find("button.gsn-st-update").exists()).toBe(false);
  });

  it("shows progress and the step while updating, and opens the log", async () => {
    const wrapper = await mountCs2({
      update_status: "Downloading depot 2/3 41%",
    });
    expect(wrapper.text()).toContain("Updating to 25971020");
    expect(wrapper.text()).toContain("41%");
    expect(wrapper.text()).toContain("Downloading depot 2/3");

    const watch = wrapper
      .findAll("button")
      .find((button) => button.text() === "Watch log");
    await watch!.trigger("click");
    expect(wrapper.emitted("openLog")).toHaveLength(1);
  });

  it("shows a failed update's last log lines", async () => {
    const wrapper = await mountCs2({
      update_failed_at: new Date().toISOString(),
      update_error:
        "[depot 2347773] 2731 MB / 3010 MB (90%) downloaded\nDepot 2347773 download did not complete. Exiting.",
    });
    expect(wrapper.text()).toContain("Update failed");
    expect(wrapper.text()).toContain("Still on 25966348");
    expect(wrapper.find(".gsn-err").findAll("span")).toHaveLength(2);
    expect(wrapper.text()).toContain("Open log");
  });

  it("asks to remove CS2 from its menu", async () => {
    const wrapper = await mountCs2({ accepting_new_matches: false });

    item(await menuItems(wrapper), "Remove CS2")!.click();
    await flushPromises();

    expect(wrapper.emitted("remove")).toHaveLength(1);
  });

  it("offers no removal when CS2 isn't on the node", async () => {
    const wrapper = await mountCs2({ build_id: null });
    expect(item(await menuItems(wrapper), "Remove CS2")).toBeUndefined();
  });

  it("can't remove CS2 while the node accepts matches", async () => {
    const wrapper = await mountCs2({});
    const remove = (await menuItems(wrapper)).find((entry) =>
      entry.textContent?.includes("Remove CS2"),
    );
    expect(remove!.hasAttribute("data-disabled")).toBe(true);
    expect(remove!.textContent).toContain(
      "Turn off Matchmaking or Accepting matches first",
    );
  });

  it("can't remove CS2 while its update runs", async () => {
    const wrapper = await mountCs2({
      accepting_new_matches: false,
      update_status: "Downloading 41%",
    });
    const remove = item(await menuItems(wrapper), "Remove CS2");
    expect(remove!.hasAttribute("data-disabled")).toBe(true);
  });

  it("says Removing, not Installing, while CS2 is removed", async () => {
    const wrapper = await mountCs2({
      build_id: null,
      update_status: "Removing",
    });
    expect(wrapper.find(".gsn-st").text()).toContain("Removing");
    expect(wrapper.text()).not.toContain("Installing");
    expect(wrapper.text()).toContain("Watch log");
  });

  it("flags an unsupported plugin beside its picker, without the build", async () => {
    const wrapper = await mountCs2({ plugin_supported: false });
    const flag = wrapper.find(".gsn-flag");
    expect(flag.text()).toBe("Not supported");
    expect(
      flag.element.closest(".gsn-v")?.querySelector("button"),
    ).toBeTruthy();
    expect(wrapper.text()).not.toContain("on build");
  });

  it("no longer lists CS:GO in the section", async () => {
    const wrapper = await mountCs2({ csgo_build_id: 12426148 });
    expect(wrapper.text()).not.toContain("CS:GO");
  });

  // Each lineup preview a GPU-only node renders boots a CS2 server on it.
  it("offers CS2 on a GPU-only node only while it renders", async () => {
    const gpuOnly = {
      gpu: true,
      enabled_for_match_making: false,
      region: null,
      build_id: null,
    };
    const actions = 'button[aria-label="CS2 actions"]';

    const rendering = await mountCs2({
      ...gpuOnly,
      gpu_rendering_enabled: true,
    });
    expect(rendering.text()).toContain("Install CS2");
    expect(rendering.find(actions).exists()).toBe(true);

    const off = await mountCs2({ ...gpuOnly, gpu_rendering_enabled: false });
    expect(off.text()).toContain("Rendering is off");
    expect(off.text()).not.toContain("Install CS2");
    expect(off.find(actions).exists()).toBe(false);
  });
});

describe("CS:GO section", () => {
  it("says when CS:GO is behind the latest build", async () => {
    const wrapper = await mountCsgo({ csgo_build_id: 12426148 }, 12430215);
    expect(wrapper.text()).toContain("Update available");
    expect(wrapper.text()).toContain("On 12426148, update to 12430215");
  });

  it("is up to date on the latest build", async () => {
    const wrapper = await mountCsgo({ csgo_build_id: 12426148 }, "12426148");
    expect(wrapper.text()).toContain("Up to date");
  });

  it("reads its own update, not CS2's", async () => {
    const wrapper = await mountCsgo(
      {
        csgo_build_id: 12426148,
        update_status: "Downloading depot 2/3 41%",
        csgo_update_status: "Initializing",
      },
      12426148,
    );
    expect(wrapper.text()).toContain("Updating to 12426148");
    expect(wrapper.text()).toContain("Initializing");
  });

  it("asks to remove CS:GO from its menu", async () => {
    const wrapper = await mountCsgo({ csgo_build_id: 12426148 }, 12426148);

    item(await menuItems(wrapper), "Remove CS:GO")!.click();
    await flushPromises();

    expect(wrapper.emitted("remove")).toHaveLength(1);
  });

  it("says Removing while CS:GO is removed", async () => {
    const wrapper = await mountCsgo(
      { csgo_build_id: null, csgo_update_status: "Removing" },
      12426148,
    );
    expect(wrapper.find(".gsn-st").text()).toContain("Removing");
    expect(wrapper.text()).not.toContain("Installing");
  });
});
