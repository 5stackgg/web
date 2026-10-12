import {
  computeBlastField,
  indexTris,
  type BlastField,
  type TriIndex,
} from "./blastField";
import type { Vec3 } from "./types";

/**
 * Measures C4 blast fields off the main thread: one hull per map, then a
 * field per plant spot (blastField.ts).
 */
export type BlastWorkerIn =
  | { kind: "map"; tri: Float32Array | null }
  | { kind: "field"; id: number; at: Vec3 };

export type BlastWorkerOut =
  | { kind: "field"; id: number; field: BlastField; ms: number }
  | { kind: "error"; id: number; message: string };

let index: TriIndex | null = null;

export function handleBlastMessage(msg: BlastWorkerIn): BlastWorkerOut | null {
  if (msg.kind === "map") {
    index = msg.tri && msg.tri.length >= 9 ? indexTris(msg.tri) : null;
    return null;
  }
  if (!index) {
    return { kind: "error", id: msg.id, message: "no hull" };
  }
  try {
    const started = performance.now();
    const { field } = computeBlastField(index, msg.at);
    return {
      kind: "field",
      id: msg.id,
      field,
      ms: performance.now() - started,
    };
  } catch (error) {
    return { kind: "error", id: msg.id, message: String(error) };
  }
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BlastWorkerIn>) => void) | null;
  postMessage(message: BlastWorkerOut, transfer: Transferable[]): void;
};

if (typeof window === "undefined") {
  scope.onmessage = (event) => {
    const out = handleBlastMessage(event.data);
    if (out) {
      scope.postMessage(
        out,
        out.kind === "field" ? [out.field.dist.buffer] : [],
      );
    }
  };
}
