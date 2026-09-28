import { CalendarDate } from "@internationalized/date";

export interface SanctionEditFields {
  date: CalendarDate;
  time: string;
}

type CalendarDay = Pick<CalendarDate, "year" | "month" | "day">;

const pad = (value: number) => value.toString().padStart(2, "0");

/**
 * The picker's date and time are both the viewer's wall clock. The day comes
 * from the same local `Date` getters as the time: `getLocalTimeZone()` is
 * memoized for the life of the page, so pairing it with `getHours()` can put
 * the day and the hour in two different zones.
 */
export function toEditFields(iso: string): SanctionEditFields {
  const date = new Date(iso);
  return {
    date: new CalendarDate(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    ),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function fromEditFields(date: CalendarDay, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(date.year, date.month - 1, date.day, hours, minutes);
}
