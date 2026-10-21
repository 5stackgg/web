import { dateLocale } from "~/utilities/dateLocale";
import { dayOffset } from "~/utilities/scrimSchedule";

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase(dateLocale()) + text.slice(1);

export function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(dateLocale(), {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function rangeLabel(start: number, end: number): string {
  const format = new Intl.DateTimeFormat(dateLocale(), {
    hour: "numeric",
    minute: "2-digit",
  });
  return format.formatRange(new Date(start), new Date(end));
}

// "Today", "Tomorrow", then "Fri, Oct 23"; `inline` keeps the relative
// words lower case for the middle of a sentence.
export function dayLabel(
  ms: number,
  now: Date,
  { inline = false }: { inline?: boolean } = {},
): string {
  const offset = dayOffset(ms, now);
  if (offset === 0 || offset === 1) {
    const word = new Intl.RelativeTimeFormat(dateLocale(), {
      numeric: "auto",
    }).format(offset, "day");
    return inline ? word : capitalize(word);
  }
  return new Date(ms).toLocaleDateString(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fullDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortDateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}

export function weekdayLabel(ms: number, now: Date): string {
  return dayOffset(ms, now) === 0
    ? dayLabel(ms, now)
    : new Date(ms).toLocaleDateString(dateLocale(), { weekday: "short" });
}

export function weekdayName(dow: number, style: "short" | "long" = "short") {
  return new Date(1970, 0, 4 + dow).toLocaleDateString(dateLocale(), {
    weekday: style,
  });
}

export function numberLabel(value: number | null | undefined): string {
  return value == null ? "—" : Math.round(value).toLocaleString(dateLocale());
}

export function minutesLabel(minutes: number): string {
  return timeLabel(new Date(1970, 0, 4, 0, minutes).getTime());
}
