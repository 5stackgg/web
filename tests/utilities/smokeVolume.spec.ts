// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SMOKE_UPSAMPLE,
  decodeSmokeVolume,
  smokeFootprint,
  traceContour,
  upsampleFootprint,
  type SmokeVolume,
} from "~/utils/smokeVolume";

// A 4x4x4 grid of 32-unit cells whose middle 2x2 columns are fully dense.
function cloud(overrides: Partial<SmokeVolume> = {}): SmokeVolume {
  const [dx, dy, dz] = [4, 4, 4];
  const bytes = new Uint8Array((dx * dy * dz) / 2);
  for (let k = 0; k < dz; k++) {
    for (let j = 1; j <= 2; j++) {
      for (let i = 1; i <= 2; i++) {
        const n = (k * dy + j) * dx + i;
        bytes[n >> 1] |= n & 1 ? 0xf0 : 0x0f;
      }
    }
  }
  return {
    start_tick: 0,
    ox: 100,
    oy: 200,
    oz: 0,
    vs: 32,
    dx,
    dy,
    dz,
    den: Buffer.from(bytes).toString("base64"),
    ...overrides,
  };
}

describe("decodeSmokeVolume", () => {
  it("reads each cell's density, and nothing outside the grid", () => {
    const decoded = decodeSmokeVolume(cloud())!;

    expect(decoded.at(1, 1, 0)).toBe(1);
    expect(decoded.at(2, 2, 3)).toBe(1);
    expect(decoded.at(0, 0, 0)).toBe(0);
    expect(decoded.at(4, 1, 0)).toBe(0);
    expect(decoded.at(-1, 1, 0)).toBe(0);
  });

  it("gives up on a cloud with no field, or one too small to have a shape", () => {
    expect(decodeSmokeVolume(cloud({ den: undefined }))).toBeNull();
    expect(decodeSmokeVolume(cloud({ dz: 2 }))).toBeNull();
    expect(decodeSmokeVolume(cloud({ den: "AA==" }))).toBeNull();
  });
});

describe("a smoke's footprint", () => {
  it("is opaque over the dense columns and clear around them", () => {
    const mask = smokeFootprint(decodeSmokeVolume(cloud())!);

    expect(mask[1 * 4 + 1]).toBe(1);
    expect(mask[2 * 4 + 2]).toBe(1);
    expect(mask[0]).toBe(0);
    expect(mask[3 * 4 + 3]).toBe(0);
  });

  it("traces one outline around the dense columns, in world units", () => {
    const decoded = decodeSmokeVolume(cloud())!;
    const up = upsampleFootprint(
      decoded,
      smokeFootprint(decoded),
      SMOKE_UPSAMPLE,
    );
    const loops = traceContour(up.view, up.mask, 0.4);

    expect(loops).toHaveLength(1);
    const xs = loops[0].map((p) => p.x);
    const ys = loops[0].map((p) => p.y);
    // The dense block spans x 132..196 and y 232..296; smoothing softens the
    // edge by under a cell either way.
    expect(Math.min(...xs)).toBeGreaterThan(100);
    expect(Math.max(...xs)).toBeLessThan(228);
    expect(Math.min(...ys)).toBeGreaterThan(200);
    expect(Math.max(...ys)).toBeLessThan(328);
    expect(Math.min(...xs)).toBeLessThan(164);
    expect(Math.max(...xs)).toBeGreaterThan(164);
  });
});
