import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import { Kind } from "graphql";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import EventsIndex from "~/pages/events/index.vue";
import EventFeature from "~/components/events/EventFeature.vue";
import EventUpNext from "~/components/events/EventUpNext.vue";
import EventPastTile from "~/components/events/EventPastTile.vue";
import WatchEventCompactCard from "~/components/watch/WatchEventCompactCard.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import Pagination from "~/components/Pagination.vue";
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
    starts_at,
    ends_at,
    banner_media_id: null,
    banner: null,
    hide_creator_organizer: false,
    organizer_steam_id: "76561198000000001",
    organizer: null,
    organizers: [],
    tournaments: [],
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

function live(name: string, startedHoursAgo: number) {
  return event(name, at(-startedHoursAgo * HOUR), at(DAY));
}

let table: any[] = [];

// Every root field of the document, each resolved against the table.
function resolveAll(document: DocumentNode, variables: any) {
  const operation = document.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
  )!;
  return Object.assign(
    {},
    ...operation.selectionSet.selections.map((selection) =>
      resolveRootField(
        {
          ...document,
          definitions: [
            {
              ...operation,
              selectionSet: { ...operation.selectionSet, selections: [selection] },
            },
          ],
        } as DocumentNode,
        variables,
        table,
      ),
    ),
  );
}

async function mountPage(route = "/events") {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      const data = resolveAll(options.query, options.variables);
      Promise.resolve().then(() => observer.next({ data }));
      return { unsubscribe() {}, closed: false };
    },
  }));
  vi.spyOn(client, "query").mockImplementation(async (options: any) => ({
    data: resolveAll(options.query, options.variables),
  }));

  const wrapper = await mountSuspended(EventsIndex, {
    route,
    global: { stubs: { EventFeature: true } },
  });
  await flushPromises();
  return wrapper;
}

function names(wrapper: any, component: any): string[] {
  return wrapper
    .findAllComponents(component)
    .map((card: any) => card.props("event").name);
}

describe("events index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("puts the soonest upcoming event in the up-next strip and the rest in the grid", async () => {
    table = [upcoming(3), upcoming(1), upcoming(2), live("Live Cup", 1)];

    const wrapper = await mountPage();

    const upNext = wrapper.findComponent(EventUpNext);
    expect(upNext.props("event").name).toBe("Upcoming 01");
    expect(upNext.props("hero")).toBe(false);
    expect(names(wrapper, WatchEventCompactCard)).toEqual([
      "Upcoming 02",
      "Upcoming 03",
    ]);
  });

  it("gives the up-next event the full card when nothing else is on", async () => {
    table = [upcoming(1)];

    const wrapper = await mountPage();

    expect(wrapper.findComponent(EventUpNext).props("hero")).toBe(true);
  });

  it("features the most recently started live event and lists the others", async () => {
    table = [live("Older Live", 5), live("Newest Live", 1)];

    const wrapper = await mountPage();

    expect(wrapper.findComponent(EventFeature).props("event").name).toBe(
      "Newest Live",
    );
    expect(names(wrapper, WatchEventCompactCard)).toEqual(["Older Live"]);
  });

  it("loads more past events as the row nears its end", async () => {
    table = Array.from({ length: 30 }, (_, i) => finished(i + 1));

    const wrapper = await mountPage();

    const initial = names(wrapper, EventPastTile);
    expect(initial.length).toBeGreaterThan(0);
    expect(initial.length).toBeLessThan(30);
    expect(initial[0]).toBe("Finished 01");

    for (let i = 0; i < 5; i++) {
      wrapper.findComponent(HorizontalScrollRow).vm.$emit("approaching-end");
      await flushPromises();
    }

    const all = names(wrapper, EventPastTile);
    expect(all).toHaveLength(30);
    expect(all[29]).toBe("Finished 30");
  });

  it("filters to past events from the query string, newest first, a page at a time", async () => {
    table = [
      upcoming(1),
      live("Live Cup", 1),
      ...Array.from({ length: 14 }, (_, i) => finished(i + 1)),
    ];

    const wrapper = await mountPage("/events?phase=past");

    const shown = names(wrapper, WatchEventCompactCard);
    expect(shown).toHaveLength(10);
    expect(shown[0]).toBe("Finished 01");
    expect(shown).not.toContain("Upcoming 01");
    expect(wrapper.findComponent(Pagination).props("total")).toBe(14);
  });
});
