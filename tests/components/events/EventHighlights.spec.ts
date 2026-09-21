import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventHighlights from "~/components/events/EventHighlights.vue";
import EventPlayerFilter from "~/components/events/EventPlayerFilter.vue";

const { subscribe, emitters } = vi.hoisted(() => {
  const emitters: Array<(value: unknown) => void> = [];
  const subscribe = vi.fn((_options: any) => ({
    subscribe: ({ next }: { next: (value: unknown) => void }) => {
      emitters.push(next);
      return { unsubscribe: () => {} };
    },
  }));
  return { subscribe, emitters };
});

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { subscribe } }),
}));

function lastVariables() {
  return subscribe.mock.calls.at(-1)![0].variables;
}

async function emitClips(clips: Array<{ id: string }>) {
  emitters.at(-1)!({ data: { match_clips: clips } });
  await flushPromises();
}

async function mountHighlights() {
  const wrapper = await mountSuspended(EventHighlights, {
    props: { eventId: "event-1" },
    global: {
      stubs: {
        HighlightCard: {
          props: ["clip"],
          template: '<div class="highlight-card">{{ clip.id }}</div>',
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  subscribe.mockClear();
  emitters.length = 0;
});

describe("EventHighlights", () => {
  it("subscribes to public clips from every match linked to the event, most viewed first", async () => {
    await mountHighlights();

    expect(lastVariables().where).toEqual({
      _and: [
        { visibility: { _eq: "public" } },
        {
          match_map: {
            match: { event_links: { event_id: { _eq: "event-1" } } },
          },
        },
      ],
    });
    expect(lastVariables().orderBy[0]).toEqual({
      views_count: "desc_nulls_last",
    });
  });

  it("shows only the empty state when the event has no highlights", async () => {
    const wrapper = await mountHighlights();
    await emitClips([]);

    expect(wrapper.text()).toContain(
      "No highlights from this event's matches yet.",
    );
    expect(wrapper.findComponent(EventPlayerFilter).exists()).toBe(false);
  });

  it("narrows to one player and keeps the filter when that player has none", async () => {
    const wrapper = await mountHighlights();
    await emitClips([{ id: "clip-1" }]);
    expect(wrapper.findAll(".highlight-card")).toHaveLength(1);

    wrapper.findComponent(EventPlayerFilter).vm.$emit("update:modelValue", {
      steam_id: "76561198000000001",
      name: "Roster Player",
    });
    await flushPromises();

    expect(lastVariables().where._and).toContainEqual({
      target_steam_id: { _eq: "76561198000000001" },
    });

    await emitClips([]);

    expect(wrapper.text()).toContain(
      "No highlights of this player at this event.",
    );
    expect(wrapper.findComponent(EventPlayerFilter).exists()).toBe(true);
  });

  it("resubscribes newest first when switched to most recent", async () => {
    const wrapper = await mountHighlights();
    await emitClips([{ id: "clip-1" }]);

    const recent = wrapper
      .findAll("button")
      .find((button) => button.text() === "Most recent");
    expect(recent).toBeTruthy();
    await recent!.trigger("click");
    await flushPromises();

    expect(lastVariables().orderBy).toEqual([{ created_at: "desc" }]);
  });
});
