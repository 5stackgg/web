import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityIndexPage from "~/pages/utility/index.vue";
import { leaveUtilityPage } from "~/composables/useUtilityMapHandoff";

const maps = vi.hoisted(() => ({
  tiles: null as unknown as { value: Array<Record<string, unknown>> },
}));

function tile(name: string, activeDuty: boolean) {
  return { name, label: name, patch: null, poster: null, activeDuty };
}

const FLAGGED = [
  tile("de_ancient", true),
  tile("de_dust2", true),
  tile("de_mirage", true),
  tile("de_overpass", false),
  tile("de_train", false),
];

vi.mock("~/composables/useUtilityMaps", async () => {
  const { ref } = await import("vue");
  maps.tiles = ref([]);
  return {
    useUtilityMaps: () => ({
      tiles: maps.tiles,
      counts: ref({}),
      privateCounts: ref({}),
      landings: ref({}),
      loadMaps: async () => {},
      loadCounts: async () => {},
      loadLandings: async () => {},
    }),
  };
});

vi.mock("~/components/utility/UtilityMapPreviewTile.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { tile: { type: Object, required: true } },
      setup(props, { expose }) {
        expose({ rect: () => null, src: null, shrinkFrom: () => {} });
        return () =>
          h("div", { "data-map": (props.tile as { name: string }).name });
      },
    }),
  };
});

vi.mock("~/components/utility/UtilityMapRail.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return { default: defineComponent({ render: () => h("nav") }) };
});

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 450));
  await flushPromises();
};

async function mountLibrary(tiles = FLAGGED) {
  maps.tiles.value = tiles;
  const wrapper = await mountSuspended(UtilityIndexPage);
  mounted.push(wrapper);
  await settle();
  return wrapper;
}

const shown = (wrapper: any) =>
  wrapper.findAll("[data-map]").map((el: any) => el.attributes("data-map"));

const groupButton = (wrapper: any, label: string) =>
  wrapper
    .findAll("button")
    .find((button: any) => button.text().startsWith(label));

describe("Utility Library map groups", () => {
  it("opens on the Active Duty maps, with each group's count on the switch", async () => {
    const wrapper = await mountLibrary();

    expect(shown(wrapper)).toEqual(["de_ancient", "de_dust2", "de_mirage"]);
    expect(groupButton(wrapper, "Active Duty").text()).toContain("3");
    expect(groupButton(wrapper, "Other maps").text()).toContain("2");
  });

  it("shows the other maps one tap away", async () => {
    const wrapper = await mountLibrary();

    await groupButton(wrapper, "Other maps").trigger("click");
    await settle();

    expect(shown(wrapper)).toEqual(["de_overpass", "de_train"]);
  });

  it("opens on Active Duty again on the next visit", async () => {
    const first = await mountLibrary();
    await groupButton(first, "Other maps").trigger("click");
    await settle();
    mounted.pop()?.unmount();

    const wrapper = await mountLibrary();

    expect(shown(wrapper)).toEqual(["de_ancient", "de_dust2", "de_mirage"]);
  });

  it("opens on the group that holds the map you came back from", async () => {
    leaveUtilityPage("map", "de_train", null);

    const wrapper = await mountLibrary();

    expect(shown(wrapper)).toEqual(["de_overpass", "de_train"]);
  });

  it("shows every map under All maps when no map is flagged Active Duty", async () => {
    const wrapper = await mountLibrary(
      FLAGGED.map((entry) => ({ ...entry, activeDuty: false })),
    );

    expect(shown(wrapper)).toHaveLength(5);
    expect(wrapper.text()).toContain("All maps");
    expect(groupButton(wrapper, "Active Duty")).toBeUndefined();
  });
});
