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
