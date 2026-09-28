// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { distanceField, FloorIndex } from "~/scripts/lib-nav.mjs";
import {
  buildViewMesh,
  chunkLabel,
  classifyNode,
  FLAG_OUTSIDE,
  readViewBin,
  SURFACE_FOLIAGE,
  SURFACE_SEE_THROUGH,
  SURFACE_SOLID,
  writeViewBin,
} from "~/scripts/lib-view-mesh.mjs";
import { buildGlb, glbToGltf, quad, type Vec3 } from "../helpers/mapFixtures";

describe("view.bin", () => {
  it("round-trips chunks with aligned sections", () => {
    const chunks = [
      {
        name: "room101",
        positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 5, -3, 4, 900]),
        floorZ: new Float32Array([0, 0, NaN, -8]),
        flags: new Uint8Array([
          SURFACE_SOLID,
          SURFACE_FOLIAGE,
          SURFACE_SEE_THROUGH | FLAG_OUTSIDE,
          0,
        ]),
        indices: new Uint32Array([0, 1, 2, 1, 2, 3]),
      },
      {
        name: "world",
        positions: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, -9]),
        floorZ: new Float32Array([1, 2, 3]),
        flags: new Uint8Array([0, 0, 1]),
        indices: new Uint32Array([2, 1, 0]),
      },
    ];
    const buf = writeViewBin(chunks);
    expect(buf.toString("latin1", 0, 4)).toBe("5SVM");

    const parsed = readViewBin(buf);
    expect(parsed.version).toBe(1);
    expect(parsed.bboxMin).toEqual([-3, 0, -9]);
    expect(parsed.bboxMax).toEqual([10, 10, 900]);
    expect(parsed.chunks.map((c: { name: string }) => c.name)).toEqual(["room101", "world"]);
    parsed.chunks.forEach((chunk: any, i: number) => {
      expect(chunk.dataOffset % 4).toBe(0);
      expect(Array.from(chunk.positions)).toEqual(Array.from(chunks[i].positions));
      expect(Array.from(chunk.floorZ)).toEqual(Array.from(chunks[i].floorZ));
      expect(Array.from(chunk.flags)).toEqual(Array.from(chunks[i].flags));
      expect(Array.from(chunk.indices)).toEqual(Array.from(chunks[i].indices));
    });
  });

  it("rejects indices past the vertices", () => {
    const bad = writeViewBin([
      {
        name: "world",
        positions: new Float32Array(9),
        floorZ: new Float32Array(3),
        flags: new Uint8Array(3),
        indices: new Uint32Array([0, 1, 7]),
      },
    ]);
    expect(() => readViewBin(bad)).toThrow(/past 3 vertices/);
  });

  it("shortens a chunk name over 16 bytes instead of failing", () => {
    const chunk = {
      name: "a_very_long_room_name",
      positions: new Float32Array(9),
      floorZ: new Float32Array(3),
      flags: new Uint8Array(3),
      indices: new Uint32Array([0, 1, 2]),
    };
    const parsed = readViewBin(writeViewBin([chunk]));
    expect(parsed.chunks[0].name).toBe(chunkLabel("a_very_long_room_name"));
  });
});

describe("chunkLabel", () => {
  it("leaves names that fit alone", () => {
    expect(chunkLabel("world")).toBe("world");
    expect(chunkLabel("roomparty")).toBe("roomparty");
    expect(chunkLabel("exactly16bytes__")).toBe("exactly16bytes__");
  });

  it("keeps 11 bytes, a tilde and four hex digits of the name's hash", () => {
    const label = chunkLabel("a_very_long_room_name");
    expect(label).toMatch(/^a_very_long~[0-9a-f]{4}$/);
    expect(Buffer.byteLength(label)).toBe(16);
    expect(chunkLabel("a_very_long_room_name")).toBe(label);
    expect(chunkLabel("a_very_long_room_name_2")).not.toBe(label);
  });

  it("never splits a multi-byte character", () => {
    const label = chunkLabel("ééééééééé");
    expect(label.startsWith("ééééé~")).toBe(true);
    expect(Buffer.byteLength(label)).toBeLessThanOrEqual(16);
  });
});

describe("classifyNode", () => {
  it.each([
    ["n0_lr0_agg_merge_woodfloor005a_0", SURFACE_SOLID],
    ["unnamed_2_60417_3260.hammer_mesh_0", SURFACE_SOLID],
    ["n0_lr0_agg_merge_dust_arch_small_0", SURFACE_SOLID],
    ["n0_lr0_agg_prop_urban_palm_trunkdust_animated_0", SURFACE_SOLID],
    ["n0_lr0_agg_merge_hr_grass_dirt_blend_001_0", SURFACE_SOLID],
    ["n0_lr0_agg_merge_furnitureinteriorcabinetswood_0", SURFACE_SOLID],
    ["n0_lr0_agg_merge_urban_trees_branches03_0", SURFACE_FOLIAGE],
    ["n0_lr0_agg_merge_rusted_fence_a_0", SURFACE_SEE_THROUGH],
    ["n0_lr0_c0_s_cb_b_nomerge3_4carz1024_glass.meshset_0", SURFACE_SEE_THROUGH],
    ["n0_lr0_c0_s_cb_bl_mesh_blocklight0_shadow.meshset_0", null],
    ["retake_bsite_2_60417_4668.hammer_mesh_0", null],
    ["n0_lr0_c0_s_mesh_overlay0.meshset_0", null],
    ["n0_lr0_c0_s_cb_nomerge4_dust_002.meshset_0", null],
    ["n0_lr0_c0_s_nomerge4_steam_001_additive.meshset_0", null],
    ["n0_lr0_agg_prop_nuke_skybox_powerline_color_0", null],
    ["brush_blocker_2_61863.hammer_mesh_0", null],
  ])("%s -> %s", (name, surface) => {
    expect(classifyNode(name)).toBe(surface);
  });
});

