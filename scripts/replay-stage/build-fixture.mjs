#!/usr/bin/env node
// Turns a real demo into a playback blob the harness can load, the same blob
// the api serves (`buildPlaybackBlob` in api/src/demos/demo-metadata.service.ts).
//
//   node scripts/replay-stage/build-fixture.mjs --name inferno \
//     --dem ../demo-parser/test.dem --parser ../demo-parser
//   node scripts/replay-stage/build-fixture.mjs --name inferno --parsed parsed.json
//
// `--parser` is a built demo-parser binary or a checkout to `go run` (nothing in
// it is modified). `--parsed` skips the parser and reads its JSON output. The
// blob lands in node_modules/.cache/replay-stage-fixtures/<name>.json, which
// shot.mjs serves at /fixtures/<name>.json.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const outDir = path.join(webRoot, "node_modules/.cache/replay-stage-fixtures");

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i += 2) opt[args[i].replace(/^--/, "")] = args[i + 1];
if (!opt.name || !(opt.parsed || (opt.dem && opt.parser))) {
  console.error("usage: build-fixture.mjs --name <name> (--parsed <json> | --dem <file> --parser <binary|checkout>)");
  process.exit(1);
}

function parse() {
  if (opt.parsed) return JSON.parse(readFileSync(opt.parsed, "utf8"));
  const parser = path.resolve(opt.parser);
  const isDir = statSync(parser).isDirectory();
  const run = spawnSync(isDir ? "go" : parser, isDir ? ["run", "./cmd/server", "parse"] : ["parse"], {
    cwd: isDir ? parser : undefined,
    input: readFileSync(opt.dem),
    maxBuffer: 1 << 30,
  });
  process.stderr.write(run.stderr);
  if (run.status !== 0) throw new Error(`parser exited ${run.status}`);
  return JSON.parse(run.stdout.toString("utf8"));
}

// Mirrors buildPlaybackBlob field for field (blob v11: damage weapon, hitgroup
// and armor, CS2's own smoke voxels, per-victim flashes).
function buildPlaybackBlob(matchMapId, parsed) {
  const positions = (parsed.positions ?? []).map((p) => ({
    round: p.round ?? 0,
    tick: p.tick,
    attacker_steam_id: p.attacker ?? null,
    attacker_team: p.team ?? null,
    alive: p.alive ?? false,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw ?? null,
    pitch: p.pitch ?? null,
    health: p.health ?? null,
    armor: p.armor ?? null,
    helmet: p.helmet ?? false,
    has_bomb: p.has_bomb ?? false,
    has_defuser: p.has_defuser ?? false,
    active_weapon: p.active_weapon ?? null,
    ducked: p.ducked ?? false,
  }));

  const shots_fired = (parsed.shots_fired ?? []).map((s) => ({
    round: s.round ?? 0,
    tick: s.tick,
    attacker_steam_id: s.attacker ?? null,
    attacker_team: s.attacker_team ?? null,
    with: s.weapon ?? null,
    yaw: s.yaw ?? null,
    pitch: s.pitch ?? null,
    eye_x: s.eye_x ?? null,
    eye_y: s.eye_y ?? null,
    eye_z: s.eye_z ?? null,
    result: s.result ?? null,
    impact_x: s.impact_x ?? null,
    impact_y: s.impact_y ?? null,
    impact_z: s.impact_z ?? null,
    miss_x: s.miss_x ?? null,
    miss_y: s.miss_y ?? null,
    miss_z: s.miss_z ?? null,
  }));

  const mapGrenade = (g, phase) => {
    const isThrow = phase === "thrown";
    return {
      round: g.round ?? 0,
      tick: g.tick,
      grenade_id: g.gid ?? null,
      thrower_steam_id: g.thrower ?? null,
      thrower_team: g.thrower_team ?? null,
      type: g.type,
      phase,
      x: (isThrow ? g.ox : g.x) ?? 0,
      y: (isThrow ? g.oy : g.y) ?? 0,
      z: (isThrow ? g.oz : g.z) ?? 0,
    };
  };
  const grenade_throws = [
    ...(parsed.grenade_throws ?? []).map((g) => mapGrenade(g, "thrown")),
    ...(parsed.grenade_detonations ?? []).map((g) => mapGrenade(g, "detonated")),
  ];

  const damages = (parsed.damages ?? []).map((d) => ({
    round: d.round ?? 0,
    time: String(d.tick),
    attacker_steam_id: d.attacker ?? null,
    attacked_steam_id: d.victim ?? null,
    weapon: d.weapon ?? null,
    hitgroup: d.hitgroup ?? 0,
    damage: d.damage,
    damage_armor: d.damage_armor ?? 0,
    health: d.health ?? null,
  }));

  const round_inventory = (parsed.round_inventory ?? []).map((r) => ({
    round: r.round ?? 0,
    steam_id: r.attacker ?? null,
    team: r.team ?? null,
    flash: r.flash ?? 0,
    smoke: r.smoke ?? 0,
    he: r.he ?? 0,
    molotov: r.molotov ?? 0,
    decoy: r.decoy ?? 0,
    primary: r.primary ?? null,
    secondary: r.secondary ?? null,
    armor: r.armor ?? 0,
    helmet: r.helmet ?? false,
    kit: r.kit ?? false,
  }));

  const flashes = (parsed.flashes ?? []).map((f) => ({
    round: f.round ?? 0,
    tick: f.tick,
    attacker_steam_id: f.attacker ?? null,
    attacked_steam_id: f.victim ?? null,
    duration: f.duration ?? 0,
    team_flash: f.team_flash ?? false,
  }));

  return {
    schema_version: 11,
    parser_schema_version: parsed.schema_version ?? null,
    match_map_id: matchMapId,
    tick_rate: parsed.tick_rate,
    total_ticks: parsed.total_ticks,
    map_name: parsed.map_name ?? null,
    round_ticks: parsed.round_ticks ?? [],
    players: parsed.players ?? [],
    kills: parsed.kills ?? [],
    bombs: parsed.bombs ?? [],
    kit_drops: parsed.kit_drops ?? [],
    positions,
    shots_fired,
    grenade_throws,
    grenade_trajectories: parsed.grenade_trajectories ?? [],
    smoke_volumes: parsed.smoke_volumes ?? [],
    smoke_voxels: parsed.smoke_voxels ?? [],
    infernos: parsed.infernos ?? [],
    flashes,
    damages,
    round_inventory,
  };
}

const blob = buildPlaybackBlob(`fixture-${opt.name}`, parse());
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${opt.name}.json`);
writeFileSync(file, JSON.stringify(blob));
const counts = ["positions", "shots_fired", "damages", "kills", "grenade_throws", "smoke_volumes", "smoke_voxels", "infernos", "flashes"]
  .map((k) => `${k}=${blob[k].length}`)
  .join(" ");
console.log(`${file}  map=${blob.map_name} rounds=${blob.round_ticks.length} ${counts}`);
