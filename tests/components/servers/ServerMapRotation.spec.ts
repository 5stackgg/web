import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";

const state = vi.hoisted(() => ({ data: null as any }));

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<object>()),
    useQuery: () => ({ result: ref(state.data), refetch: vi.fn(async () => {}) }),
  };
});

import ServerMapRotation from "~/components/servers/ServerMapRotation.vue";

const map = (id: string, label: string | null, workshopId: string | null) => ({
  id,
  name: workshopId ?? label ?? id,
  label,
  poster: null,
  workshop_map_id: workshopId,
});

const mapChooser = (installState = "Installed") => ({
  plugin: { slug: "map-chooser", name: "MapChooser", install_state: installState },
});

function fixture({
  shuffle = true,
  installs = [mapChooser()],
  off = [] as Array<string>,
} = {}) {
  return {
    servers_by_pk: {
      id: "server-1",
      map_rotation_shuffle: shuffle,
      plugin_overrides: off.map((plugin_slug) => ({ plugin_slug })),
      map_rotation: [
        { map: map("m1", "Prophunt Mirage", "3615968422") },
        { map: map("m2", null, null) },
      ],
    },
    maps: [
      map("m1", "Prophunt Mirage", "3615968422"),
      map("m3", "Prophunt Office", "3644811896"),
      map("m4", "Prophunt Office", "3644811896"),
      map("m5", "Prophunt Italy", "3644811897"),
      map("m6", "Dust II", null),
    ],
    game_plugin_installs: installs,
  };
}

let unmount: (() => void) | undefined;

// The list starts at y=100 with 53px rows and the pool spans y=400-800, so a
// pointer at y=110 is over the first row and y=165 over the second.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const rect = (top: number, height: number) =>
        ({
          top,
          bottom: top + height,
          left: 0,
          right: 600,
          width: 600,
          height,
          x: 0,
          y: top,
          toJSON() {},
        }) as DOMRect;

      if (this.matches("[data-rotation-list]")) {
        return rect(100, 160);
      }

      if (this.matches("[data-rotation-pool]")) {
        return rect(400, 400);
      }

      return rect(0, 0);
    },
  );
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as any);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
  });

async function press(target: any, x: number, y: number) {
  target.element.dispatchEvent(pointer("pointerdown", x, y));
  await flushPromises();
}

async function move(x: number, y: number) {
  window.dispatchEvent(pointer("pointermove", x, y));
  await flushPromises();
}

async function release(x: number, y: number) {
  window.dispatchEvent(pointer("pointerup", x, y));
  await flushPromises();
}

const rowTexts = (wrapper: any) =>
  wrapper
    .findAll("li[data-rotation-row]")
    .map((row: any) =>
      row.attributes("data-rotation-placeholder")
        ? "(gap)"
        : row.find("p").text(),
    );

const tile = (wrapper: any, label: string) =>
  wrapper.find(`[aria-label="Add ${label}"]`);

const ids = (wrapper: any) => (wrapper.vm as any).payload().map_ids;

async function mountCard() {
  const wrapper = await mountSuspended(ServerMapRotation, {
    props: { serverId: "server-1", enabled: true },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("ServerMapRotation", () => {
  it("lists the rotation in order with no warning when a rotation plugin is installed", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    const items = wrapper.findAll("li[data-rotation-row]").map((li) => li.text());

    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Prophunt Mirage");
    expect(items[0]).toContain("Workshop");
    expect(items[1]).toContain("m2");
    expect(wrapper.text()).not.toContain("No map rotation plugin is installed");
    expect(wrapper.text()).not.toContain("Boots First");
  });

  it("marks the first map as the boot map when played in order", async () => {
    state.data = fixture({ shuffle: false });

    const wrapper = await mountCard();

    expect(wrapper.findAll("li[data-rotation-row]")[0].text()).toContain("Boots First");
  });

  // The api skips a plugin that is only placed by hand, failed, or switched
  // off on this server, so the card must not claim it plays the rotation.
  it("warns when no usable rotation plugin will run it", async () => {
    for (const setup of [
      { installs: [mapChooser("Manual")] },
      { installs: [mapChooser("Failed")] },
      { installs: [mapChooser()], off: ["map-chooser"] },
      { installs: [] },
    ]) {
      state.data = fixture(setup);

      const wrapper = await mountCard();

      expect(wrapper.text()).toContain("No map rotation plugin is installed");

      unmount?.();
      unmount = undefined;
    }
  });

  it("adds a map from the pool with one click and takes it out of the pool", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    await tile(wrapper, "Dust II").trigger("click");

    expect(ids(wrapper)).toEqual(["m1", "m2", "m6"]);
    expect(wrapper.find('[aria-label="Add Dust II"]').exists()).toBe(false);
  });

  it("offers each catalog map once, minus the ones already in rotation", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    const tiles = wrapper
      .findAll("[data-rotation-tile]")
      .map((button) => button.attributes("aria-label"));

    expect(tiles).toEqual([
      "Add Dust II",
      "Add Prophunt Office",
      "Add Prophunt Italy",
    ]);
  });

  it("adds a whole group at once", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    const addAll = wrapper
      .findAll("button")
      .filter((button) => button.text() === "Add All");
    await addAll[1].trigger("click");

    expect(ids(wrapper)).toEqual(["m1", "m2", "m3", "m5"]);
    expect(tile(wrapper, "Prophunt Office").exists()).toBe(false);
    expect(tile(wrapper, "Dust II").exists()).toBe(true);
  });

  it("opens a gap under the pointer while a pool map is dragged, and drops it there", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    await press(tile(wrapper, "Dust II"), 50, 450);
    await move(50, 110);

    expect(rowTexts(wrapper)).toEqual(["(gap)", "Prophunt Mirage", "m2"]);
    expect(ids(wrapper)).toEqual(["m1", "m2"]);

    await release(50, 110);

    expect(ids(wrapper)).toEqual(["m6", "m1", "m2"]);
    expect(wrapper.find("[data-rotation-placeholder]").exists()).toBe(false);
  });

  it("slides the other rows out of the way while one is dragged", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    await press(wrapper.findAll("li[data-rotation-row]")[0], 50, 110);
    await move(50, 120);

    expect(rowTexts(wrapper)).toEqual(["(gap)", "m2"]);

    await move(50, 165);

    expect(rowTexts(wrapper)).toEqual(["m2", "(gap)"]);

    await release(50, 165);

    expect(ids(wrapper)).toEqual(["m2", "m1"]);
  });

  it("removes a rotation map dropped back on the pool", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    await press(wrapper.findAll("li[data-rotation-row]")[0], 50, 110);
    await move(50, 500);

    expect(wrapper.find("[data-rotation-pool]").text()).toContain(
      "Drop to remove",
    );

    await release(50, 500);

    expect(ids(wrapper)).toEqual(["m2"]);
    expect(tile(wrapper, "Prophunt Mirage").exists()).toBe(true);
  });

  it("puts everything back when the drag is cancelled with Escape", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    await press(wrapper.findAll("li[data-rotation-row]")[0], 50, 110);
    await move(50, 165);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    expect(ids(wrapper)).toEqual(["m1", "m2"]);
    expect(rowTexts(wrapper)).toEqual(["Prophunt Mirage", "m2"]);
  });

  it("does not add the tile a drag started from when it is let go outside the list", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    const dust = tile(wrapper, "Dust II");
    await press(dust, 50, 450);
    await move(50, 600);
    await release(50, 600);
    await dust.trigger("click");

    expect(ids(wrapper)).toEqual(["m1", "m2"]);
  });
});
