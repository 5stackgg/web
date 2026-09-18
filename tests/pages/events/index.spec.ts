import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventsIndex from "~/pages/events/index.vue";
import EventHero from "~/components/events/EventHero.vue";
import EventSquare from "~/components/events/EventSquare.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import { resolveRootField } from "../../helpers/fakeHasura";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function at(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function event(name: string, starts_at: string, ends_at: string | null) {
  return {
    id: `id-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    description: null,
    starts_at,
    ends_at,
    visibility: "Public",
    media_access: "Organizers",
    hide_creator_organizer: false,
    banner_media_id: null,
    banner: null,
    is_organizer: false,
    can_upload_media: false,
    organizer_steam_id: "76561198000000001",
    organizer: null,
    organizers: [],
    tournaments_aggregate: { aggregate: { count: 0 } },
    teams_aggregate: { aggregate: { count: 0 } },
    players_aggregate: { aggregate: { count: 0 } },
    media_aggregate: { aggregate: { count: 0 } },
  };
}

function upcoming(n: number) {
  return event(`Upcoming ${String(n).padStart(2, "0")}`, at(n * DAY), null);
}

function finished(n: number) {
  return event(
    `Finished ${String(n).padStart(2, "0")}`,
    at(-(n + 1) * DAY),
    at(-n * DAY),
  );
}

let table: any[] = [];

function serve() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      const data = resolveRootField(options.query, options.variables, table);
      Promise.resolve().then(() => observer.next({ data }));
      return { unsubscribe() {}, closed: false };
    },
  }));
}

async function mountPage() {
  serve();
  // mountSuspended drops app mixins; apollo-option's mixin starts $subscribe.
  const wrapper = await mountSuspended(EventsIndex, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

function names(wrapper: any, component: any): string[] {
  return wrapper
    .findAllComponents(component)
    .map((card: any) => card.props("event").name);
}

describe("events index sections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders upcoming events as the large hero cards and past events as compact cards", async () => {
    table = [
      event("Live Cup", at(-HOUR), at(DAY)),
      upcoming(2),
      upcoming(1),
      finished(1),
      finished(2),
    ];

    const wrapper = await mountPage();

    const heroes = names(wrapper, EventHero);
    const squares = names(wrapper, EventSquare);
    expect(heroes).toEqual(["Live Cup", "Upcoming 01", "Upcoming 02"]);
    expect(squares).toEqual(["Finished 01", "Finished 02"]);
  });

  it("orders upcoming events soonest first", async () => {
    table = [upcoming(3), upcoming(1), upcoming(2)];

    const wrapper = await mountPage();

    expect(names(wrapper, EventHero)).toEqual([
      "Upcoming 01",
      "Upcoming 02",
      "Upcoming 03",
    ]);
  });

  it("shows the soonest upcoming and live events when there are more events than one page", async () => {
    table = [
      ...Array.from({ length: 15 }, (_, i) => upcoming(i + 1)),
      event("Live Cup", at(-HOUR), null),
      ...Array.from({ length: 15 }, (_, i) => finished(i + 1)),
    ];

    const wrapper = await mountPage();

    const heroes = names(wrapper, EventHero);
    expect(heroes[0]).toBe("Live Cup");
    expect(heroes[1]).toBe("Upcoming 01");
    expect(names(wrapper, EventSquare)[0]).toBe("Finished 01");
  });

  it.each([
    {
      label: "Upcoming",
      rows: () => Array.from({ length: 10 }, (_, i) => upcoming(i + 1)),
    },
    {
      label: "Live now",
      rows: () =>
        Array.from({ length: 10 }, (_, i) =>
          event(
            `Live ${String(i + 1).padStart(2, "0")}`,
            at(-(i + 1) * HOUR),
            null,
          ),
        ),
    },
  ])(
    "limits the $label heroes and shows more on request",
    async ({ label, rows }) => {
      table = rows();
      const expected = table.map((row) => row.name);

      const wrapper = await mountPage();
      const section = () =>
        wrapper.findAll("section").find((s) => s.text().startsWith(label))!;
      const showMore = () =>
        section()
          .findAll("button")
          .find((b) => b.text() === "Show more");

      const initial = names(section(), EventHero);
      expect(initial.length).toBeGreaterThan(0);
      expect(initial.length).toBeLessThan(expected.length);
      expect(initial).toEqual(expected.slice(0, initial.length));

      for (let i = 0; i < expected.length && showMore(); i++) {
        await showMore()!.trigger("click");
        await flushPromises();
      }

      expect(names(section(), EventHero)).toEqual(expected);
      expect(showMore()).toBeUndefined();
    },
  );

  it("loads more past events as the compact row nears its end", async () => {
    table = Array.from({ length: 30 }, (_, i) => finished(i + 1));

    const wrapper = await mountPage();

    const initial = names(wrapper, EventSquare);
    expect(initial.length).toBeGreaterThan(0);
    expect(initial.length).toBeLessThan(30);
    expect(initial[0]).toBe("Finished 01");

    for (let i = 0; i < 5; i++) {
      wrapper.findComponent(HorizontalScrollRow).vm.$emit("approaching-end");
      await flushPromises();
    }

    const all = names(wrapper, EventSquare);
    expect(all).toHaveLength(30);
    expect(all[29]).toBe("Finished 30");
  });
});
