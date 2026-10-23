import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { CalendarDate } from "@internationalized/date";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const inDays = (days: number, hours: number, minutes: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// The match page rebuilds its match on every subscription result, so the
// same schedule arrives again as a new object.
const match = (scheduledAt: Date | null, extra: Record<string, any> = {}) => ({
  id: "m-1",
  scheduled_at: scheduledAt?.toISOString() ?? null,
  ...extra,
});

async function mountSchedule(scheduledAt: Date | null) {
  wrapper = await mountSuspended(ScheduleMatch, {
    props: { match: match(scheduledAt) },
  });
  return wrapper.vm as any;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("ScheduleMatch", () => {
  it("fills the form from the match's schedule", async () => {
    const scheduled = inDays(2, 18, 30);
    const form = await mountSchedule(scheduled);

    expect(form.startTime).toBe("18:30");
    expect(form.startDate.day).toBe(scheduled.getDate());
  });

  it("keeps a half-picked reschedule when the same schedule arrives again", async () => {
    const form = await mountSchedule(inDays(2, 18, 30));
    const picked = inDays(5, 0, 0);
    form.startDate = new CalendarDate(
      picked.getFullYear(),
      picked.getMonth() + 1,
      picked.getDate(),
    );
    form.startTime = "21:15";

    await wrapper!.setProps({
      match: match(inDays(2, 18, 30), { status: "WaitingForCheckIn" }),
    });

    expect(form.startTime).toBe("21:15");
    expect(form.startDate.day).toBe(picked.getDate());
  });

  it("keeps the fields cleared when the same schedule arrives again", async () => {
    const form = await mountSchedule(inDays(2, 18, 30));

    await form.resetSchedule();
    await wrapper!.setProps({ match: match(inDays(2, 18, 30)) });

    expect(form.startDate).toBeUndefined();
    expect(form.startTime).toBeUndefined();
  });

  it("takes a schedule someone else changed", async () => {
    const form = await mountSchedule(inDays(2, 18, 30));
    form.startTime = "21:15";

    const moved = inDays(3, 9, 45);
    await wrapper!.setProps({ match: match(moved) });

    expect(form.startTime).toBe("09:45");
    expect(form.startDate.day).toBe(moved.getDate());
  });
});
