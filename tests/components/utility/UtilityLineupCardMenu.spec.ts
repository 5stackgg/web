import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const base = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "TERRORIST",
  technique: "WalkJump",
  throw_strength: "Full",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  tags: [],
  progress: [],
  visibility: "Public",
  upvotes: 3,
  author_steam_id: "7",
  author: { steam_id: "7", name: "rawr", avatar_url: null },
} as unknown as UtilityLineup;

const auth = vi.hoisted(() => ({ me: { steam_id: "9" } }));
vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ ...auth, isRoleAbove: () => false }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mountTile(
  lineup: Partial<UtilityLineup> = {},
  props: Record<string, unknown> = {},
) {
  const wrapper = await mountSuspended(UtilityLineupCard, {
    attachTo: document.body,
    props: {
      lineup: { ...base, ...lineup } as UtilityLineup,
      mode: "row",
      menu: false,
      canReact: true,
      ...props,
    },
  });
  await flushPromises();
  return wrapper;
}

async function rightClick(wrapper: Awaited<ReturnType<typeof mountTile>>) {
  await wrapper
    .find("[role=button]")
    .trigger("contextmenu", { clientX: 20, clientY: 20 });
  await flushPromises();
  return [...document.body.querySelectorAll("[data-menu]")].map((item) =>
    item.getAttribute("data-menu"),
  );
}

describe("UtilityLineupCard author line", () => {
  it("puts who submitted it on a third line where asked", async () => {
    const wrapper = await mountTile({}, { showAuthor: true });

    expect(wrapper.find("[data-author-line]").exists()).toBe(true);
    expect(wrapper.find("[data-author-line]").text()).toContain("rawr");
  });

  it("leaves it off where every lineup is your own", async () => {
    const wrapper = await mountTile({}, { showAuthor: false });

    expect(wrapper.find("[data-author-line]").exists()).toBe(false);
  });
});

describe("UtilityLineupCard right-click menu", () => {
  it("offers fork, mark as bad and the link on somebody else's public lineup", async () => {
    const wrapper = await mountTile({}, { contextMenu: true });

    expect(await rightClick(wrapper)).toEqual(["fork", "bad", "link"]);
  });

  it("offers submit and archive on your own private one, and no vote", async () => {
    const wrapper = await mountTile(
      {
        visibility: "Private",
        can_edit: true,
        author_steam_id: "9",
        author: { steam_id: "9", name: "me", avatar_url: null },
      } as Partial<UtilityLineup>,
      { contextMenu: true },
    );

    expect(await rightClick(wrapper)).toEqual([
      "fork",
      "submit",
      "link",
      "archive",
    ]);
  });

  it("opens nothing where the tile has no menu", async () => {
    const wrapper = await mountTile({}, { contextMenu: false });

    expect(await rightClick(wrapper)).toEqual([]);
  });

  it("hands the choice to the page", async () => {
    const wrapper = await mountTile({}, { contextMenu: true });
    await rightClick(wrapper);

    (document.body.querySelector("[data-menu=fork]") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.emitted("fork")?.[0]).toEqual(["l-1"]);
  });
});
