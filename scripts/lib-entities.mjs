// Reading a decompiled entity lump (`maps/<map>/entities/default_ents.vents`),
// shared by the radar and mesh extractors.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDmx } from "./lib-dmx.mjs";

function round(v, places = 2) {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

/**
 * `cs_minimap_volume` boxes by minimap name, in world units. A brush volume
 * states no mins/maxs of its own: the hull comes out of the model's companion
 * DMX -- named inside the ModelDoc, not guessable -- translated by the entity's
 * origin. `out` is the directory the entities folder was decompiled into.
 */
export function minimapVolumes(out, map) {
  const lump = join(out, "maps", map, "entities", "default_ents.vents");
  const boxes = new Map();
  if (!existsSync(lump)) {
    return boxes;
  }

  const blocks = readFileSync(lump, "utf8")
    .split(/====\d+====/)
    .filter((b) => /^\s*classname\s+"cs_minimap_volume"\s*$/m.test(b));

  for (const block of blocks) {
    const name = /^\s*minimap_name\s+"([^"]*)"/m.exec(block)?.[1];
    const model = /^\s*model\s+(?:resource_name:)?"([^"]+)"/m.exec(block)?.[1];
    const origin = (/^\s*origin\s+\[([^\]]+)\]/m.exec(block)?.[1] ?? "0,0,0")
      .split(",")
      .map(Number);
    if (!name || !model) {
      continue;
    }

    const vmdl = join(out, model.replace(/\\+/g, "/"));
    if (!existsSync(vmdl)) {
      continue;
    }

    const min = [Infinity, Infinity];
    const max = [-Infinity, -Infinity];
    for (const match of readFileSync(vmdl, "utf8").matchAll(
      /filename\s*=\s*"([^"]+\.dmx)"/g,
    )) {
      const geometry = join(out, match[1].replace(/\\+/g, "/"));
      if (!existsSync(geometry)) {
        continue;
      }
      for (const element of parseDmx(readFileSync(geometry)).elements) {
        const positions = element?.attrs?.["position$0"];
        if (!Array.isArray(positions)) {
          continue;
        }
        for (const point of positions) {
          const x = Array.isArray(point) ? point[0] : point?.x;
          const y = Array.isArray(point) ? point[1] : point?.y;
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
          }
          min[0] = Math.min(min[0], x);
          min[1] = Math.min(min[1], y);
          max[0] = Math.max(max[0], x);
          max[1] = Math.max(max[1], y);
        }
      }
    }
    if (!Number.isFinite(min[0])) {
      continue;
    }

    boxes.set(name.toLowerCase(), {
      minX: round(min[0] + origin[0]),
      maxX: round(max[0] + origin[0]),
      minY: round(min[1] + origin[1]),
      maxY: round(max[1] + origin[1]),
    });
  }
  return boxes;
}
