import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import HighlightsBrowser from "~/components/clips/HighlightsBrowser.vue";
import EventPlayerPicker from "~/components/events/EventPlayerPicker.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query }),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query } }),
}));

const EVENT_SCOPE = 'event_links:{event_id:{_eq:"event-1"}}';

function sentQueries(root: string) {
  return query.mock.calls
    .map(([options]) => print(options.query).replace(/\s+/g, ""))
    .filter((text) => text.includes(`${root}(`));
}

async function mountBrowser(route: string, eventId?: string) {
  query.mockResolvedValue({ data: {} });
  const wrapper = await mountSuspended(HighlightsBrowser, {
    route,
    props: eventId ? { eventId } : {},
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  query.mockReset();
});

describe("HighlightsBrowser", () => {
  it("scopes grouped match clips and their count to the event's matches", async () => {
    await mountBrowser("/events/event-1?tab=highlights&sort=recent", "event-1");

    const groups = sentQueries("match_maps");
    const counts = sentQueries("match_maps_aggregate");
    expect(groups.length).toBeGreaterThan(0);
    expect(counts.length).toBeGreaterThan(0);
    for (const text of [...groups, ...counts]) {
      expect(text).toContain(`match:{${EVENT_SCOPE}}`);
    }
  });

  it("scopes single clips and their count to the event's matches", async () => {
    await mountBrowser("/events/event-1?tab=highlights&sort=views", "event-1");

    const clips = sentQueries("match_clips");
    const counts = sentQueries("match_clips_aggregate");
    expect(clips.length).toBeGreaterThan(0);
    expect(counts.length).toBeGreaterThan(0);
    for (const text of [...clips, ...counts]) {
      expect(text).toContain(`match_map:{match:{${EVENT_SCOPE}}}`);
    }
  });

  it("leads an event's highlights with its top plays: most kills, then shortest", async () => {
    await mountBrowser("/events/event-1?tab=highlights", "event-1");

    const [clips] = sentQueries("match_clips");
    expect(clips).toContain(
      "order_by:[{kills_count:desc_nulls_last},{knife_kills_count:desc},{duration_ms:asc_nulls_last},{views_count:desc_nulls_last},{created_at:desc}]",
    );
  });

  it("keeps the highlights page newest first", async () => {
    await mountBrowser("/highlights");

    const grouped = query.mock.calls.find(
      ([options]) => options.variables?.clips_order_by,
    );
    expect(grouped?.[0].variables.clips_order_by).toEqual([
      { created_at: "desc" },
    ]);
  });

  it("lists the event's participants in the player filter", async () => {
    const wrapper = await mountBrowser(
      "/events/event-1?tab=highlights",
      "event-1",
    );

    expect(wrapper.findComponent(EventPlayerPicker).exists()).toBe(true);
    expect(wrapper.findComponent(PlayerSearch).exists()).toBe(false);
  });

  it("stays unscoped with the global player search on the highlights page", async () => {
    const wrapper = await mountBrowser("/highlights");

    const sent = query.mock.calls.map(([options]) =>
      print(options.query).replace(/\s+/g, ""),
    );
    expect(sent.length).toBeGreaterThan(0);
    for (const text of sent) {
      expect(text).not.toContain("event_links:{event_id");
    }
    expect(wrapper.findComponent(PlayerSearch).exists()).toBe(true);
    expect(wrapper.findComponent(EventPlayerPicker).exists()).toBe(false);
  });
});
