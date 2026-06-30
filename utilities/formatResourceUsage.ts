/** Format used/total for RAM-style byte counters (same units as GraphQL memory metrics). */
export function formatUsedOverTotalBytes(used: number, total: number): string {
  if (total <= 0 || !Number.isFinite(used) || !Number.isFinite(total)) {
    return "—";
  }
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (total >= gb) {
    return `${(used / gb).toFixed(1)} GB / ${(total / gb).toFixed(1)} GB`;
  }
  return `${Math.round(used / mb)} MB / ${Math.round(total / mb)} MB`;
}

/** Format a single RAM-style byte counter, e.g. "1.2 GB" or "512 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / mb)} MB`;
}
