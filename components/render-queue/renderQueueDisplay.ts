import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock,
  Loader2,
  MinusCircle,
  Upload,
} from "lucide-vue-next";
import type { LedgerClipJob } from "~/components/render-queue/renderQueueLedger";

type Translate = (key: string, named?: Record<string, unknown>) => string;

export function clipTitle(job: LedgerClipJob, t: Translate): string {
  const title = job.spec?.title;
  if (typeof title === "string" && title.length > 0) {
    return title;
  }
  const target = job.spec?.target_name;
  if (typeof target === "string" && target.length > 0) {
    return t("clips.render_queue.target_clip", { name: target });
  }
  return t("clips.render_queue.render_id", { id: job.id.slice(0, 8) });
}

export type ClipDetail = { label: string; tone?: "round" | "kills" };

export function clipDetails(job: LedgerClipJob): ClipDetail[] {
  const out: ClipDetail[] = [];
  const round = job.spec?.round;
  if (typeof round === "number" && round > 0) {
    out.push({ label: `R${round}`, tone: "round" });
  }
  const kills = job.spec?.kills_count;
  if (typeof kills === "number" && kills > 0) {
    out.push({ label: `${kills}K`, tone: "kills" });
  }
  const segments = job.spec?.segments;
  if (Array.isArray(segments) && segments.length > 1) {
    out.push({ label: `${segments.length} seg` });
  }
  return out;
}

export function clipDuration(job: LedgerClipJob): string | null {
  const ms =
    typeof job.spec?.duration_ms === "number" ? job.spec.duration_ms : 0;
  if (ms <= 0) {
    return null;
  }
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The render job's own pod, when it has one worth reading logs from.
export function logService(name: string | null | undefined): string | null {
  if (!name || name === "pending" || name === "dev-attach") {
    return null;
  }
  return name;
}

export function statusToneClass(status: string): string {
  switch (status) {
    case "rendering":
      return "text-[hsl(var(--tac-amber))]";
    case "uploading":
      return "text-info";
    case "done":
      return "text-success";
    case "error":
    case "missing":
      return "text-destructive";
    case "cancelled":
      return "text-muted-foreground/70";
    default:
      return "text-muted-foreground";
  }
}

export function statusIcon(status: string) {
  switch (status) {
    case "queued":
      return Clock;
    case "rendering":
      return Loader2;
    case "uploading":
      return Upload;
    case "done":
      return CircleCheck;
    case "error":
    case "missing":
      return CircleAlert;
    case "skipped":
      return MinusCircle;
    default:
      return CircleSlash;
  }
}

// Compact so it sits in a column of numbers: 45s, 6m, 1h04, 3d.
export function since(at: number, now: number): string {
  if (!at) {
    return "";
  }
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
  }
  return `${Math.floor(hours / 24)}d`;
}
