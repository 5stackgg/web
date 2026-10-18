import { onBeforeUnmount, ref, shallowRef, triggerRef } from "vue";
import socket from "~/web-sockets/Socket";
import {
  insertSorted,
  lineKey,
  toLogLine,
  type LogLine,
  type RawLogEntry,
} from "~/components/system-logs/logLines";

// Several services' log streams merged into one time-ordered list.
//
// Requests go out one at a time, each waiting for its tail to land before the
// next. The api keeps one live stream per service (and a separate one for an
// earlier window), so every selected service stays live; an older api kept a
// single stream per socket and cut each tail off when the next request came,
// which the one-at-a-time queue still copes with.

const MAX_PER_SERVICE = 2400;
const TAIL_LINES = 250;
const TAIL_SETTLE_MS = 400;
const TAIL_TIMEOUT_MS = 2500;
const SINCE_TIMEOUT_MS = 15000;
const RETRY_MS = 5000;
const FLUSH_MS = 120;

type Job =
  | { service: string; kind: "tail" }
  | { service: string; kind: "since"; since: { start: string; until: string } };

export type LogFlush = {
  added: LogLine[];
  // Every added line is older than what was already held for its service:
  // an earlier page, which lands above the reader.
  olderOnly: boolean;
};

export function useSystemLogStreams() {
  const lines = shallowRef<LogLine[]>([]);
  const pods = ref<Record<string, string[]>>({});
  const offline = ref(false);
  const earlier = ref<"idle" | "loading" | "start">("idle");
  const lastFlush = shallowRef<LogFlush>({ added: [], olderOnly: false });
  const active = ref<string[]>([]);

  const all: LogLine[] = [];
  const byService = new Map<string, LogLine[]>();
  const seen = new Set<string>();
  const lastByPod = new Map<string, LogLine>();
  const listeners = new Map<string, { stop: () => void }>();
  const retries = new Map<string, ReturnType<typeof setTimeout>>();
  let seq = 0;
  let pending: Array<{ service: string; entry: RawLogEntry }> = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const queue: Job[] = [];
  let running: {
    job: Job;
    timeout: ReturnType<typeof setTimeout>;
    settle?: ReturnType<typeof setTimeout>;
  } | null = null;

  let sinceBatch: { remaining: Set<string>; added: number } | null = null;

  function isActive(service: string) {
    return active.value.includes(service);
  }

  function serviceLines(service: string) {
    return byService.get(service) || [];
  }

  function flush() {
    flushTimer = undefined;
    const batch = pending;
    pending = [];
    const added: LogLine[] = [];
    let olderOnly = true;
    const touchedPods = new Set<string>();

    for (const { service, entry } of batch) {
      if (!isActive(service)) continue;
      const key = lineKey(service, entry);
      if (seen.has(key)) continue;
      seen.add(key);

      const list = byService.get(service) || [];
      byService.set(service, list);
      const podKey = `${service}|${entry.pod || "default"}`;
      const previous = lastByPod.get(podKey) || null;
      const line = toLogLine(++seq, service, entry, previous);
      const newest = list.length === 0 || line.t >= list[list.length - 1].t;
      if (list.length && line.t >= list[0].t) olderOnly = false;
      if (!list.length) olderOnly = false;
      if (newest && (!previous || line.t >= previous.t)) {
        lastByPod.set(podKey, line);
      }
      insertSorted(list, line);
      insertSorted(all, line);
      added.push(line);
      touchedPods.add(service);
      if (sinceBatch && !newest) sinceBatch.added++;
    }

    let trimmed = false;
    for (const [service, list] of byService) {
      if (list.length > MAX_PER_SERVICE + 200) {
        const drop = list.splice(0, list.length - MAX_PER_SERVICE);
        const gone = new Set(drop.map((l) => l.id));
        for (const l of drop) seen.delete(l.key);
        for (let i = all.length - 1; i >= 0; i--) {
          if (gone.has(all[i].id)) all.splice(i, 1);
        }
        touchedPods.add(service);
        trimmed = true;
      }
    }

    if (!added.length && !trimmed) return;

    if (touchedPods.size) {
      const next = { ...pods.value };
      for (const service of touchedPods) {
        next[service] = [
          ...new Set(serviceLines(service).map((l) => l.pod)),
        ].sort();
      }
      pods.value = next;
    }

    lines.value = all;
    triggerRef(lines);
    lastFlush.value = { added, olderOnly: added.length > 0 && olderOnly };
  }

  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
  }

  function completeSince(service: string) {
    if (!sinceBatch) return;
    sinceBatch.remaining.delete(service);
    if (sinceBatch.remaining.size > 0) return;
    // Let the last page land before judging it.
    flush();
    earlier.value = sinceBatch.added > 0 ? "idle" : "start";
    sinceBatch = null;
    // An earlier page ends the live stream it replaced: pick it back up.
    for (const s of active.value) enqueue({ service: s, kind: "tail" });
  }

  function finishJob() {
    if (!running) return;
    clearTimeout(running.timeout);
    clearTimeout(running.settle);
    const { job } = running;
    running = null;
    if (job.kind === "since") completeSince(job.service);
    pump();
  }

  function pump() {
    if (running) return;
    const job = queue.shift();
    if (!job) return;
    if (!isActive(job.service)) {
      if (job.kind === "since") completeSince(job.service);
      pump();
      return;
    }
    running = {
      job,
      timeout: setTimeout(
        finishJob,
        job.kind === "tail" ? TAIL_TIMEOUT_MS : SINCE_TIMEOUT_MS,
      ),
    };
    socket.event(
      "logs",
      job.kind === "tail"
        ? { tailLines: TAIL_LINES, service: job.service }
        : { service: job.service, since: job.since },
    );
  }

  function enqueue(job: Job) {
    if (
      job.kind === "tail" &&
      queue.some((j) => j.kind === "tail" && j.service === job.service)
    ) {
      return;
    }
    queue.push(job);
    pump();
  }

  function onMessage(service: string, raw: string) {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (data?.end) {
      if (running?.job.service === service) finishJob();
      if (!data.partial && isActive(service) && !retries.has(service)) {
        retries.set(
          service,
          setTimeout(() => {
            retries.delete(service);
            if (isActive(service)) enqueue({ service, kind: "tail" });
          }, RETRY_MS),
        );
      }
      return;
    }
    if (!data?.log) return;
    pending.push({ service, entry: data });
    scheduleFlush();
    if (running?.job.kind === "tail" && running.job.service === service) {
      clearTimeout(running.settle);
      running.settle = setTimeout(finishJob, TAIL_SETTLE_MS);
    }
  }

  function purge(service: string) {
    const list = byService.get(service) || [];
    for (const l of list) seen.delete(l.key);
    byService.delete(service);
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].service === service) all.splice(i, 1);
    }
    for (const key of [...lastByPod.keys()]) {
      if (key.startsWith(`${service}|`)) lastByPod.delete(key);
    }
    const next = { ...pods.value };
    delete next[service];
    pods.value = next;
  }

  function setServices(next: string[]) {
    const wanted = [...new Set(next)];
    const removed = active.value.filter((s) => !wanted.includes(s));
    const added = wanted.filter((s) => !active.value.includes(s));
    active.value = wanted;

    for (const service of removed) {
      listeners.get(service)?.stop();
      listeners.delete(service);
      clearTimeout(retries.get(service));
      retries.delete(service);
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].service === service && queue[i].kind === "tail") {
          queue.splice(i, 1);
        }
      }
      purge(service);
    }
    if (removed.length) {
      lines.value = all;
      triggerRef(lines);
    }

    for (const service of added) {
      listeners.set(
        service,
        socket.listen(`logs:${service}`, (raw: string) =>
          onMessage(service, raw),
        ),
      );
      enqueue({ service, kind: "tail" });
    }
  }

  function loadEarlier() {
    if (earlier.value === "loading") return;
    const targets = active.value.filter((s) => serviceLines(s).length > 0);
    if (!targets.length) return;
    earlier.value = "loading";
    sinceBatch = { remaining: new Set(targets), added: 0 };
    for (const service of targets) {
      const oldest = new Date(serviceLines(service)[0].t);
      const start = new Date(oldest.getTime() - 60 * 60000);
      enqueue({
        service,
        kind: "since",
        since: { start: start.toISOString(), until: oldest.toISOString() },
      });
    }
  }

  const onlineListener = socket.listen("online", () => {
    offline.value = false;
    for (const service of active.value) enqueue({ service, kind: "tail" });
  });
  const offlineListener = socket.listen("offline", () => {
    offline.value = true;
  });

  // The api keeps following a stream until it's told to stop or the socket
  // closes, so a hidden tab or a page left behind would keep it running.
  function stopStream() {
    if (running) {
      clearTimeout(running.timeout);
      clearTimeout(running.settle);
      running = null;
    }
    queue.length = 0;
    for (const timer of retries.values()) clearTimeout(timer);
    retries.clear();
    // Named, so a stream another view has opened since is left alone.
    for (const service of active.value) socket.event("logs:stop", { service });
  }

  function onVisibility() {
    if (document.hidden) {
      stopStream();
      return;
    }
    for (const service of active.value) enqueue({ service, kind: "tail" });
  }
  document.addEventListener("visibilitychange", onVisibility);

  function dispose() {
    clearTimeout(flushTimer);
    stopStream();
    document.removeEventListener("visibilitychange", onVisibility);
    for (const l of listeners.values()) l.stop();
    listeners.clear();
    onlineListener.stop();
    offlineListener.stop();
  }

  onBeforeUnmount(dispose);

  return {
    lines,
    pods,
    offline,
    earlier,
    lastFlush,
    active,
    serviceLines,
    setServices,
    loadEarlier,
    dispose,
  };
}

export async function downloadFullServiceLogs(
  apiDomain: string,
  service: string,
) {
  const response = await fetch(
    `https://${apiDomain}/system/logs/download?service=${service}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ service }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to download logs");
  }
  const blob = await response.blob();
  let filename = `${service}-logs.zip`;
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  if (match) filename = match[1];
  saveBlob(blob, filename);
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
