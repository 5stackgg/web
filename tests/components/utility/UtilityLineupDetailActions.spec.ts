import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupDetail from "~/components/utility/UtilityLineupDetail.vue";
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
  upvotes: 2,
  author_steam_id: "7",
  author: { steam_id: "7", name: "rawr", avatar_url: null },
} as unknown as UtilityLineup;

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn(async () => ({ data: {} })),
    mutate: vi.fn(async () => ({ data: {} })),
    subscribe: () => ({
      subscribe: () => ({ unsubscribe() {} }),
    }),
  }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => {
  const { ref } = await import("vue");
  return {
    ...(await original<Record<string, unknown>>()),
    useSidebar: () => ({ isMobile: ref(false) }),
  };
});

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

async function mountDetail(lineup: Partial<UtilityLineup> = {}) {
  const row = { ...base, ...lineup } as UtilityLineup;
  const wrapper = await mountSuspended(UtilityLineupDetail, {
    attachTo: document.body,
    props: {
      lineups: [row],
      lineupId: row.id,
      open: true,
      canReact: true,
      canPractice: false,
    },
  });
  await flushPromises();
  return wrapper;
}

function actions(wrapper: Awaited<ReturnType<typeof mountDetail>>) {
  return wrapper
    .findAll("[data-library-actions] [data-action]")
    .map((button) => button.attributes("data-action"));
}

describe("UtilityLineupDetail actions", () => {
  it("shows fork and mark as bad on somebody else's public lineup, with no ⋯", async () => {
    const wrapper = await mountDetail();

    expect(actions(wrapper)).toEqual(["fork", "bad"]);
    expect(wrapper.find("[data-more]").exists()).toBe(false);
  });

  it("shows submit on your own private lineup and keeps edit and archive in ⋯", async () => {
    const wrapper = await mountDetail({
      visibility: "Private",
      can_edit: true,
      author_steam_id: "9",
    } as Partial<UtilityLineup>);

    expect(actions(wrapper)).toEqual(["fork", "submit"]);

    document
      .querySelector("[data-more]")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    await flushPromises();

    const items = [...document.body.querySelectorAll("[role=menuitem]")].map(
      (item) => item.textContent!.replace(/\s+/g, " ").trim(),
    );
    expect(items).toEqual(["Edit", "Archive lineup"]);
  });

  it("puts who can see it on the top row, not beside the name", async () => {
    const wrapper = await mountDetail({
      visibility: "Private",
      can_edit: true,
      author_steam_id: "9",
    } as Partial<UtilityLineup>);

    expect(wrapper.find("header [data-visibility]").text()).toContain(
      "Private",
    );
    expect(wrapper.find("h2 + [data-visibility]").exists()).toBe(false);
  });

  it("hands mark as bad to the page as a down vote", async () => {
    const wrapper = await mountDetail();

    await wrapper.find("[data-action=bad]").trigger("click");

    expect(wrapper.emitted("vote")?.[0]).toEqual(["l-1", -1]);
  });
});
