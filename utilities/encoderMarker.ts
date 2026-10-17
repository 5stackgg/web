// The live encoder pick of an AMD game-streamer pod. The pod adds
// progress_stage "encoder:<element>" (for example "encoder:vah264enc") to its
// status=live report; NVIDIA pods never send one. The api appends a history
// entry on each status change and replaces the last entry when the status
// repeats, so the newest marker is the last matching entry in array order.
export type EncoderMarker = {
  // The GStreamer encoder element, such as vah264enc or x264enc.
  element: string;
  // true for x264enc, the CPU fallback, which the busy pill shows as a warning.
  warning: boolean;
};

const MARKER_PREFIX = "encoder:";

export function pickEncoderMarker(history: unknown): EncoderMarker | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (!entry || typeof entry !== "object") continue;
    const { status, progress_stage } = entry as Record<string, unknown>;
    if (status !== "live" || typeof progress_stage !== "string") continue;
    if (!progress_stage.startsWith(MARKER_PREFIX)) continue;
    const element = progress_stage.slice(MARKER_PREFIX.length);
    if (!element) continue;
    return { element, warning: element === "x264enc" };
  }
  return null;
}
