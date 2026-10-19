import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SystemUpdate from "~/layouts/components/SystemUpdate.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate } }),
}));

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});
async function mountUpdates(value: string) {
  useApplicationSettingsStore().settings = [{ name: "updates", value }];
  const wrapper = await mountSuspended(SystemUpdate);
  unmount = () => wrapper.unmount();
  return wrapper;
}
describe("source-specific update notice", () => {
  it("retains selected image provenance for the update dialog", async () => {
    const rows = [
      {
        service: "api",
        currentImage: "ghcr.io/example/api:testing",
        targetImage: "ghcr.io/example/api:testing",
        currentVersion: "sha256:old",
        newVersion: "sha256:new",
        source: "custom",
        canUpdate: true,
      },
    ];
    const wrapper = await mountUpdates(JSON.stringify(rows));
    expect((wrapper.vm as any).updates).toEqual(rows);
    expect((wrapper.vm as any).hasServiceUpdate).toBe(true);
    expect((wrapper.vm as any).hasPanelUpdate).toBe(false);
  });
  it("does not offer a service restart for a panel-only host update", async () => {
    const wrapper = await mountUpdates(
      JSON.stringify([
        { service: "panel", repository: "example/panel", ref: "testing" },
      ]),
    );
    expect((wrapper.vm as any).hasServiceUpdate).toBe(false);
    expect((wrapper.vm as any).hasPanelUpdate).toBe(true);
  });
  it("ignores malformed cached update data", async () => {
    const wrapper = await mountUpdates("invalid-json");
    expect((wrapper.vm as any).updates).toEqual([]);
    expect(wrapper.find("button").exists()).toBe(false);
  });
  it("runs the selected-source update action through the configured Apollo client", async () => {
    const wrapper = await mountUpdates(JSON.stringify([{ service: "api" }]));
    mutate
      .mockReset()
      .mockResolvedValue({ data: { updateServices: { success: true } } });
    await (wrapper.vm as any).updateServices();
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
