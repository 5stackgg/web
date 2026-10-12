import { dateLocale } from "~/utilities/dateLocale";

export function chartTooltipTime(time: Date | null | undefined): string {
  if (!time) {
    return "";
  }
  return time.toLocaleString(dateLocale(), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
