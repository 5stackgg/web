import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupPreview from "~/components/utility/UtilityLineupPreview.vue";
import UtilityPlaybookEditor from "~/components/utility/UtilityPlaybookEditor.vue";
import { provideUtilityCardViews } from "~/composables/useUtilityCardViews";
import type { UtilityLineup } from "~/types/utility";

const lineup = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  visibility: "Public",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  tags: [],
} as unknown as UtilityLineup;

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn(async () => ({
      data: { utility_lineups: [lineup], teams_by_pk: null },
    })),
    mutate: vi.fn(async () => ({ data: {} })),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  hasMeshForMap: async () => true,
}));

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
let wrapper: Wrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

// On a phone the card these sit in is a sheet, and a drag that starts on
// anything in it moves the sheet -- unless the thing says it is dragged for
// its own sake.
describe("what is dragged for itself inside the sheet", () => {
  it("keeps the 3D throw's camera to the finger that turns it", async () => {
    wrapper = await mountSuspended(UtilityLineupPreview, {
      props: { lineup },
      global: { stubs: { UtilityLineupViewer3D: true } },
      attachTo: document.body,
    });
    await flushPromises();

    const viewer = wrapper.findComponent({ name: "UtilityLineupViewer3D" });
    expect(viewer.exists()).toBe(true);
    expect(viewer.element.closest("[data-no-sheet-drag]")).not.toBeNull();
  });

  it("keeps an execute's step to the grip that reorders it", async () => {
    wrapper = await mountSuspended(
      defineComponent({
        setup() {
          const layers = provideUtilityCardViews();
          return () =>
            h("div", [
              h("div", { ref: layers.base }),
              h("div", { ref: layers.top }),
              h(UtilityPlaybookEditor, {
                open: true,
                mapName: "de_mirage",
                playbook: {
                  id: "p-1",
                  name: "A split",
                  description: null,
                  map_name: "de_mirage",
                  side: "T",
                  team_id: null,
                  visibility: "Private",
                } as any,
                steps: [
                  {
                    id: "s-1",
                    playbook_id: "p-1",
                    utility_lineup_id: lineup.id,
                    step_order: 0,
                    offset_ms: 0,
                    assigned_steam_id: null,
                    note: null,
                  },
                ],
              }),
            ]);
        },
      }),
      { attachTo: document.body },
    );
    await flushPromises();
    await vi.waitFor(
      () => expect(document.querySelector("[data-step-grip]")).not.toBeNull(),
      { timeout: 3000 },
    );

    const grip = document.querySelector("[data-step-grip]")!;
    expect(grip.closest("[data-no-sheet-drag]")).not.toBeNull();
  });
});
