// Each card on a GPU node with its newest reading, for the plate in the GPU
// nodes table and the card blocks in the inspectors. The name and capacity
// come from the node's gpu_info, the reading from getNodeStats.
import type { GpuNodeState } from "~/components/gpu-nodes/gpuSessions";

export const GPU_TEMP_HOT = 80;
export const GPU_TEMP_CRIT = 90;

export type GpuTone = "ok" | "warn" | "bad";

export type GpuDeviceView = {
  key: string;
  name: string | null;
  memoryMb: number | null;
  /** Percent. */
  load: number | null;
  vramUsedMb: number | null;
  /** Percent of the card's memory in use. */
  vram: number | null;
  temperature: number | null;
  power: number | null;
};

/** What a card is doing now, for its inspector block. */
export type GpuDoing = {
  tone: GpuNodeState["tone"];
  live: boolean;
  text: string;
  /** How long it has run, on the right. */
  aside?: string | null;
  /** A node-wide state (idle, disabled) rather than one session. */
  quiet?: boolean;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** "NVIDIA GeForce RTX 4080 SUPER" → "RTX 4080 SUPER". */
export function shortGpuName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  return name.replace(/^NVIDIA\s+/, "").replace(/^GeForce\s+/, "");
}

export function tempTone(celsius: number | null | undefined): GpuTone {
  if (celsius == null) return "ok";
  return celsius >= GPU_TEMP_CRIT
    ? "bad"
    : celsius >= GPU_TEMP_HOT
      ? "warn"
      : "ok";
}

export function loadTone(percent: number | null | undefined): GpuTone {
  if (percent == null) return "ok";
  return percent >= 85 ? "bad" : percent >= 70 ? "warn" : "ok";
}

export function vramTone(percent: number | null | undefined): GpuTone {
  if (percent == null) return "ok";
  return percent >= 97 ? "bad" : percent >= 90 ? "warn" : "ok";
}

function latestDevices(stats: any): any[] {
  const samples = Array.isArray(stats?.gpu) ? stats.gpu : [];
  for (let i = samples.length - 1; i >= 0; i--) {
    const devices = samples[i]?.devices;
    if (Array.isArray(devices) && devices.length) return devices;
  }
  return [];
}

export function gpuDevices(node: any, stats?: any): GpuDeviceView[] {
  const info: any[] = Array.isArray(node?.gpu_info)
    ? node.gpu_info.filter(Boolean)
    : [];
  const readings = latestDevices(stats).filter(Boolean);
  const count = Math.max(info.length, readings.length);
  const out: GpuDeviceView[] = [];
  for (let position = 0; position < count; position++) {
    const base = info[position];
    const index = num(base?.index) ?? position;
    const reading =
      readings.find((device) => num(device?.index) === index) ??
      readings[position];
    const memoryMb = num(reading?.memory_mb) ?? num(base?.memory_mb);
    const vramUsedMb = num(reading?.memory_used_mb);
    out.push({
      key: String(index),
      name: shortGpuName(base?.name) ?? shortGpuName(reading?.name),
      memoryMb,
      load: num(reading?.utilization_percent),
      vramUsedMb,
      vram:
        memoryMb && vramUsedMb != null ? (vramUsedMb / memoryMb) * 100 : null,
      temperature: num(reading?.temperature_c),
      power: num(reading?.power_w),
    });
  }
  return out;
}

/** "8 GB" from 8192 MB. */
export function gbOf(mb: number | null | undefined): number | null {
  return mb ? Math.round(mb / 1024) : null;
}
