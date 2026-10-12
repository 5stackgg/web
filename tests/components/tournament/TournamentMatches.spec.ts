import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentMatches from "~/components/tournament/TournamentMatches.vue";

const rows = ref<Array<Record<string, unknown>>>([]);

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: vi.fn() } }),
  useSubscription: () => ({
    result: ref({ matches: rows.value }),
    loading: ref(false),
  }),
}));

const PlayerMatchesTable = defineComponent({
  name: "PlayerMatchesTable",
  props: { matches: { type: Array, default: () => [] } },
  setup(props) {
    return () =>
      h(
        "ol",
        (props.matches as Array<{ id: string }>).map((match) =>
          h("li", { "data-match": match.id }, match.id),
        ),
      );
  },
});

const Pagination = defineComponent({
  name: "Pagination",
  props: { page: Number, total: Number, perPage: Number },
  emits: ["page"],
  setup(props, { emit }) {
    return () =>
      h(
        "button",
        {
          "data-pagination": props.page,
          onClick: () => emit("page", (props.page ?? 1) + 1),
        },
        "next",
      );
  },
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  rows.value = [];
  localStorage.clear();
});

function match(id: string, status: string, at: string) {
  return {
    id,
    status,
    created_at: "2026-10-01T00:00:00Z",
    scheduled_at: status === "Scheduled" ? at : null,
    started_at: status === "Scheduled" ? null : at,
    ended_at: status === "Finished" ? at : null,
  };
}

async function mountMatches() {
  const wrapper = await mountSuspended(TournamentMatches, {
    props: { tournamentId: "tournament-1" },
    global: { stubs: { PlayerMatchesTable, Pagination } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function shown(wrapper: Awaited<ReturnType<typeof mountMatches>>) {
  return wrapper.findAll("[data-match]").map((row) => row.text());
}

function filter(
  wrapper: Awaited<ReturnType<typeof mountMatches>>,
  label: string,
) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text().startsWith(label));
  if (!button) {
    throw new Error(`no ${label} filter`);
  }
  return button;
}

describe("TournamentMatches", () => {
  it("opens on All, live first, with a count on every filter", async () => {
    rows.value = [
      match("finished", "Finished", "2026-10-10T19:00:00Z"),
      match("scheduled", "Scheduled", "2026-10-12T20:00:00Z"),
      match("live", "Live", "2026-10-11T21:30:00Z"),
      match("canceled", "Canceled", "2026-10-08T18:00:00Z"),
    ];

    const wrapper = await mountMatches();

    expect(shown(wrapper)).toEqual([
      "live",
      "scheduled",
      "finished",
      "canceled",
    ]);
    expect(filter(wrapper, "Live").text()).toMatch(/1$/);
    expect(filter(wrapper, "Upcoming").text()).toMatch(/1$/);
    expect(filter(wrapper, "Results").text()).toMatch(/1$/);
    expect(filter(wrapper, "All").text()).toMatch(/4$/);
  });

  it("shows only the picked filter's matches, and never a cancelled one", async () => {
    rows.value = [
      match("finished", "Finished", "2026-10-10T19:00:00Z"),
      match("live", "Live", "2026-10-11T21:30:00Z"),
      match("canceled", "Canceled", "2026-10-08T18:00:00Z"),
    ];

    const wrapper = await mountMatches();
    await filter(wrapper, "Results").trigger("click");
    await flushPromises();

    expect(shown(wrapper)).toEqual(["finished"]);
  });

  it.each([
    ["Live", "Nothing is live right now."],
    ["Upcoming", "No upcoming matches."],
    ["Results", "No results yet."],
  ])("says so when %s has nothing", async (label, message) => {
    rows.value = [match("canceled", "Canceled", "2026-10-08T18:00:00Z")];

    const wrapper = await mountMatches();
    await filter(wrapper, label).trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain(message);
  });

  it("explains an empty tournament under All", async () => {
    const wrapper = await mountMatches();

    expect(wrapper.text()).toContain(
      "No matches yet. They appear once the bracket is drawn.",
    );
    expect(filter(wrapper, "All").text()).toMatch(/0$/);
  });

  it("goes back to the first page when the filter changes", async () => {
    rows.value = Array.from({ length: 25 }, (_, index) =>
      match(
        `finished-${index}`,
        "Finished",
        new Date(Date.UTC(2026, 9, 1, index)).toISOString(),
      ),
    );

    const wrapper = await mountMatches();
    await wrapper.get("[data-pagination]").trigger("click");
    expect(wrapper.get("[data-pagination]").attributes("data-pagination")).toBe(
      "2",
    );

    await filter(wrapper, "Results").trigger("click");
    await flushPromises();

    expect(wrapper.get("[data-pagination]").attributes("data-pagination")).toBe(
      "1",
    );
  });
});
