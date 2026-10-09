import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRouter } from "#app";
import UtilityMapPage from "~/pages/utility/[map].vue";
import metadata from "~/public/radars/metadata.json";

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
  upvotes: 3,
  downvotes: 0,
  tags: [],
};

const graphql = vi.hoisted(() => ({
  // Every query the page sends, by what it asked for.
  lists: [] as unknown[],
  all: 0,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn(async ({ variables }: any) => {
      graphql.all += 1;
      // The list is the one query that pages.
      if (variables && "limit" in variables && "offset" in variables) {
        graphql.lists.push(variables);
        return { data: { utility_lineups: [lineup] } };
      }
      return {
        data: {
          utility_lineups: [lineup],
          utility_lineups_aggregate: { aggregate: { count: 1 } },
          utility_lineups_by_pk: lineup,
        },
      };
    }),
    mutate: vi.fn(async () => ({ data: {} })),
    subscribe: () => ({
      subscribe: () => ({ unsubscribe() {} }),
    }),
  }),
}));

const layout = vi.hoisted(() => ({ mobile: false }));

vi.mock("~/components/ui/sidebar/utils", async (original) => {
  const { ref } = await import("vue");
  return {
    ...(await original<Record<string, unknown>>()),
    useSidebar: () => ({ isMobile: ref(layout.mobile) }),
  };
});

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await flushPromises();
};

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
let wrapper: Wrapper | undefined;

beforeEach(() => {
  graphql.lists.length = 0;
  graphql.all = 0;
  layout.mobile = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// The lineup's 3D view wants a WebGL context, which there is none of here.
async function mountPage() {
  const mounted = await mountSuspended(UtilityMapPage, {
    route: "/utility/de_mirage",
    attachTo: document.body,
    global: { stubs: { UtilityLineupViewer3D: true, ClipPlayer: true } },
  });
  await settle();
  return mounted;
}

const position = () => Number(window.history.state.position);

describe("the utility map page and the browser's history", () => {
  it("stays the same page through open a lineup, Back, Forward", async () => {
    wrapper = await mountPage();
    const router = useRouter();
    const start = Number(window.history.state.position);

    // The list holds its placeholder for a beat before the rows replace it.
    await vi.waitFor(
      () => expect(wrapper!.find("[role='button']").exists()).toBe(true),
      { timeout: 3000 },
    );
    await settle();
    const row = wrapper.find("[role='button']");
    // The same nodes at the end as at the start is the page never having
    // been torn down and built again.
    const board = wrapper.find(".aspect-square").element;
    const listed = graphql.lists.length;
    const asked = graphql.all;
    expect(listed).toBeGreaterThan(0);

    await row.trigger("click");
    await settle();
    expect(router.currentRoute.value.query.lineup).toBe(lineup.id);
    expect(Number(window.history.state.position)).toBe(start + 1);

    router.back();
    await settle();
    expect(router.currentRoute.value.query.lineup).toBeUndefined();
    expect(Number(window.history.state.position)).toBe(start);

    router.forward();
    await settle();
    expect(router.currentRoute.value.query.lineup).toBe(lineup.id);

    router.back();
    await settle();

    expect(graphql.lists.length).toBe(listed);
    expect(wrapper.find(".aspect-square").element).toBe(board);
    expect(wrapper.find("[role='button']").element).toBe(row.element);
    // What opening a lineup asks for is the lineup; nothing about the list
    // or the map is asked again.
    expect(graphql.all - asked).toBeLessThan(8);
  });

  it("keeps the board as it was zoomed through the same trip", async () => {
    wrapper = await mountPage();
    const router = useRouter();
    await vi.waitFor(
      () => expect(wrapper!.find("[role='button']").exists()).toBe(true),
      { timeout: 3000 },
    );
    const layer = () =>
      wrapper!.find("[data-board-layer]").element as HTMLElement;
    const map = wrapper.find(".aspect-square").element;

    map.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -60, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(layer().style.width).not.toBe("100%"), {
      timeout: 2000,
    });
    await settle();
    const zoomed = layer().style.width;

    await wrapper.find("[role='button']").trigger("click");
    await settle();
    router.back();
    await settle();
    router.forward();
    await settle();
    router.back();
    await settle();

    expect(layer().style.width).toBe(zoomed);
  });
});

describe("the utility map page on a phone", () => {
  beforeEach(() => {
    layout.mobile = true;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
  });

  const sheet = () =>
    document.querySelector("[data-utility-sheet]") as HTMLElement;
  const offset = () =>
    Number(
      /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(sheet().style.transform)?.[1],
    );
  // The drawer animates to a snap point over half a second.
  const settled = async () => {
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 620));
    await settle();
  };

  it("raises the sheet for a lineup and puts it back on Back, on one page", async () => {
    wrapper = await mountPage();
    const router = useRouter();
    await vi.waitFor(
      () => expect(document.querySelector("[role='button']")).not.toBeNull(),
      { timeout: 3000 },
    );
    await settled();
    const start = position();
    const listed = graphql.lists.length;
    const row = document.querySelector("[role='button']") as HTMLElement;

    // Half: 800 of window, 728 fully open, 320 showing.
    expect(offset()).toBe(408);

    row.click();
    await settled();
    expect(router.currentRoute.value.query.lineup).toBe(lineup.id);
    expect(position()).toBe(start + 1);
    expect(offset()).toBe(0);

    router.back();
    await settled();
    expect(router.currentRoute.value.query.lineup).toBeUndefined();
    expect(position()).toBe(start);
    expect(offset()).toBe(408);

    router.forward();
    await settled();
    expect(offset()).toBe(0);
    router.back();
    await settled();

    expect(graphql.lists.length).toBe(listed);
    expect(document.querySelector("[role='button']")).toBe(row);
    expect(sheet().getAttribute("data-state")).toBe("open");
  });

  it("gives a sheet raised by hand one step, and keeps a filter set under it", async () => {
    wrapper = await mountPage();
    const router = useRouter();
    await vi.waitFor(
      () => expect(document.querySelector("[role='button']")).not.toBeNull(),
      { timeout: 3000 },
    );
    await settled();
    const start = position();
    const handle = sheet().querySelector(
      "[data-sheet-handle]",
    ) as HTMLElement;

    handle.click();
    await settled();
    expect(offset()).toBe(0);
    expect(position()).toBe(start + 1);

    // What the page writes to the address while the sheet is up...
    await router.replace({
      path: router.currentRoute.value.path,
      query: { ...router.currentRoute.value.query, type: "Smoke" },
    });
    await settled();
    const listed = graphql.lists.length;

    // ...is still there when Back lowers it, and is not asked for again.
    router.back();
    await settled();
    expect(offset()).toBe(408);
    expect(position()).toBe(start);
    expect(router.currentRoute.value.query.type).toBe("Smoke");
    expect(graphql.lists.length).toBe(listed);

    // Forward is the same address: nothing to redo, nothing refetched.
    router.forward();
    await settled();
    expect(router.currentRoute.value.query.type).toBe("Smoke");
    expect(graphql.lists.length).toBe(listed);
    router.back();
    await settled();
  });
});
