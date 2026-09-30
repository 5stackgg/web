import { afterEach, describe, expect, it, vi } from "vitest";
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
    ],
    game_plugin_installs: installs,
  };
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountCard() {
  const wrapper = await mountSuspended(ServerMapRotation, {
    props: { serverId: "server-1", enabled: true },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("ServerMapRotation", () => {
  it("lists the rotation in order and names the plugin that plays it", async () => {
    state.data = fixture();

    const wrapper = await mountCard();
    const items = wrapper.findAll("li[draggable]").map((li) => li.text());

    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Prophunt Mirage");
    expect(items[0]).toContain("Workshop");
    expect(items[1]).toContain("m2");
    expect(wrapper.text()).toContain("Played by MapChooser");
    expect(wrapper.text()).not.toContain("Boots First");
  });

  it("marks the first map as the boot map when played in order", async () => {
    state.data = fixture({ shuffle: false });

    const wrapper = await mountCard();

    expect(wrapper.findAll("li[draggable]")[0].text()).toContain("Boots First");
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
      expect(wrapper.text()).not.toContain("Played by");

      unmount?.();
      unmount = undefined;
    }
  });
});
