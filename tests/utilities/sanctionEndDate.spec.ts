import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CalendarDate } from "@internationalized/date";
import {
  editedEndDate,
  fromEditFields,
  toEditFields,
} from "~/utilities/sanctionEndDate";

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTz;
  }
});

describe("sanction end date under America/New_York", () => {
  beforeEach(() => {
    process.env.TZ = "America/New_York";
  });

  it("is really running in New York", () => {
    expect(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()).toBe(300);
    expect(new Date("2026-07-15T12:00:00Z").getTimezoneOffset()).toBe(240);
  });

  it("shows the stored instant on the New York wall clock", () => {
    const fields = toEditFields("2026-03-01T02:30:00Z");

    expect(fields.date.toString()).toBe("2026-02-28");
    expect(fields.time).toBe("21:30");
  });

  it("saves the picked wall clock as the same instant it showed", () => {
    const iso = "2026-03-01T02:30:00.000Z";
    const { date, time } = toEditFields(iso);

    expect(fromEditFields(date, time).toISOString()).toBe(iso);
  });

  it("reads a picked time as New York time", () => {
    const saved = fromEditFields(new CalendarDate(2026, 7, 4), "09:15");

    expect(saved.toISOString()).toBe("2026-07-04T13:15:00.000Z");
  });

  it("keeps the second 01:30 of the fall-back night when saved unchanged", () => {
    const iso = "2026-11-01T06:30:00.000Z";
    const { date, time } = toEditFields(iso);

    expect(time).toBe("01:30");
    expect(editedEndDate(iso, date, time).toISOString()).toBe(iso);
  });

  it("keeps the stored seconds when saved unchanged", () => {
    const iso = "2026-03-01T02:30:45.000Z";
    const { date, time } = toEditFields(iso);

    expect(editedEndDate(iso, date, time).toISOString()).toBe(iso);
  });

  it("uses the picked wall clock once a field changes", () => {
    const iso = "2026-03-01T02:30:45.000Z";
    const { date } = toEditFields(iso);

    expect(editedEndDate(iso, date, "22:00").toISOString()).toBe(
      "2026-03-01T03:00:00.000Z",
    );
    expect(
      editedEndDate(null, new CalendarDate(2026, 7, 4), "09:15").toISOString(),
    ).toBe("2026-07-04T13:15:00.000Z");
  });
});

describe("sanction end date under Asia/Kolkata", () => {
  beforeEach(() => {
    process.env.TZ = "Asia/Kolkata";
  });

  it("is really running in Kolkata", () => {
    expect(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()).toBe(-330);
  });

  it("shows the stored instant on the Kolkata wall clock", () => {
    const fields = toEditFields("2026-02-28T20:00:00Z");

    expect(fields.date.toString()).toBe("2026-03-01");
    expect(fields.time).toBe("01:30");
  });

  it("saves the picked wall clock as the same instant it showed", () => {
    const iso = "2026-02-28T20:00:00.000Z";
    const { date, time } = toEditFields(iso);

    expect(fromEditFields(date, time).toISOString()).toBe(iso);
  });

  it("reads a picked time as Kolkata time", () => {
    const saved = fromEditFields(new CalendarDate(2026, 7, 4), "09:15");

    expect(saved.toISOString()).toBe("2026-07-04T03:45:00.000Z");
  });
});
