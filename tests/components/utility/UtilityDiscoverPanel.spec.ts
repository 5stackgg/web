import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityDiscoverPanel from "~/components/utility/UtilityDiscoverPanel.vue";
import type { UtilityPanelBoard } from "~/utilities/utilityDisplay";

const DISCOVERY_ID = "5d3c4b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";

function result(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    rank: 0,
    technique: "Jump",
    move_direction: null,
    move_gait: null,
    jump_throw: true,
    measured: true,
    strength: "Full",
    stand_x: -300,
    stand_y: -1200,
    stand_z: -168,
    eye_z: -78,
    pitch: -20.5,
    yaw: 95.25,
    predicted_land_x: -280,
    predicted_land_y: -400,
    predicted_land_z: -168,
    predicted_distance: 12,
    predicted_spread: 18,
    predicted_bounces: 1,
    status,
    land_x: status === "verified" ? -276 : null,
    land_y: status === "verified" ? -404 : null,
    land_z: status === "verified" ? -168 : null,
    distance: status === "verified" ? 5.6 : null,
    bounces: 1,
    flight_time_ms: 2100,
    forgiveness: status === "verified" ? 22 : null,
    grenades: 5,
    path:
      status === "verified"
        ? [
            { x: -300, y: -1200, z: -100 },
            { x: -276, y: -404, z: -168 },
          ]
        : null,
    is_new: true,
    utility_lineup_id: null,
    ...extra,
  };
}

const discovery = {
  id: DISCOVERY_ID,
  map_name: "de_mirage",
  status: "Verifying",
  predicted: 3,
  verified: 1,
  missed: 1,
  grenades: 12,
  error: null,
  target_x: -280,
  target_y: -400,
  target_z: -168,
  radius: 64,
  area: {
    min: { x: -400, y: -1300, z: -400 },
    max: { x: -200, y: -1100, z: 400 },
  },
  techniques: [{ direction: null, gait: null, jump_throw: true }],
  strengths: ["Full"],
  created_at: "2026-10-11T10:00:00Z",
  started_at: "2026-10-11T10:00:05Z",
  finished_at: null,
  results: [
    result("r-predicted", "predicted"),
    result("r-verified", "verified"),
    result("r-missed", "missed"),
  ],
};

const calls: { mutate: any[]; query: any[] } = { mutate: [], query: [] };

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: ({ variables }: any) => ({
      subscribe: ({ next }: any) => {
        setTimeout(() =>
          next({
            data: variables?.id
              ? { utility_discoveries_by_pk: discovery }
              : { utility_discoveries: [] },
          }),
        );
        return { unsubscribe() {} };
      },
    }),
    query: async ({ variables }: any) => {
      calls.query.push(variables);
      if (variables?.x !== undefined) {
        return {
          data: {
            previewUtilitySmoke: {
              x: variables.x,
              y: variables.y,
              z: -168,
              ox: null,
              oy: null,
              oz: null,
              vs: null,
              dx: null,
              dy: null,
              dz: null,
              den: null,
            },
          },
        };
      }
      return { data: { utility_lineups: [{ origin_z: -150 }] } };
    },
    mutate: async ({ variables }: any) => {
      calls.mutate.push(variables);
      return {
        data: {
          discoverUtilityLineups: {
            discovery_id: DISCOVERY_ID,
            status: "Queued",
            predicted: 3,
            message: null,
          },
        },
      };
    },
  }),
}));

const auth = reactive({ me: { steam_id: "76561198000000001" } });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

beforeEach(() => {
  calls.mutate = [];
  calls.query = [];
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
});

async function mount(route = "/utility/de_mirage?tab=discover") {
  const wrapper = await mountSuspended(UtilityDiscoverPanel, {
    route,
    props: { mapName: "de_mirage" },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

function lastBoard(wrapper: any): UtilityPanelBoard {
  const boards = wrapper.emitted("board") as Array<[UtilityPanelBoard]>;
  return boards[boards.length - 1][0];
}

describe("UtilityDiscoverPanel", () => {
  it("puts a picked landing on its floor and then asks for the area", async () => {
    const wrapper = await mount();

    lastBoard(wrapper).onPick!({ x: -280, y: -400, z: 0 });
    await flushPromises();

    expect(calls.query.at(-1)).toMatchObject({
      map_name: "de_mirage",
      x: -280,
      y: -400,
    });
    const board = lastBoard(wrapper);
    expect(board.picking).toBe(true);
    expect(board.markers!.find((m) => m.key === "landing")!.point.z).toBe(-168);
    expect(board.shapes!.map((shape) => shape.key)).toEqual(
      expect.arrayContaining(["smoke", "radius"]),
    );
  });

  it("sends the landing, a band around the guessed height, and the ways picked", async () => {
    const wrapper = await mount();

    lastBoard(wrapper).onPick!({ x: -280, y: -400, z: 0 });
    await flushPromises();
    lastBoard(wrapper).onPick!({ x: -300, y: -1200, z: 0 });
    await flushPromises();

    expect(lastBoard(wrapper).markers!.map((m) => m.key)).toEqual([
      "landing",
      "area-a",
      "area-b",
    ]);

    const submit = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Discover throws"))!;
    await submit.trigger("click");
    await flushPromises();

    const sent = calls.mutate.at(-1);
    expect(sent).toMatchObject({
      map_name: "de_mirage",
      target_z: -168,
      radius: 64,
      strengths: ["Full"],
      techniques: [
        { direction: null, gait: null, jump_throw: false },
        { direction: null, gait: null, jump_throw: true },
      ],
    });
    expect(sent.area.max_x - sent.area.min_x).toBe(512);
    expect(sent.area.min_z).toBe(-150 - 384);
    expect(sent.area.max_z).toBe(-150 + 384);
  });

  it("shows an open search's throws on the board instead of picking", async () => {
    const wrapper = await mount(
      `/utility/de_mirage?tab=discover&discover=${DISCOVERY_ID}`,
    );
    await new Promise((resolve) => setTimeout(resolve));
    await flushPromises();

    const board = lastBoard(wrapper);
    expect(board.picking).toBe(false);
    expect(board.peek).toBe(false);
    expect(board.lineups!.map((lineup) => lineup.id)).toEqual([
      "r-verified",
      "r-predicted",
    ]);
    expect(
      board.lineups!.find((lineup) => lineup.id === "r-verified")!
        .trajectory_preview,
    ).toEqual([
      [-300, -1200, -100],
      [-276, -404, -168],
    ]);
    expect(wrapper.text()).toContain("1 proposed throws missed on the server");
  });

  it("offers to save only a throw the server landed", async () => {
    const wrapper = await mount(
      `/utility/de_mirage?tab=discover&discover=${DISCOVERY_ID}`,
    );
    await new Promise((resolve) => setTimeout(resolve));
    await flushPromises();

    const rows = wrapper.findAll("li");
    await rows[0].find("button").trigger("click");
    expect(wrapper.text()).toContain("Save as lineup");

    await rows[1].find("button").trigger("click");
    expect(wrapper.text()).not.toContain("Save as lineup");
    expect(wrapper.text()).toContain("Predicted only");
  });
});
