import { buildVisionGrid } from "./visionCast";
import type { VisionBounds } from "./visionCast";

/** Bakes the map's collision hull into vision's voxel grid, off the main thread. */
self.addEventListener(
  "message",
  (event: MessageEvent<{ tri: Float32Array; bounds: VisionBounds | null }>) => {
    const grid = buildVisionGrid(event.data.tri, event.data.bounds);
    self.postMessage(grid, { transfer: [grid.bits.buffer] });
  },
);
