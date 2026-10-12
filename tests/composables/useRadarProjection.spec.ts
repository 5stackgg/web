import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import {
  useRadarProjection,
  type RadarPoint,
} from "~/composables/useRadarProjection";
import metadata from "~/public/radars/metadata.json";

vi.mock("~/utilities/stageRadars.json", () => ({
  default: {
    rush_001: "0a1b2c3d",
    de_mirage: "4e5f6a7b",
    de_dust2_night: "8c9d0e1f",
  },
}));

const RUSH = "/radars/stage/rush_001@2x.webp?v=0a1b2c3d";

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function mountProjection(
  map: string,
  options: Parameters<typeof useRadarProjection>[1] = {},
) {
  const mapName = ref(map);
  let state!: ReturnType<typeof useRadarProjection>;
  await mountSuspended(
    defineComponent({
      setup() {
        state = useRadarProjection(mapName, options);
        return () => h("div");
      },
    }),
  );
  await flushPromises();
  return { state, mapName };
}

const ROOM_204_SPAWNS: RadarPoint[] = [
  { x: -8183, y: -4170 },
  { x: -10708.24, y: -4254.48 },
];

describe("useRadarProjection with volumes", () => {
  it("gives a caller that passes nothing the whole-map radar", async () => {
    const { state } = await mountProjection("rush_001");

    expect(state.volumes.value).toHaveLength(20);
    expect(state.activeVolume.value).toBeNull();
    expect(state.calibration.value?.resolution).toBe(18.910156);
    expect(state.radarSrc.value).toBe(RUSH);
  });

  it("follows the points into their room", async () => {
    const points = ref<RadarPoint[]>(ROOM_204_SPAWNS);
    const { state } = await mountProjection("rush_001", {
      volumePoints: () => points.value,
    });

    expect(state.activeVolume.value?.name).toBe("room204");
    expect(state.calibration.value?.resolution).toBe(2.90625);
    expect(state.radarSrc.value).toBe("/radars/rush_001_room204.png");

    const px = state.projectCalibrated(ROOM_204_SPAWNS[0]);
    expect(px!.x).toBeGreaterThan(0);
    expect(px!.x).toBeLessThan(1024);
    expect(px!.y).toBeGreaterThan(0);
    expect(px!.y).toBeLessThan(1024);

    points.value = [{ x: -2539, y: -8231.5 }];
    expect(state.radarSrc.value).toBe("/radars/rush_001_convoy.png");

    points.value = [];
    expect(state.activeVolume.value).toBeNull();
    expect(state.radarSrc.value).toBe(RUSH);
  });

  it("lets a manual room win until the map changes", async () => {
    const { state, mapName } = await mountProjection("rush_001", {
      volumePoints: () => ROOM_204_SPAWNS,
    });

    state.volumeOverride.value = "roomparty";
    expect(state.radarSrc.value).toBe("/radars/rush_001_roomparty.png");

    state.volumeOverride.value = "no_such_room";
    expect(state.activeVolume.value?.name).toBe("room204");

    state.volumeOverride.value = "roomparty";
    mapName.value = "de_mirage";
    await flushPromises();

    expect(state.volumeOverride.value).toBeNull();
    expect(state.volumes.value).toEqual([]);
    expect(state.activeVolume.value).toBeNull();
    expect(state.radarSrc.value).toBe(
      "/radars/stage/de_mirage@2x.webp?v=4e5f6a7b",
    );
    expect(state.calibration.value?.resolution).toBe(5.02);
  });
});

describe("useRadarProjection images", () => {
  it("draws a night map in its own image on its day map's calibration", async () => {
    const { state } = await mountProjection("de_dust2_night");

    expect(state.calibration.value?.resolution).toBe(4.4);
    expect(state.radarSrc.value).toBe(
      "/radars/stage/de_dust2_night@2x.webp?v=8c9d0e1f",
    );
  });

  it("gives the 1x image when asked, and the generic radar where there is no bake", async () => {
    const { state, mapName } = await mountProjection("de_mirage", {
      retina: false,
    });
    expect(state.radarSrc.value).toBe(
      "/radars/stage/de_mirage.webp?v=4e5f6a7b",
    );

    mapName.value = "de_cache";
    await flushPromises();
    expect(state.radarSrc.value).toBe("/radars/de_cache.png");
  });
});
