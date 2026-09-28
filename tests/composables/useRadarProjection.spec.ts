import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import {
  useRadarProjection,
  type RadarPoint,
} from "~/composables/useRadarProjection";
import metadata from "~/public/radars/metadata.json";

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
    expect(state.radarSrc.value).toBe("/radars/rush_001.png");
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
    expect(state.radarSrc.value).toBe("/radars/rush_001.png");
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
    expect(state.radarSrc.value).toBe("/radars/de_mirage.png");
    expect(state.calibration.value?.resolution).toBe(5.02);
  });
});
