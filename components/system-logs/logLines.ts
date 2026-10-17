// Turning raw pod log lines into something the Mix view can merge, filter,
// count and group. Pure functions: the stream composable feeds them, the
// specs pin them down.

export type LogLevel = "ERROR" | "WARN" | "LOG" | "DEBUG";

export type RawLogEntry = {
  log: string;
  pod?: string;
  node?: string;
  container?: string;
  timestamp?: string;
};

export type LogLine = {
  id: number;
  service: string;
  pod: string;
  node: string;
  container: string;
  timestamp: string;
  t: number;
  level: LogLevel;
  // A continuation of the line before it (a stack frame, a wrapped value):
  // shown at that line's level, never counted on its own.
  cont: boolean;
  ctx: string | null;
  msg: string;
  raw: string;
  key: string;
};

export const SERVICES = [
  "api",
  "web",
  "game-server-node",
  "demo-parser",
  "hasura",
  "typesense",
  "timescaledb",
  "redis",
  "rustfs",
  "mediamtx",
] as const;

export const PRESETS: Record<string, readonly string[]> = {
  core: ["api", "hasura", "timescaledb", "game-server-node", "redis"],
  match: ["api", "game-server-node", "demo-parser", "rustfs"],
  media: ["api", "mediamtx", "rustfs"],
  all: SERVICES,
};

export const LEVEL_FILTERS = ["all", "warn", "error"] as const;

// A remembered selection keeps its order (the last service picked is the one
// that keeps streaming) but drops anything this page no longer has. Nothing
// usable left means the Core preset.
export function rememberedServices(value: unknown): string[] {
  const known = new Set<string>(SERVICES);
  const picked = Array.isArray(value)
    ? [...new Set(value)].filter(
        (service): service is string =>
          typeof service === "string" && known.has(service),
      )
    : [];
  return picked.length ? picked : [...PRESETS.core];
}

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

export function stripAnsi(text: string) {
  return text.replace(ANSI, "");
}

const NEST =
  /^\[Nest\]\s+\d+\s+-\s+.+?\s+(LOG|ERROR|WARN|DEBUG|VERBOSE|FATAL)\s+(?:\[([^\]]+)\]\s*)?([\s\S]*)$/;

const WORD_LEVEL: Record<string, LogLevel> = {
  error: "ERROR",
  err: "ERROR",
  fatal: "ERROR",
  critical: "ERROR",
  crit: "ERROR",
  panic: "ERROR",
  alert: "ERROR",
  emerg: "ERROR",
  warn: "WARN",
  warning: "WARN",
  debug: "DEBUG",
  trace: "DEBUG",
  verbose: "DEBUG",
};

const levelWord = (word: string): LogLevel =>
  WORD_LEVEL[word.toLowerCase()] ?? "LOG";

