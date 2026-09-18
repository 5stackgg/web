import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventSquare from "~/components/events/EventSquare.vue";
import { formatEventDate } from "~/utilities/eventDisplay";

const DAY = 24 * 3_600_000;

function event(starts_at: string, ends_at: string | null) {
  return {
    id: "event-1",
    name: "Spring Invitational",
    starts_at,
    ends_at,
    visibility: "Public",
    banner: null,
  };
}

async function chip(ev: ReturnType<typeof event>, label: string) {
  const wrapper = await mountSuspended(EventSquare, { props: { event: ev } });
  const found = wrapper.findAll("span").find((s) => s.text() === label);
  expect(found, `phase chip "${label}"`).toBeTruthy();
  return { wrapper, chip: found! };
}

describe("EventSquare", () => {
  it("colours a finished event's chip as finished, not amber", async () => {
    const past = event(
      new Date(Date.now() - 3 * DAY).toISOString(),
      new Date(Date.now() - 2 * DAY).toISOString(),
    );

    const { chip: finishedChip } = await chip(past, "Finished");

    expect(finishedChip.classes()).toContain("text-success");
    expect(finishedChip.classes().join(" ")).not.toContain("tac-amber");
  });

  it("keeps the amber chip for upcoming events", async () => {
    const future = event(new Date(Date.now() + 2 * DAY).toISOString(), null);

    const { chip: upcomingChip } = await chip(future, "Upcoming");

    expect(upcomingChip.classes().join(" ")).toContain("tac-amber");
  });

  it("shows the start and end date of a finished event", async () => {
    const starts = new Date(Date.now() - 10 * DAY).toISOString();
    const ends = new Date(Date.now() - 8 * DAY).toISOString();

    const { wrapper } = await chip(event(starts, ends), "Finished");

    expect(wrapper.text().replace(/\s+/g, " ")).toContain(
      `${formatEventDate(starts)} – ${formatEventDate(ends)}`,
    );
  });
});
