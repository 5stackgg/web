import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";

const rows = vi.hoisted(() => ({
  maps: [] as Array<{ name: string; active_pool: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async () => ({ data: { maps: rows.maps } }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<typeof import("~/utilities/mapAssets")>()),
  loadRadarMaps: async () =>
    new Set(["de_ancient", "de_mirage", "de_nuke", "de_train", "de_vertigo"]),
}));

const auth = reactive({ me: { steam_id: "9" }, isRoleAbove: () => false });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

async function openPicker() {
  const wrapper = await mountSuspended(PlayPracticeTile, {
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushPromises();

  await wrapper.find("button[role='combobox']").trigger("pointerdown", {
    button: 0,
    pointerType: "mouse",
  });
  await flushPromises();

  return wrapper;
}

const groups = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="group"]')).map(
    (group) =>
      Array.from(group.children).map((child) => child.textContent?.trim()),
  );

const options = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).map(
    (option) => option.textContent?.trim(),
  );

describe("PlayPracticeTile map picker", () => {
  it("lists the Active Duty maps first, then the other maps, each under its heading", async () => {
    rows.maps = [
      { name: "de_ancient", active_pool: true },
      { name: "de_mirage", active_pool: false },
      { name: "de_mirage", active_pool: true },
      { name: "de_nuke", active_pool: true },
      { name: "de_train", active_pool: false },
      { name: "de_vertigo", active_pool: false },
    ];

    const wrapper = await openPicker();

    expect(groups()).toEqual([
      ["Active Duty", "Ancient", "Mirage", "Nuke"],
      ["Other maps", "Train", "Vertigo"],
    ]);
    expect(wrapper.find("button[role='combobox']").text()).toBe("Mirage");
  });

  it("keeps one plain list when no map is flagged Active Duty", async () => {
    rows.maps = [
      { name: "de_ancient", active_pool: false },
      { name: "de_mirage", active_pool: false },
      { name: "de_train", active_pool: false },
    ];

    await openPicker();

    expect(groups()).toEqual([]);
    expect(options()).toEqual(["Ancient", "Mirage", "Train"]);
  });
});
