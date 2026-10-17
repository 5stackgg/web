import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import InspectorCs2 from "~/components/game-server-nodes/InspectorCs2.vue";

const PINNED = 25966348;

const node = {
  id: "node-1",
  label: "Frankfurt 1",
  status: "Online",
  enabled: true,
  gpu: false,
  region: "eu",
};

afterEach(() => {
  document.body.innerHTML = "";
});

async function mountCs2(overrides: Record<string, unknown>) {
  const wrapper = await mountSuspended(InspectorCs2, {
    attachTo: document.body,
    props: {
      node: { ...node, ...overrides } as any,
      gameVersions: [
        {
          build_id: PINNED,
          version: "1.41.9.0",
          current: false,
          updated_at: "2026-10-01T00:00:00Z",
        },
        {
          build_id: 25999999,
          version: "public",
          current: true,
          updated_at: "2026-10-16T00:00:00Z",
        },
      ],
      pluginVersions: [],
      pluginRuntime: "counterstrikesharp",
      supportsPinning: true,
      pinBuild: (overrides.pin_build_id as number | null) ?? null,
      pinPlugin: null,
      currentBuildId: 25999999,
      nextStep: null,
      logOpen: false,
    },
  });
  await flushPromises();
  return wrapper;
}

// A failed pinned update deletes the install, so the node reports no build.
// The pin picker is the only place to unpin; it has to render without a build.
describe("InspectorCs2 pinned build without an install", () => {
  it("keeps the pin picker, showing the pinned version", async () => {
    const wrapper = await mountCs2({ build_id: null, pin_build_id: PINNED });
    expect(
      wrapper
        .find('[aria-label="CS2 Build"], button[role="combobox"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("1.41.9.0");
  });

  it("still offers to install CS2", async () => {
    const wrapper = await mountCs2({ build_id: null, pin_build_id: PINNED });
    expect(wrapper.text()).toContain("Install CS2");
  });

  it("shows only the install button with no build and no pin", async () => {
    const wrapper = await mountCs2({ build_id: null, pin_build_id: null });
    expect(wrapper.find('[aria-label="CS2 build"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Install CS2");
  });
});
