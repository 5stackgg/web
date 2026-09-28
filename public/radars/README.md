# Replay Radar Assets

Assets vendored from [boltgolt/boltobserv](https://github.com/boltgolt/boltobserv)
(GPL-3 — see boltobserv's LICENSE).

## What's here

- `metadata.json` — per-map calibration `{ resolution, offset, splits?, zRange?, volumes? }`
  matching boltobserv's `src/maps/<map>/meta.json5` shape, plus `volumes` for
  maps with a radar per room.
- `<map_name>.png` — 1024×1024 overhead radar image.
- `<map_name>_<volume>.png` — 1024×1024 radar of one room (see *Per-room
  radars*).
- `projectiles/projectile-img-<type>-<team>.webp` — grenade icons used on
  the radar overlay (smoke / firebomb / flashbang / frag).
- `projectiles/bomb-*.webp` — bomb planted / defused / dropped markers.

## Coordinate system

`resolution` = world units per radar pixel. `offset.{x,y}` = world-unit
distance from the radar's bottom-left corner to world origin (0,0). To
project a player at world `(px, py)`:

```
gameX = px + offset.x
gameY = py + offset.y
pixelX = gameX / resolution
pixelYFromBottom = gameY / resolution
```

For SVG (top-left origin) we mirror Y: `pixelYFromTop = 1024 − pixelYFromBottom`.

Multi-level maps (Nuke / Vertigo) get a `splits[]` entry. When a player's
Z falls between `bounds.bottom..bounds.top`, the renderer adds the
`offset` percentages (typically a vertical shift onto the second half of
the radar PNG).

## Per-room radars

A map can split its minimap into rooms. Rush's `rush_001` does: its overview
has 20 `Volumes` (room101–104, room201–212, room301, room401, roomparty,
convoy), each a separate radar image with its own position and scale. The
engine shows one while the player stands inside the `cs_minimap_volume` brush
of the same name.

```json
"rush_001": {
  "resolution": 18.910156,
  "offset": { "x": 11240, "y": 9420 },
  "volumes": [
    {
      "name": "room101",
      "resolution": 1.78125,
      "offset": { "x": -1376, "y": -1696 },
      "bounds": { "minX": 1376, "maxX": 3200, "minY": 1888, "maxY": 3328 }
    }
  ]
}
```

The top-level `resolution`/`offset` is the whole-map radar. Each volume's
`resolution`/`offset` calibrates `<map>_<name>.png` exactly as above, and
`bounds` is the room's world-space XY box. `useRadarProjection` picks the room
most of the given points (the live players, a lineup's throw) stand in, and
`calibration` + `radarSrc` then switch to it. A caller that passes no points
keeps the whole-map radar.

## Extracting a map from the CS2 files

`scripts/extract-map-radars.mjs` builds all of the above straight from the
game, along with the map's poster and icon:

```sh
node scripts/extract-map-radars.mjs rush_001                                   # CS2_DIR / Steam install
node scripts/extract-map-radars.mjs rush_001 --cs2 <cs2 install>
node scripts/extract-map-radars.mjs rush_001 --cs2 <.../game/csgo/pak01_dir.vpk>
node scripts/extract-map-radars.mjs rush_001 --cs2 <dir of loose files>
```

It reads `resource/overviews/<map>.txt` and the overhead radars from
`pak01_dir.vpk`, and the `cs_minimap_volume` brushes from `maps/<map>.vpk`
beside it. It writes:

- `<map>.png` and `<map>_<volume>.png` here;
- the `metadata.json` entry, leaving the other maps alone;
- `public/img/maps/screenshots/<map>.webp` from the 1080p screenshot;
- `public/img/maps/icons/<map>.svg` from `map_icon_<map>.vsvg_c`.

Valve's overview gives the radar's top-left corner and world units per pixel,
so `resolution = scale` and `offset = { x: -pos_x, y: 1024 * scale - pos_y }`.
Without the map VPK a volume's bounds fall back to the square its radar image
covers. On `rush_001` those squares overlap (204/207, 203/210, 212/210) where
the brushes do not.

A loose directory holds each entry at its VPK path: `resource/overviews/…`,
`panorama/images/overheadmaps/…`, `panorama/images/map_icons/…` and
`maps/<map>/entities/…`. That is how the files come off a game-server node,
where `kubectl cp` truncates large files and single entries have to be streamed
out instead. The Source2Viewer CLI comes from `scripts/lib-s2v.mjs`, which
fetches it into `.cache/s2v/` on first use.

## Adding a new map

1. Drop `<map_name>.png` in this folder (1024×1024).
2. Add an entry to `metadata.json` with the four shape fields above.
3. If multi-level, add a `splits[]` entry per level.

## Refreshing from boltobserv

```sh
cd ~/Downloads/boltobserv-master/src
cp maps/*/radar.png    <repo>/web/public/radars/   # rename to <map>.png
cp img/projectile-*.webp <repo>/web/public/radars/projectiles/
cp img/bomb-*.webp     <repo>/web/public/radars/projectiles/
```

The `resolution` + `offset` values come from each `maps/<map>/meta.json5`.