export function parseMessage(text: string): {
  level: LogLevel;
  ctx: string | null;
  msg: string;
} {
  const nest = text.match(NEST);
  if (nest) {
    return {
      level: nest[1] === "LOG" ? "LOG" : levelWord(nest[1]),
      ctx: nest[2] ?? null,
      msg: nest[3],
    };
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const word = json?.level ?? json?.severity ?? json?.lvl;
      if (typeof word === "string") {
        return { level: levelWord(word), ctx: null, msg: text };
      }
    } catch {
      // not JSON after all
    }
  }

  const logfmt = text.match(/\b(?:level|lvl|severity)=("?)([a-zA-Z]+)\1/);
  if (logfmt) {
    return { level: levelWord(logfmt[2]), ctx: null, msg: text };
  }

  // glog (typesense): I20261016 14:02:01.123 ...
  const glog = text.match(/^([IWEF])\d{8}\s/);
  if (glog) {
    const level: LogLevel =
      glog[1] === "W" ? "WARN" : glog[1] === "I" ? "LOG" : "ERROR";
    return { level, ctx: null, msg: text };
  }

  // Postgres: "LOG:  checkpoint complete", "ERROR:  deadlock detected"
  const pg = text.match(
    /\b(PANIC|FATAL|ERROR|WARNING|LOG|INFO|NOTICE|DETAIL|HINT|STATEMENT|DEBUG\d?):\s/,
  );
  if (pg) {
    const word = pg[1];
    const level: LogLevel =
      word === "PANIC" || word === "FATAL" || word === "ERROR"
        ? "ERROR"
        : word === "WARNING"
          ? "WARN"
          : word.startsWith("DEBUG")
            ? "DEBUG"
            : "LOG";
    return { level, ctx: null, msg: text };
  }

  // mediamtx: "INF [WebRTC] ...", "WAR ...", "ERR ..."
  const mtx = text.match(
    /^(?:\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d )?(ERR|WAR|INF|DEB)\s/,
  );
  if (mtx) {
    const level: LogLevel =
      mtx[1] === "ERR"
        ? "ERROR"
        : mtx[1] === "WAR"
          ? "WARN"
          : mtx[1] === "DEB"
            ? "DEBUG"
            : "LOG";
    return { level, ctx: null, msg: text };
  }

  // redis: "1:M 16 Oct 2026 14:02:01.123 # WARNING ..."
  const redis = text.match(/^\d+:[XCSM] .+?\d\d:\d\d:\d\d\.\d+ ([.\-*#]) /);
  if (redis) {
    const level: LogLevel =
      redis[1] === "#" ? "WARN" : redis[1] === "." ? "DEBUG" : "LOG";
    return { level, ctx: null, msg: text };
  }

  // Rust / Go loggers: an upper-case level word on its own.
  const word = text.match(
    /\b(ERROR|FATAL|PANIC|CRITICAL|WARN|WARNING|INFO|DEBUG|TRACE)\b/,
  );
  if (word) {
    return { level: levelWord(word[1]), ctx: null, msg: text };
  }

  // A thrown error printed bare: "[nitro] FetchError: ...", "TypeError: ..."
  if (
    /^(?:\[[^\]]+\]\s*)?(?:[A-Z]\w*Error\b|Error:|Uncaught|Unhandled)/.test(
      trimmed,
    )
  ) {
    return { level: "ERROR", ctx: null, msg: text };
  }

  return { level: "LOG", ctx: null, msg: text };
}

export function parseTime(timestamp: string | undefined) {
  if (!timestamp) return 0;
  const t = Date.parse(timestamp.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(t) ? 0 : t;
}

export function lineKey(service: string, entry: RawLogEntry) {
  return [
    service,
    entry.pod || "default",
    entry.container || "default",
    entry.timestamp || "",
    entry.log || "",
  ].join("|");
}

export function toLogLine(
  id: number,
  service: string,
  entry: RawLogEntry,
  previous?: LogLine | null,
): LogLine {
  // The api strips the kubelet timestamp and leaves the space after it.
  const raw = stripAnsi(entry.log || "")
    .replace(/^ /, "")
    .replace(/\r?\n$/, "");
  const samePod = !!previous && previous.pod === (entry.pod || "default");
  // The api splits each chunk on newlines, so a line cut across two chunks
  // arrives as a second entry with no timestamp: it carries on the last one.
  const cont =
    samePod &&
    (!entry.timestamp || (/^(\s{2,}|\t)\S/.test(raw) && !NEST.test(raw)));
  const parsed = cont
    ? { level: previous!.level, ctx: null, msg: raw }
    : parseMessage(raw);
  return {
    id,
    service,
    pod: entry.pod || "default",
    node: entry.node || "",
    container: entry.container || "",
    timestamp: entry.timestamp || (samePod ? previous!.timestamp : ""),
    t: parseTime(entry.timestamp) || (samePod ? previous!.t : 0),
    level: parsed.level,
    cont,
    ctx: parsed.ctx,
    msg: parsed.msg,
    raw,
    key: lineKey(service, entry),
  };
}

export function compareLines(a: LogLine, b: LogLine) {
  if (a.t !== b.t) return a.t - b.t;
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
  return a.id - b.id;
}

// Where a line belongs in a time-ordered list. New lines are almost always
// the newest, so the search walks back from the end.
export function insertSorted(list: LogLine[], line: LogLine) {
  let i = list.length;
  while (i > 0 && compareLines(list[i - 1], line) > 0) i--;
  list.splice(i, 0, line);
  return i;
}

export type LevelFilter = "all" | "warn" | "error";

export function levelMatches(line: LogLine, filter: LevelFilter) {
  if (filter === "all") return true;
  if (filter === "error") return line.level === "ERROR";
  return line.level === "WARN" || line.level === "ERROR";
}

export function textMatches(line: LogLine, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    line.msg.toLowerCase().includes(q) ||
    (line.ctx || "").toLowerCase().includes(q) ||
    line.pod.toLowerCase().includes(q)
  );
}

// What makes two warnings "the same": level, context and the message with
// ids, steam ids, hashes and numbers taken out.
export function signatureOf(line: LogLine) {
  const msg = line.msg
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "‹id›",
    )
    .replace(/7656\d{13}/g, "‹steam›")
    .replace(/\b[0-9a-f]{6,}\b/gi, (m) => (/\d/.test(m) ? "‹id›" : m))
    .replace(/\d+(\.\d+)?/g, "#");
  return `${line.level}|${line.ctx || ""}|${msg}`;
}

export type LogGroup = {
  sig: string;
  level: LogLevel;
  ctx: string | null;
  last: LogLine;
  count: number;
  services: string[];
};

export function groupRepeats(lines: LogLine[], min = 2): LogGroup[] {
  const groups = new Map<string, LogGroup & { svc: Set<string> }>();
  for (const line of lines) {
    if (line.cont || (line.level !== "WARN" && line.level !== "ERROR")) {
      continue;
    }
    const sig = signatureOf(line);
    let g = groups.get(sig);
    if (!g) {
      g = {
        sig,
        level: line.level,
        ctx: line.ctx,
        last: line,
        count: 0,
        services: [],
        svc: new Set(),
      };
      groups.set(sig, g);
    }
    g.count++;
    g.svc.add(line.service);
    if (compareLines(line, g.last) >= 0) g.last = line;
  }
  return [...groups.values()]
    .filter((g) => g.count >= min)
    .map(({ svc, ...g }) => ({ ...g, services: [...svc] }))
    .sort(
      (a, b) =>
        Number(b.level === "ERROR") - Number(a.level === "ERROR") ||
        b.count - a.count,
    );
}

export function countLevels(lines: LogLine[]) {
  let warn = 0;
  let error = 0;
  for (const line of lines) {
    if (line.cont) continue;
    if (line.level === "WARN") warn++;
    else if (line.level === "ERROR") error++;
  }
  return { warn, error };
}

export type ServiceStatus = "ok" | "warn" | "bad" | "off";

export type ServiceRowStats = {
  status: ServiceStatus;
  rate: number;
  warn: number;
  error: number;
  spark: number[];
  streaming: boolean;
};

// Judged on the last five minutes only, so an old burst stops colouring it.
export function serviceStatus(
  lines: LogLine[],
  now: number,
  minutes = 5,
): ServiceStatus {
  if (!lines.length) return "off";
  const from = now - minutes * 60000;
  let warn = false;
  for (let i = lines.length - 1; i >= 0 && lines[i].t >= from; i--) {
    if (lines[i].cont) continue;
    if (lines[i].level === "ERROR") return "bad";
    if (lines[i].level === "WARN") warn = true;
  }
  return warn ? "warn" : "ok";
}

export function ratePerMinute(lines: LogLine[], now: number) {
  const from = now - 60000;
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i].t >= from; i--) n++;
  return n;
}

