import { BADGE } from "./playersBadges";
import {
  badgeZoom,
  nameShown,
  overlayScale,
  puckAnchor,
} from "./playersShared";
import type { ScreenAnchor } from "./playersShared";
import type { StageContext, StagePlayer } from "./types";

/** Seconds a dead player stays pickable, and how long their portrait lasts. */
const DEAD_PICKABLE = 0.6;
const DEAD_PORTRAIT = 0.35;
/** Half a typical name plate, CSS px at badge scale 1. */
const PLATE_HALF_W = 44;

export type PlayerPick = {
  id: string | null;
  /** What a hover frame should surround: centre and radius, canvas CSS px. */
  x: number;
  y: number;
  r: number;
};

const anchor: ScreenAnchor = {
  x: 0,
  y: 0,
  cx: 0,
  cy: 0,
  radius: 0,
  depth: 0,
  grow: 1,
};

/**
 * The player under canvas point (x, y), CSS px, laid out as players.ts draws
 * them: portraits (with their pointer and name plate) sit over everything,
 * the selected one on top and otherwise the lowest on screen; pucks come
 * after. `slop` widens every target, for fingers. With a storey in view
 * (`band`, source z), anyone on it wins over anyone off it. Writes into
 * `out`; false when nobody is there.
 */
export function pickPlayer(
  ctx: StageContext,
  players: StagePlayer[],
  x: number,
  y: number,
  slop: number,
  out: PlayerPick,
  band: { min: number; max: number } | null = null,
) {
  const scale = overlayScale(ctx);
  let best = -Infinity;
  out.id = null;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const deadFor = player.alive ? -1 : (player.diedAge ?? Infinity);
    if (deadFor > DEAD_PICKABLE || !puckAnchor(ctx, player, anchor)) {
      continue;
    }
    const puckR = Math.max(anchor.radius * anchor.grow, 10);
    const zoom = badgeZoom(ctx, anchor.radius);
    const named = nameShown(zoom, player.selected);
    const s = scale * zoom * (player.selected ? 1.06 : 1);
    const pr = BADGE.portraitRadius * s;
    const py =
      anchor.y - (BADGE.portraitY - BADGE.namelessDrop * (1 - named)) * s;
    let score = -Infinity;
    if (deadFor < DEAD_PORTRAIT) {
      const dx = Math.abs(x - anchor.x);
      const onPortrait = Math.hypot(x - anchor.x, y - py) <= pr + slop;
      const onPointer = dx <= 8 * s + slop && y >= py && y <= anchor.y + slop;
      // The plate's width (name and weapon) is the atlas's; this covers most.
      const onPlate =
        named > 0.5 &&
        dx <= PLATE_HALF_W * s + slop &&
        Math.abs(y - (anchor.y - BADGE.plateY * s)) <= BADGE.plateHalfH * s;
      if (onPortrait || onPointer || onPlate) {
        score = (player.selected ? 2e6 : 1e6) + anchor.y;
      }
    }
    if (score === -Infinity) {
      const d = Math.hypot(x - anchor.cx, y - anchor.cy);
      if (d <= puckR + slop) {
        score = -d;
      }
    }
    if (band && (player.z < band.min || player.z > band.max)) {
      score -= 1e7;
    }
    if (score <= best) {
      continue;
    }
    best = score;
    out.id = player.id;
    if (deadFor < DEAD_PORTRAIT) {
      out.x = anchor.x;
      out.y = py;
      out.r = pr;
    } else {
      out.x = anchor.cx;
      out.y = anchor.cy;
      out.r = puckR;
    }
  }
  return out.id !== null;
}
