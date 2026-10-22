import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import InspectorGpu from "~/components/game-server-nodes/InspectorGpu.vue";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate: vi.fn() } }),
}));

afterEach(() => {
  document.body.innerHTML = "";
});

const mountGpu = async (cs2_video_settings: Record<string, number> | null) => {
  const wrapper = await mountSuspended(InspectorGpu, {
    attachTo: document.body,
    props: {
      node: {
        id: "gpu-1",
        status: "Online",
        enabled: true,
        gpu: true,
        gpu_info: [],
        cs2_video_settings,
      },
    } as any,
  });
  await flushPromises();
  return wrapper.get('[data-testid="gpu-video"]');
};

describe("InspectorGpu video settings", () => {
  it("says auto leaves the settings to CS2", async () => {
    const video = await mountGpu(null);

    expect(video.text()).toContain("Auto (default)");
    expect(video.text()).toContain("on first launch");
    expect(video.find("dl").exists()).toBe(false);
  });

  it("reads out a preset's quality, resolution and anti-aliasing", async () => {
    const video = await mountGpu({
      "setting.msaa_samples": 4,
      "setting.r_csgo_cmaa_enable": 0,
      "setting.r_texturefilteringquality": 5,
      "setting.shaderquality": 1,
      "setting.videocfg_shadow_quality": 3,
      "setting.videocfg_dynamic_shadows": 1,
      "setting.videocfg_texture_detail": 2,
      "setting.videocfg_particle_detail": 2,
      "setting.videocfg_ao_detail": 2,
      "setting.defaultres": 2560,
      "setting.defaultresheight": 1440,
    });

    expect(video.text()).toContain("High");
    expect(video.text()).toContain("1440p");
    expect(video.text()).toContain("MSAA 4x");
  });

  it("calls tuned settings custom and names CMAA when MSAA is off", async () => {
    const video = await mountGpu({
      "setting.msaa_samples": 0,
      "setting.r_csgo_cmaa_enable": 1,
      "setting.defaultres": 1920,
      "setting.defaultresheight": 1080,
    });

    expect(video.text()).toContain("Custom");
    expect(video.text()).toContain("1080p");
    expect(video.text()).toContain("CMAA2");
  });
});
