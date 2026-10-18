// Alert times as people read them, in the app's date locale. Kept apart from
// alertTimeline.ts so that file stays free of browser state for its specs.
import { dateLocale } from "~/utilities/dateLocale";
import { DAY, HOUR, MINUTE } from "~/utilities/alertTimeline";

// "in 2 hr." / "3 days ago", in the reader's language.
export function relativeTime(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const sign = diff < 0 ? -1 : 1;
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), {
    numeric: "auto",
    style: "short",
  });
  if (abs < HOUR) {
    return rtf.format(sign * Math.max(1, Math.round(abs / MINUTE)), "minute");
  }
  if (abs < DAY) return rtf.format(sign * Math.round(abs / HOUR), "hour");
  return rtf.format(sign * Math.round(abs / DAY), "day");
}

export function absoluteTime(ms: number): string {
  return new Date(ms).toLocaleString(dateLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// How long a period lasted: "45 min", "3 hr 20 min", "2 days 4 hr".
export function durationText(ms: number): string {
  const unit = (value: number, unit: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(dateLocale(), {
      style: "unit",
      unit,
      unitDisplay: "short",
    }).format(value);
  const pair = (
    big: number,
    bigUnit: "hour" | "day",
    small: number,
    smallUnit: "minute" | "hour",
  ) =>
    small
      ? `${unit(big, bigUnit)} ${unit(small, smallUnit)}`
      : unit(big, bigUnit);
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return pair(hours, "hour", minutes % 60, "minute");
  return pair(Math.floor(hours / 24), "day", hours % 24, "hour");
}
