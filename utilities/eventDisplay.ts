import { e_event_status_enum } from "~/generated/zeus";

export function formatEventDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === e_event_status_enum.Live) return "destructive";
  if (status === e_event_status_enum.Finished) return "secondary";
  return "outline";
}

export function statusLabelKey(status: string): string {
  return `event.status.${status.toLowerCase()}`;
}
