import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import PlayPracticeTile from "~/components/play/PlayPracticeTile.vue";

const rows = vi.hoisted(() => ({
  maps: [] as Array<{ name: string; type: string; active_pool: boolean }>,
  asked: [] as string[],
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async ({ query }: any) => {
      rows.asked.push(print(query));
      return { data: { maps: rows.maps } };
    },
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<typeof import("~/utilities/mapAssets")>()),
  loadRadarMaps: async () =>
    new Set([
      "de_ancient",
      "de_mirage",
      "de_nuke",
      "de_overpass",
      "de_train",
      "de_vertigo",
      "rush_001",
    ]),
}));

const auth = reactive({ me: { steam_id: "9" }, isRoleAbove: () => false });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  rows.asked.length = 0;
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
  it("files a map under Active Duty by its Competitive row, whatever its other modes say", async () => {
    rows.maps = [
      { name: "de_ancient", type: "Competitive", active_pool: true },
      { name: "de_mirage", type: "Competitive", active_pool: true },
      { name: "de_mirage", type: "Wingman", active_pool: false },
      { name: "de_nuke", type: "Competitive", active_pool: true },
      { name: "de_overpass", type: "Competitive", active_pool: false },
      { name: "de_overpass", type: "Wingman", active_pool: true },
      { name: "de_train", type: "Competitive", active_pool: false },
      { name: "de_vertigo", type: "Competitive", active_pool: false },
      { name: "de_vertigo", type: "Duel", active_pool: true },
    ];

    const wrapper = await openPicker();

    expect(groups()).toEqual([
      ["Active Duty", "Ancient", "Mirage", "Nuke"],
      ["Other maps", "Overpass", "Train", "Vertigo"],
    ]);
    expect(wrapper.find("button[role='combobox']").text()).toBe("Mirage");
  });

  it("leaves Rush out, as the Utility Library does", async () => {
    rows.maps = [
      { name: "de_mirage", type: "Competitive", active_pool: true },
      { name: "de_train", type: "Competitive", active_pool: false },
    ];

    await openPicker();

    const mapQueries = rows.asked.filter((query) => /\bmaps\s*\(/.test(query));
    expect(mapQueries).toHaveLength(1);
    expect(mapQueries[0]).toMatch(/type:\s*\{\s*_neq:\s*Rush\s*\}/);
  });

  it("keeps one plain list when no map is flagged Active Duty", async () => {
    rows.maps = [
      { name: "de_ancient", type: "Competitive", active_pool: false },
      { name: "de_mirage", type: "Competitive", active_pool: false },
      { name: "de_train", type: "Competitive", active_pool: false },
    ];

    await openPicker();

    expect(groups()).toEqual([]);
    expect(options()).toEqual(["Ancient", "Mirage", "Train"]);
  });
});
