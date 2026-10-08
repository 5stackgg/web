import type {
  UtilityLineup,
  UtilitySide,
  UtilityTechnique,
  UtilityThrowStrength,
  UtilityType,
} from "~/types/utility";
import cleanMapName from "~/utilities/cleanMapName";
import { normalizeMapName } from "~/utilities/mapAssets";
import { utilityThrowButtonsKey } from "~/utilities/utilityDisplay";
import {
  utilityRunUp,
  utilityRunUpCaps,
  utilityRunUpSeconds,
} from "~/utilities/utilityThrowGuide";
import { truncate, type UnfurlOptions } from "./unfurl";

// A crawler has no locale, so these are fixed English, worded as the in-app
// labels are (pages.utility.* in en.json) but as something to do rather than
// a name for it.

const TYPE_NAMES: Record<UtilityType, string> = {
  Smoke: "Smoke",
  Flash: "Flash",
  Molotov: "Molotov",
  HighExplosive: "HE grenade",
  Decoy: "Decoy",
};

const SIDE_NAMES: Record<UtilitySide, string> = {
  CT: "CT side",
  TERRORIST: "T side",
};

const TECHNIQUE_MOVES: Record<UtilityTechnique, string> = {
  Stationary: "Stand still and throw",
  Walking: "Walk and throw",
  Running: "Run and throw",
  Crouch: "Crouch and throw",
  Jump: "Jump throw",
  RunJump: "Run, then jump throw",
  WalkJump: "Walk, then jump throw",
  CrouchJump: "Crouch jump and throw",
};

const THROW_BUTTONS: Record<
  ReturnType<typeof utilityThrowButtonsKey>,
  string
> = {
  left: "left click",
  both: "left + right click",
  right: "right click",
};

const THROW_STRENGTHS: Record<UtilityThrowStrength, string> = {
  Full: "full throw",
  Half: "half throw",
  Drop: "drop",
};

// api utility-renders.service films every preview at 1080p, and the thumbnail
// and stills are frames of it.
const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;

const STILL_FALLBACKS = ["aim", "stance_eyes", "stance", "landing"];

export type UtilityLineupUnfurlRow = Pick<
  UtilityLineup,
  | "id"
  | "name"
  | "map_name"
  | "utility_type"
  | "side"
  | "technique"
  | "throw_strength"
  | "visibility"
  | "description"
  | "preview_url"
  | "preview_thumbnail_url"
  | "preview_stills_url"
  | "preview_duration_ms"
> & {
  archived_at?: string | null;
  approach?: unknown;
};

export type UtilityLineupUnfurlMap = {
  label?: string | null;
  poster?: string | null;
};

/**
 * What to do with it, in one line: "Smoke · T side — Walk, then jump throw
 * (left click, full throw)". A recorded run-up says it with the keys instead
 * of the technique's name. No jump-throw bind, even when jump_throw_bind is
 * set: CS2 dropped the bind (see UTILITY_THROW_BUTTONS) and the app never
 * shows it.
 */
export function utilityLineupThrowInstruction(
  lineup: Pick<
    UtilityLineupUnfurlRow,
    "utility_type" | "side" | "technique" | "throw_strength" | "approach"
  >,
): string {
  let move = TECHNIQUE_MOVES[lineup.technique] ?? "Throw";
  const runUp = utilityRunUp(lineup.approach);
  if (runUp) {
    const keys = utilityRunUpCaps(runUp).join(" + ");
    const release = runUp.jump ? "jump throw" : "throw";
    move = `Hold ${keys} for ${utilityRunUpSeconds(runUp)}s, then ${release}`;
  }
  const press = [
    THROW_BUTTONS[utilityThrowButtonsKey(lineup.throw_strength)],
    THROW_STRENGTHS[lineup.throw_strength],
  ]
    .filter(Boolean)
    .join(", ");
  const what = [TYPE_NAMES[lineup.utility_type], SIDE_NAMES[lineup.side]]
    .filter(Boolean)
    .join(" · ");

  return [what, `${move} (${press})`].filter(Boolean).join(" — ");
}

function utilityLineupRenderImage(
  lineup: Pick<
    UtilityLineupUnfurlRow,
    "preview_thumbnail_url" | "preview_stills_url"
  >,
): string | null {
  const thumbnail = (lineup.preview_thumbnail_url ?? "").trim();
  if (thumbnail) {
    return thumbnail;
  }
  const stills = lineup.preview_stills_url ?? {};
  for (const kind of STILL_FALLBACKS) {
    const still = (stills[kind] ?? "").trim();
    if (still) {
      return still;
    }
  }
  return null;
}

/**
 * The link card for `/utility/<map>?lineup=<id>`. Null for anything a
 * signed-out visitor could not open -- not Public, or archived -- so the
 * crawler gets the app's generic card instead of the lineup's details.
 */
export function utilityLineupUnfurlOptions(
  lineup: UtilityLineupUnfurlRow,
  origin: string,
  map: UtilityLineupUnfurlMap | null = null,
): UnfurlOptions | null {
  if (lineup.visibility !== "Public" || lineup.archived_at) {
    return null;
  }

  const mapName = normalizeMapName(lineup.map_name);
  const mapLabel = (map?.label ?? "").trim() || cleanMapName(mapName);
  const name =
    (lineup.name ?? "").trim() ||
    `${TYPE_NAMES[lineup.utility_type] ?? "Utility"} lineup`;
  const title = mapLabel ? `${name} · ${mapLabel}` : name;

  const instruction = utilityLineupThrowInstruction(lineup);
  const note = (lineup.description ?? "").trim();
  const description = truncate(note ? `${instruction}. ${note}` : instruction);

  const pageUrl = `${origin}/utility/${encodeURIComponent(mapName)}?lineup=${encodeURIComponent(lineup.id)}`;

  const renderImage = utilityLineupRenderImage(lineup);
  let image = renderImage;
  if (!image) {
    const poster = map?.poster ?? "";
    image = /^https?:\/\//.test(poster)
      ? poster
      : `${origin}/img/maps/screenshots/${mapName}.webp`;
  }

  const videoUrl = (lineup.preview_url ?? "").trim();
  const durationMs = Number(lineup.preview_duration_ms ?? 0);
  const durationSec =
    durationMs > 0 ? Math.round(durationMs / 1000) : undefined;

  return {
    title,
    description,
    pageUrl,
    humanUrl: `${pageUrl}&ufl=1`,
    image,
    imageAlt: title,
    imageWidth: renderImage ? RENDER_WIDTH : undefined,
    imageHeight: renderImage ? RENDER_HEIGHT : undefined,
    video: videoUrl
      ? {
          url: videoUrl,
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          durationSec,
        }
      : null,
  };
}
