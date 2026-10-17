// Dates, durations and lists for the nodes page, all in the user's locale.
import { dateLocale } from "~/utilities/dateLocale";

const asDate = (value: string | number | Date | null | undefined) => {
  if (value == null) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Today's times as 14:02, older ones as a date.
export function clockLabel(value: string | number | Date | null | undefined) {
  const date = asDate(value);
  if (!date) {
    return "";
  }
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}

export function timeLabel(value: number, seconds = false) {
  const date = asDate(value);
  if (!date) {
    return "";
  }
  return seconds
    ? date.toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : date.toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function relativeTime(value: string | number | Date | null | undefined) {
  const date = asDate(value);
  if (!date) {
    return "";
  }
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(dateLocale(), {
    numeric: "auto",
  });
  const abs = Math.abs(seconds);
  if (abs < 60) {
    return format.format(seconds, "second");
  }
  if (abs < 3600) {
    return format.format(Math.round(seconds / 60), "minute");
  }
  if (abs < 86400) {
    return format.format(Math.round(seconds / 3600), "hour");
  }
  return format.format(Math.round(seconds / 86400), "day");
}

// 5 min, 2 h 10 min.
export function durationLabel(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const unit = (value: number, name: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(dateLocale(), {
      style: "unit",
      unit: name,
      unitDisplay: "short",
    }).format(value);
  if (minutes < 60) {
    return unit(minutes, "minute");
  }
  if (minutes < 1440) {
    const rest = minutes % 60;
    return rest
      ? `${unit(Math.floor(minutes / 60), "hour")} ${unit(rest, "minute")}`
      : unit(minutes / 60, "hour");
  }
  return unit(Math.round(minutes / 1440), "day");
}

export function listLabel(items: Array<string>) {
  try {
    return new Intl.ListFormat(dateLocale(), {
      style: "long",
      type: "conjunction",
    }).format(items);
  } catch {
    return items.join(", ");
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
