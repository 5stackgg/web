import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityLineupHoverPreview from "~/components/utility/UtilityLineupHoverPreview.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const lineup = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  tags: [],
  progress: [],
  preview_stills_url: {
    stance: "https://cdn.test/stance.jpg",
    aim: "https://cdn.test/aim.jpg",
  },
} as unknown as UtilityLineup;

const openPeeks = () =>
  document.querySelectorAll("[data-reka-popper-content-wrapper]");

const rest = () => new Promise((resolve) => setTimeout(resolve, 600));

const openNow = () =>
  document.querySelector(
    "[data-reka-popper-content-wrapper] [data-state=open]",
  );

function enter(element: Element) {
  element.dispatchEvent(
    new PointerEvent("pointerenter", {
      pointerType: "mouse",
      clientX: 40,
      clientY: 40,
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

const mounted: Array<{ unmount: () => void }> = [];

async function mount(...args: Parameters<typeof mountSuspended>) {
  const wrapper = await mountSuspended(...args);
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("lineup hover peek", () => {
  it("opens beside a list row the mouse rests on", async () => {
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();

    enter(wrapper.find("[role=button]").element);
    await rest();

    expect(openPeeks()).toHaveLength(1);
    expect(document.body.innerHTML).toContain("aim.jpg");
  });

  it("sizes the card to the peek, so nothing inside it is cut off", async () => {
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();

    enter(wrapper.find("[role=button]").element);
    await rest();

    const card = document.querySelector(
      "[data-reka-popper-content-wrapper] [data-dismissable-layer]",
    )!;
    expect(card.className.split(/\s+/)).toContain("w-auto");
    expect(card.className.split(/\s+/)).not.toContain("w-64");
  });

  it("opens for the lineup that is already open, too", async () => {
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false, selected: true },
      attachTo: document.body,
    });
    await flushPromises();

    enter(wrapper.find("[role=button]").element);
    await rest();

    expect(openPeeks()).toHaveLength(1);
  });

  it("lets the pointer through to the rows and markers under it", async () => {
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();

    enter(wrapper.find("[role=button]").element);
    await rest();

    const card = document.querySelector(
      "[data-reka-popper-content-wrapper] [data-dismissable-layer]",
    )!;
    expect(card.className.split(/\s+/)).toContain("pointer-events-none");
    expect(card.className.split(/\s+/)).toContain("utility-peek");
  });

  it("goes about 100ms after the pointer leaves the row", async () => {
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();
    const row = wrapper.find("[role=button]").element;

    enter(row);
    await rest();
    row.dispatchEvent(
      new PointerEvent("pointerleave", { pointerType: "mouse" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(openNow()).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(openNow()).toBeNull();
  });

  it("hands straight over to the next row instead of waiting", async () => {
    const other = {
      ...lineup,
      id: "l-2",
      preview_stills_url: { aim: "https://cdn.test/other-aim.jpg" },
    } as UtilityLineup;
    const first = await mount(UtilityLineupCard, {
      props: { lineup, mode: "row", menu: false },
      attachTo: document.body,
    });
    const second = await mount(UtilityLineupCard, {
      props: { lineup: other, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();
    const row = first.find("[role=button]").element;

    enter(row);
    await rest();
    row.dispatchEvent(
      new PointerEvent("pointerleave", { pointerType: "mouse" }),
    );
    enter(second.find("[role=button]").element);
    await flushPromises();

    const open = document.querySelectorAll(
      "[data-reka-popper-content-wrapper] [data-state=open]",
    );
    expect(open).toHaveLength(1);
    expect(open[0].innerHTML).toContain("other-aim.jpg");
  });

  it("steps through the stills with the arrow keys while it is up", async () => {
    const stepped = {
      ...lineup,
      id: "l-3",
      preview_stills_url: {
        stance: "https://cdn.test/stance.jpg",
        aim_pin: "https://cdn.test/aim_pin.jpg",
        aim_close: "https://cdn.test/aim_close.jpg",
      },
    } as UtilityLineup;
    const wrapper = await mount(UtilityLineupCard, {
      props: { lineup: stepped, mode: "row", menu: false },
      attachTo: document.body,
    });
    await flushPromises();

    enter(wrapper.find("[role=button]").element);
    await rest();
    const shown = () =>
      openNow()!.querySelector("[role=group] img")!.getAttribute("src");
    expect(shown()).toBe("https://cdn.test/aim_close.jpg");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await flushPromises();
    expect(shown()).toBe("https://cdn.test/aim_pin.jpg");

    const field = document.createElement("input");
    document.body.appendChild(field);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    await flushPromises();
    expect(shown()).toBe("https://cdn.test/aim_pin.jpg");
  });

  it("opens from a lineup's marker on the radar", async () => {
    const wrapper = await mount(UtilityRadarBoard, {
      props: {
        mapName: "de_mirage",
        lineups: [lineup],
        peek: true,
        seedSrc: "/radars/de_mirage.png",
      },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    const marker = wrapper.find("g.cursor-pointer");
    expect(marker.exists()).toBe(true);
    enter(marker.element);
    await rest();

    expect(openPeeks()).toHaveLength(1);
    expect(document.body.innerHTML).toContain("aim.jpg");
  });

  it("keeps a single peek when the row and the marker are the same lineup", async () => {
    const row = ref<Element | null>(null);
    const marker = ref<Element | null>(null);
    await mount(
      defineComponent({
        setup() {
          return () => [
            h("div", { ref: row }),
            h("div", { ref: marker }),
            h(UtilityLineupHoverPreview, { lineup, anchor: row.value }),
            h(UtilityLineupHoverPreview, {
              lineup,
              anchor: marker.value,
              placement: "pointer",
            }),
          ];
        },
      }),
      { attachTo: document.body },
    );
    await flushPromises();

    enter(row.value!);
    await rest();

    expect(openPeeks()).toHaveLength(1);
  });
});
