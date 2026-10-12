// A hand-made `baked_bomb_damage.vdata` as Source2Viewer-CLI decompiles one:
// KV3 text with the three blobs ValveResourceFormat's BombDamage reads
// (bombsites: 7 f32 per site; positions: 3 i16 per point; damage_values:
// u16 phase, u8 yaw, u8 pitch per (site, point), site-major).

export type FixtureSite = { min: number[]; max: number[]; power: number };

export type FixtureDamage = {
  version?: number;
  type?: string;
  sites: FixtureSite[];
  /** xyz per point. */
  positions: number[][];
  /** One array per site, a phase per point. */
  phases: number[][];
  yaw?: number;
  pitch?: number;
};

const byte = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");

/** A blob the way KV3TextSerializer writes it: inline up to 32 bytes, else 32 a line. */
function blob(bytes: Uint8Array, indent: string) {
  if (bytes.length <= 32) {
    return `#[ ${[...bytes].map(byte).join(" ")} ]`;
  }
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 32) {
    lines.push(`${indent}\t${[...bytes.subarray(i, i + 32)].map(byte).join(" ")}`);
  }
  return `\n${indent}#[\n${lines.join("\n")}\n${indent}]`;
}

export function bombDamageKv3({
  version = 2,
  type = "CS2_BOMB_DAMAGE_DATA",
  sites,
  positions,
  phases,
  yaw = 64,
  pitch = 0,
}: FixtureDamage) {
  const bombsites = new Float32Array(sites.flatMap((s) => [...s.min, ...s.max, s.power]));
  const points = new Int16Array(positions.flat());
  // Sized by the phases given, so a test can hand over too few.
  const values = new Uint8Array(phases.length * positions.length * 4);
  phases.forEach((perPoint, s) =>
    perPoint.forEach((phase, p) => {
      const o = (s * positions.length + p) * 4;
      values[o] = phase & 0xff;
      values[o + 1] = phase >> 8;
      values[o + 2] = yaw;
      values[o + 3] = pitch;
    }),
  );
  const bytes = (array: ArrayBufferView) =>
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  return [
    "<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} " +
      "format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->",
    "{",
    `\tgeneric_data_type = "${type}"`,
    "\theader = ",
    "\t{",
    `\t\tversion = ${version}`,
    "\t}",
    "\tdata = ",
    "\t{",
    `\t\tbombsites = ${blob(bytes(bombsites), "\t\t")}`,
    `\t\tpositions = ${blob(bytes(points), "\t\t")}`,
    `\t\tdamage_values = ${blob(values, "\t\t")}`,
    "\t}",
    "}",
    "",
  ].join("\n");
}
