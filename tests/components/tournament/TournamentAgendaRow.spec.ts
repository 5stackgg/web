import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentAgendaRow from "~/components/tournament/TournamentAgendaRow.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

describe("TournamentAgendaRow date", () => {
  it("shows the day and weekday without repeating the month heading", async () => {
    const start = new Date(2026, 9, 17, 18, 0);
    const wrapper = await mountSuspended(TournamentAgendaRow, {
      props: {
        tournament: {
          id: "t-1",
          name: "Autumn Cup",
          status: "RegistrationOpen",
          start: start.toISOString(),
          teams_aggregate: { aggregate: { count: 12 } },
          stages: [],
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const weekday = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
    }).format(start);
    const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(
      start,
    );
    const dateColumn = wrapper.find("span.border-r");

    expect(dateColumn.find("b").text()).toBe("17");
    expect(dateColumn.find("span").text()).toBe(weekday);
    expect(dateColumn.text()).not.toContain(month);
  });
});