describe("buildViewMesh", () => {
  const dir = mkdtempSync(join(tmpdir(), "view-mesh-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("keeps drawn geometry, drops light blockers, and floors every vertex", async () => {
    const glb = join(dir, "world.glb");
    writeFileSync(
      glb,
      buildGlb([
        {
          name: "n0_lr0_agg_merge_concrete_floor_0",
          triangles: quad([0, 0, 0], [512, 0, 0], [512, 512, 0], [0, 512, 0]),
        },
        {
          name: "n0_lr0_agg_merge_concrete_wall_0",
          triangles: quad([0, 0, 0], [512, 0, 0], [512, 0, 300], [0, 0, 300]),
        },
        {
          name: "n0_lr0_agg_prop_tree_branch_0",
          triangles: [
            [
              [300, 300, 100],
              [340, 300, 100],
              [300, 340, 140],
            ],
          ],
        },
        {
          name: "n0_lr0_c0_s_cb_bl_mesh_blocklight0_shadow.meshset_0",
          triangles: quad([0, 0, -900], [512, 0, -900], [512, 512, -900], [0, 512, -900]),
        },
      ]),
    );
    const walkable: Vec3[][] = [
      [
        [0, 0, 0],
        [512, 0, 0],
        [512, 512, 0],
        [0, 512, 0],
      ],
    ];

    const { buf, stats } = await buildViewMesh(glb, {
      floors: new FloorIndex(walkable),
      playable: distanceField(walkable),
      volumes: [{ name: "room1", minX: 0, maxX: 256, minY: 0, maxY: 600 }],
    });
    const view = readViewBin(buf);

    expect(stats.dropped).toEqual({ "s_cb_bl_mesh_blocklight#_shadow.meshset_#": 2 });
    expect(view.chunks.map((c: { name: string }) => c.name)).toEqual(["room1", "world"]);
    expect(view.bboxMin.map(Math.round)).toEqual([0, 0, 0]);
    expect(view.bboxMax.map(Math.round)).toEqual([512, 512, 300]);

    let foliage = 0;
    for (const chunk of view.chunks) {
      for (let v = 0; v < chunk.vertexCount; v++) {
        expect(chunk.floorZ[v]).toBe(0);
        expect(chunk.flags[v] & FLAG_OUTSIDE).toBe(0);
        if ((chunk.flags[v] & 3) === SURFACE_FOLIAGE) {
          foliage += 1;
        }
      }
      for (let t = 0; t < chunk.indexCount; t += 3) {
        for (let k = 0; k < 3; k++) {
          const a = chunk.indices[t + k] * 3;
          const b = chunk.indices[t + ((k + 1) % 3)] * 3;
          const length = Math.hypot(
            chunk.positions[a] - chunk.positions[b],
            chunk.positions[a + 1] - chunk.positions[b + 1],
            chunk.positions[a + 2] - chunk.positions[b + 2],
          );
          expect(length).toBeLessThanOrEqual(256.01);
        }
      }
    }
    expect(foliage).toBe(3);
  });

  it("builds the same mesh from a .gltf with its buffers in separate files", async () => {
    const model = buildGlb([
      {
        name: "n0_lr0_agg_merge_concrete_floor_0",
        triangles: quad([0, 0, 0], [512, 0, 0], [512, 512, 0], [0, 512, 0]),
      },
      {
        name: "n0_lr0_agg_merge_concrete_wall_0",
        triangles: quad([0, 0, 0], [512, 0, 0], [512, 0, 300], [0, 0, 300]),
      },
    ]);
    const glb = join(dir, "same.glb");
    writeFileSync(glb, model);
    const split = glbToGltf(model, "same");
    const gltf = join(dir, "same.gltf");
    writeFileSync(gltf, split.gltf);
    for (const [file, body] of Object.entries(split.files)) {
      writeFileSync(join(dir, file), body);
    }
    expect(Object.keys(split.files)).toHaveLength(4);

    const walkable: Vec3[][] = [
      [
        [0, 0, 0],
        [512, 0, 0],
        [512, 512, 0],
        [0, 512, 0],
      ],
    ];
    const build = (path: string) =>
      buildViewMesh(path, {
        floors: new FloorIndex(walkable),
        playable: distanceField(walkable),
        volumes: [],
      });
    const fromGlb = await build(glb);
    const fromGltf = await build(gltf);
    expect(fromGltf.stats.trianglesIn).toBe(4);
    expect(Buffer.compare(fromGltf.buf, fromGlb.buf)).toBe(0);
  });
});