export function sparkBuckets(lines: LogLine[], now: number, count = 15) {
  const out = Array(count).fill(0) as number[];
  for (let i = lines.length - 1; i >= 0; i--) {
    const k = Math.floor((now - lines[i].t) / 60000);
    if (k >= count) break;
    if (k >= 0) out[count - 1 - k]++;
  }
  return out;
}

export type VolumeBucket = {
  t: number;
  size: number;
  LOG: number;
  WARN: number;
  ERROR: number;
};

// Per-minute volume over the loaded window, widened to several minutes a
// bar when the window is long so the strip stays at most `maxBars` wide.
export function volumeBuckets(
  lines: LogLine[],
  now: number,
  maxBars = 120,
): VolumeBucket[] {
  if (!lines.length) return [];
  let first = now;
  for (const line of lines) if (line.t && line.t < first) first = line.t;
  const span = Math.max(1, Math.ceil((now - first) / 60000));
  const per = Math.max(1, Math.ceil(span / maxBars));
  const n = Math.ceil(span / per);
  const size = per * 60000;
  const start = now - n * size;
  const buckets: VolumeBucket[] = Array.from({ length: n }, (_, i) => ({
    t: start + i * size,
    size,
    LOG: 0,
    WARN: 0,
    ERROR: 0,
  }));
  for (const line of lines) {
    const i = Math.floor((line.t - start) / size);
    if (i < 0 || i >= n) continue;
    const level = line.cont || line.level === "DEBUG" ? "LOG" : line.level;
    buckets[i][level]++;
  }
  return buckets;
}

export function highlight(text: string, query: string) {
  if (!query) return [{ text, hit: false }];
  const out: Array<{ text: string; hit: boolean }> = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let at = 0;
  for (;;) {
    const i = lower.indexOf(q, at);
    if (i < 0) break;
    if (i > at) out.push({ text: text.slice(at, i), hit: false });
    out.push({ text: text.slice(i, i + q.length), hit: true });
    at = i + q.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

const p2 = (n: number, w = 2) => String(n).padStart(w, "0");

export function clockTime(t: number, ms = true) {
  const d = new Date(t);
  const base = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  return ms ? `${base}.${p2(d.getMilliseconds(), 3)}` : base;
}

export function hourMinute(t: number) {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function podShort(pod: string) {
  return pod.split("-").pop() || pod;
}
