# Replay Radar Assets

Assets vendored from [boltgolt/boltobserv](https://github.com/boltgolt/boltobserv)
(GPL-3 — see boltobserv's LICENSE).

## What's here

- `metadata.json` — per-map calibration `{ resolution, offset, splits?, zRange? }`
  matching boltobserv's `src/maps/<map>/meta.json5` shape.
- `<map_name>.png` — 1024×1024 overhead radar image.
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
