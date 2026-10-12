import * as THREE from "three";
import { OUTPUT_GLSL, STAGE_FONT, fontReady, writeSrgb } from "./playersShared";
import { weaponBasename } from "~/utilities/weaponIcon";
import { TEAM_STYLE, UTILITY_COLORS } from "./teamColors";
import type { StageTeam } from "./types";

/**
 * Portraits and name plates: one screen-space instanced draw for every
 * player. Rings, plates, pointers and glows are signed distances in the
 * shader (crisp at any pixel ratio); only the photo, the name and the held
 * weapon are pixels, kept in one canvas atlas redrawn when they change.
 */

const ATLAS = 1024;
const AVATAR = 128;
const NAME_W = 256;
const NAME_H = 48;
const NAMES_Y = 512;
const ICONS_Y = 896;
const SLOTS = 32;
/** Weapon cells, 128x64: seven beside the status icons, eight on the last row. */
const WEAPONS = 15;
const WEAPON_W = 128;
const WEAPON_H = 64;
/** Atlas px per CSS px of a weapon icon, and its visual height on the plate. */
const ICON_SCALE = 2;
/** Where an SVG is rasterised large to find its drawn bounds. */
const SCRATCH_W = 512;
const SCRATCH_H = 160;

function lighten(hex: number, k: number) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const up = (c: number) => Math.round(c + (255 - c) * k);
  return (up(r) << 16) | (up(g) << 8) | up(b);
}

/**
 * Equipment icons are white; utility and the bomb keep their colour, lifted
 * toward white so the silhouette reads on the dark plate.
 */
const ICON_TINT: Record<string, number> = {
  smokegrenade: UTILITY_COLORS.smoke[1],
  flashbang: UTILITY_COLORS.flash[1],
  hegrenade: lighten(UTILITY_COLORS.he[0], 0.3),
  molotov: lighten(UTILITY_COLORS.molotov[0], 0.3),
  incgrenade: lighten(UTILITY_COLORS.incendiary[0], 0.3),
  decoy: UTILITY_COLORS.decoy[1],
  c4: lighten(0xff4a3d, 0.2),
};

/** A weapon icon in the atlas; `width` stays 0 until the SVG has drawn. */
export type WeaponCell = {
  key: string;
  x: number;
  y: number;
  /** CSS px at scale 1. */
  width: number;
  height: number;
  tint: number;
  seen: number;
};

/** Layout in CSS pixels at scale 1, y up from the pointer tip. */
export const BADGE = {
  portraitRadius: 27,
  portraitY: 59,
  /** The portrait drops this far onto the pointer once its name is hidden. */
  namelessDrop: 21,
  plateY: 20.5,
  plateHalfH: 11.5,
  pointerH: 8,
  /** Plate weapon icons are this tall, CSS px at scale 1. */
  iconH: 15,
  quadMin: [-150, -4] as const,
  quadMax: [150, 112] as const,
};

const ICON_H = BADGE.iconH;

const NAME_FONT = `800 36px ${STAGE_FONT}`;
const NUMBER_FONT = `800 80px ${STAGE_FONT}`;

type Slot = {
  key: string;
  name: string;
  team: StageTeam;
  url: string | null;
  /** Team slot shown in place of a photo, when there is no URL. */
  number: number | null;
  /** Half the name's width in CSS px at scale 1. */
  width: number;
  seen: number;
  photo: boolean;
};

export type BadgeAtlas = {
  texture: THREE.CanvasTexture;
  /** Slot index for this player, drawing it if needed. */
  slot(
    id: string,
    name: string,
    team: StageTeam,
    url: string | null,
    number: number | null,
    frame: number,
  ): number;
  nameWidth(slot: number): number;
  /** The held weapon's icon, or null while it loads or for none. */
  weapon(name: string | null, frame: number): WeaponCell | null;
  /** The defuse kit's icon, or null while it loads. */
  kitIcon(): WeaponCell | null;
  /** Where the equipment SVGs live, e.g. "/img/equipment/". */
  setIconBase(base: string): void;
  /** Uploads the canvas if anything was drawn since the last call. */
  flush(): void;
  settle(): Promise<void>;
  dispose(): void;
};

function shade(hex: number, k: number) {
  const r = Math.round(Math.min(255, ((hex >> 16) & 255) * k));
  const g = Math.round(Math.min(255, ((hex >> 8) & 255) * k));
  const b = Math.round(Math.min(255, (hex & 255) * k));
  return `rgb(${r},${g},${b})`;
}

function mixWhite(hex: number, k: number) {
  const r = Math.round(((hex >> 16) & 255) * (1 - k) + 255 * k);
  const g = Math.round(((hex >> 8) & 255) * (1 - k) + 255 * k);
  const b = Math.round((hex & 255) * (1 - k) + 255 * k);
  return `rgb(${r},${g},${b})`;
}

function drawIcons(g: CanvasRenderingContext2D) {
  // Eye, for a blinded player: dark on the white disc the shader draws.
  g.save();
  g.translate(32, ICONS_Y + 32);
  g.fillStyle = "#1b2028";
  g.beginPath();
  g.moveTo(-24, 0);
  g.quadraticCurveTo(0, -24, 24, 0);
  g.quadraticCurveTo(0, 24, -24, 0);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(0, 0, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1b2028";
  g.beginPath();
  g.arc(0, 0, 5.5, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Defuse kit: wire cutters, white on the dark disc.
  g.save();
  g.translate(96, ICONS_Y + 32);
  g.rotate(Math.PI / 4);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(-3, -20);
  g.lineTo(3, 4);
  g.moveTo(3, -20);
  g.lineTo(-3, 4);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(-7, 13, 5, 8, 0.25, 0, Math.PI * 2);
  g.moveTo(12, 13);
  g.ellipse(7, 13, 5, 8, -0.25, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

export function createBadgeAtlas(iconBase: string): BadgeAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const g = canvas.getContext("2d")!;
  drawIcons(g);
  const texture = new THREE.CanvasTexture(canvas);
  // Sampled raw: the badge shader composes in sRGB.
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.anisotropy = 1;
  texture.needsUpdate = true;

  const slots: Array<Slot | null> = new Array(SLOTS).fill(null);
  const byKey = new Map<string, number>();
  const photos = new Map<string, HTMLImageElement | "failed">();
  const pending = new Set<Promise<void>>();
  let dirty = true;

  const cells: Array<WeaponCell | null> = new Array(WEAPONS).fill(null);
  const byWeapon = new Map<string, WeaponCell>();
  const basenames = new Map<string, string>();
  let base = iconBase;

  function weaponCell(key: string, frame: number) {
    let index = cells.indexOf(null);
    if (index < 0) {
      for (let i = 0; i < WEAPONS; i++) {
        const cell = cells[i]!;
        if (
          cell.seen < frame &&
          (index < 0 || cell.seen < cells[index]!.seen)
        ) {
          index = i;
        }
      }
      if (index < 0) {
        return null;
      }
      byWeapon.delete(cells[index]!.key);
    }
    const cell: WeaponCell = {
      key,
      x: index < 7 ? (index + 1) * WEAPON_W : (index - 7) * WEAPON_W,
      y: index < 7 ? ICONS_Y : ICONS_Y + WEAPON_H,
      width: 0,
      height: 0,
      tint: ICON_TINT[key] ?? 0xffffff,
      seen: frame,
    };
    cells[index] = cell;
    byWeapon.set(key, cell);
    const img = new Image();
    const done = new Promise<void>((resolve) => {
      img.onload = () => {
        if (byWeapon.get(key) === cell) {
          drawWeapon(cell, img);
        }
        resolve();
      };
      img.onerror = () => resolve();
    });
    pending.add(done);
    done.then(() => pending.delete(done));
    img.src = `${base}${key}.svg`;
    return cell;
  }

  /** The SVG fitted to its cell as a white silhouette; the shader tints it. */
  let scratch: CanvasRenderingContext2D | null = null;

  /**
   * The SVG as a white silhouette fitted to its cell by what it draws, not
   * its viewBox (the equipment SVGs carry a lot of padding): every icon gets
   * the same visual height, a rifle running long, a grenade narrow.
   */
  function drawWeapon(cell: WeaponCell, img: HTMLImageElement) {
    if (!scratch) {
      const canvas = document.createElement("canvas");
      canvas.width = SCRATCH_W;
      canvas.height = SCRATCH_H;
      scratch = canvas.getContext("2d", { willReadFrequently: true })!;
    }
    const aspect =
      img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : 2;
    const sw = Math.min(SCRATCH_W, Math.round(SCRATCH_H * aspect));
    const sh = Math.round(sw / aspect);
    scratch.clearRect(0, 0, SCRATCH_W, SCRATCH_H);
    scratch.drawImage(img, 0, 0, sw, sh);
    const pixels = scratch.getImageData(0, 0, sw, sh).data;
    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (pixels[(y * sw + x) * 4 + 3] > 16) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) {
      return;
    }
    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    // Compact shapes (grenades, the bomb) run taller so their detail survives.
    let h = ICON_H * ICON_SCALE * (tw / th < 1.4 ? 1.25 : 1);
    let w = (h * tw) / th;
    if (w > WEAPON_W - 4) {
      w = WEAPON_W - 4;
      h = (w * th) / tw;
    }
    g.save();
    g.beginPath();
    g.rect(cell.x, cell.y, WEAPON_W, WEAPON_H);
    g.clip();
    g.clearRect(cell.x, cell.y, WEAPON_W, WEAPON_H);
    g.drawImage(
      scratch.canvas,
      minX,
      minY,
      tw,
      th,
      cell.x + (WEAPON_W - w) / 2,
      cell.y + (WEAPON_H - h) / 2,
      w,
      h,
    );
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff";
    g.fillRect(cell.x, cell.y, WEAPON_W, WEAPON_H);
    g.restore();
    cell.width = w / ICON_SCALE;
    cell.height = h / ICON_SCALE;
    dirty = true;
  }

  // Names drawn before the font lands fall back to another face: redo them.
  const font = Promise.all([fontReady(NAME_FONT), fontReady(NUMBER_FONT)]).then(
    () => {
      for (let i = 0; i < SLOTS; i++) {
        const slot = slots[i];
        if (slot) {
          drawName(i, slot);
          if (!slot.photo && slot.number !== null) {
            drawAvatar(i, slot);
          }
        }
      }
    },
  );
  pending.add(font);
  font.then(() => pending.delete(font));

  function photo(url: string) {
    const known = photos.get(url);
    if (known) {
      return known === "failed" || !known.complete ? null : known;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    photos.set(url, img);
    const done = new Promise<void>((resolve) => {
      img.onload = () => {
        for (let i = 0; i < SLOTS; i++) {
          const slot = slots[i];
          if (slot?.url === url && !slot.photo) {
            drawAvatar(i, slot);
          }
        }
        resolve();
      };
      img.onerror = () => {
        photos.set(url, "failed");
        resolve();
      };
    });
    pending.add(done);
    done.then(() => pending.delete(done));
    img.src = url;
    return null;
  }

  function drawAvatar(index: number, slot: Slot) {
    const x = (index % 8) * AVATAR;
    const y = Math.floor(index / 8) * AVATAR;
    const fill = TEAM_STYLE[slot.team].fill;
    g.save();
    g.beginPath();
    g.rect(x, y, AVATAR, AVATAR);
    g.clip();
    const bg = g.createLinearGradient(x, y, x, y + AVATAR);
    bg.addColorStop(0, shade(fill, 1.12));
    bg.addColorStop(1, shade(fill, 0.72));
    g.fillStyle = bg;
    g.fillRect(x, y, AVATAR, AVATAR);
    const img = slot.url ? photo(slot.url) : null;
    slot.photo = !!img;
    if (img) {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      g.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        x,
        y,
        AVATAR,
        AVATAR,
      );
    } else if (slot.number !== null) {
      // The team slot, like the old radar's numbered kites.
      g.font = NUMBER_FONT;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#fff";
      g.fillText(String(slot.number), x + AVATAR / 2, y + AVATAR / 2 + 4);
    } else {
      // A head-and-shoulders bust in a pale team tint.
      const cx = x + AVATAR / 2;
      g.fillStyle = mixWhite(fill, 0.62);
      g.beginPath();
      g.arc(cx, y + 50, 21, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(cx, y + 118, 44, 38, 0, Math.PI, 0);
      g.fill();
    }
    g.restore();
    dirty = true;
  }

  function drawName(index: number, slot: Slot) {
    const x = (index % 4) * NAME_W;
    const y = NAMES_Y + Math.floor(index / 4) * NAME_H;
    g.clearRect(x, y, NAME_W, NAME_H);
    g.font = NAME_FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let text = slot.name;
    const room = NAME_W - 16;
    if (g.measureText(text).width > room) {
      while (text.length > 1 && g.measureText(`${text}…`).width > room) {
        text = text.slice(0, -1);
      }
      text = `${text}…`;
    }
    slot.width = g.measureText(text).width / 4;
    g.fillStyle = "#fff";
    g.fillText(text, x + NAME_W / 2, y + NAME_H / 2 + 1);
    dirty = true;
  }

  return {
    texture,
    slot(id, name, team, url, number, frame) {
      let index = byKey.get(id);
      if (index === undefined) {
        index = slots.indexOf(null);
        if (index < 0) {
          let oldest = 0;
          for (let i = 1; i < SLOTS; i++) {
            if (slots[i]!.seen < slots[oldest]!.seen) {
              oldest = i;
            }
          }
          byKey.delete(slots[oldest]!.key);
          index = oldest;
        }
        const slot: Slot = {
          key: id,
          name,
          team,
          url,
          number,
          width: 0,
          seen: frame,
          photo: false,
        };
        slots[index] = slot;
        byKey.set(id, index);
        drawAvatar(index, slot);
        drawName(index, slot);
        return index;
      }
      const slot = slots[index]!;
      slot.seen = frame;
      if (slot.team !== team || slot.url !== url || slot.number !== number) {
        slot.team = team;
        slot.url = url;
        slot.number = number;
        drawAvatar(index, slot);
      }
      if (slot.name !== name) {
        slot.name = name;
        drawName(index, slot);
      }
      return index;
    },
    nameWidth(index) {
      return slots[index]?.width ?? 0;
    },
    weapon(name, frame) {
      if (!name) {
        return null;
      }
      let key = basenames.get(name);
      if (key === undefined) {
        key = weaponBasename(name);
        basenames.set(name, key);
      }
      if (!key) {
        return null;
      }
      const cell = byWeapon.get(key) ?? weaponCell(key, frame);
      if (!cell) {
        return null;
      }
      cell.seen = frame;
      return cell.width > 0 ? cell : null;
    },
    kitIcon() {
      // Pinned: never the oldest cell, so a busy round cannot evict it.
      const cell = byWeapon.get("defuser") ?? weaponCell("defuser", Infinity);
      if (!cell) {
        return null;
      }
      cell.seen = Infinity;
      return cell.width > 0 ? cell : null;
    },
    setIconBase(next) {
      if (next === base) {
        return;
      }
      base = next;
      byWeapon.clear();
      cells.fill(null);
    },
    flush() {
      if (dirty) {
        texture.needsUpdate = true;
        dirty = false;
      }
    },
    async settle() {
      while (pending.size) {
        await Promise.all(pending);
      }
    },
    dispose() {
      texture.dispose();
      photos.clear();
    },
  };
}

const VERT = /* glsl */ `
attribute vec4 iAnchor;
attribute vec4 iRing;
attribute vec4 iState;
attribute vec4 iState2;
attribute vec4 iWeapon;
attribute vec4 iTint;
attribute vec4 iChip;
attribute vec2 iLevel;
attribute vec4 iAct;
uniform vec2 uViewport;
varying vec2 vP;
varying vec4 vAnchor;
varying vec4 vRing;
varying vec4 vState;
varying vec4 vState2;
varying vec4 vWeapon;
varying vec4 vTint;
varying vec4 vChip;
varying vec2 vLevel;
varying vec4 vAct;
void main() {
  vec2 local = mix(vec2(${BADGE.quadMin[0].toFixed(1)}, ${BADGE.quadMin[1].toFixed(1)}), vec2(${BADGE.quadMax[0].toFixed(1)}, ${BADGE.quadMax[1].toFixed(1)}), uv);
  vec2 px = iAnchor.xy + vec2(local.x, -local.y) * iAnchor.z;
  gl_Position = vec4(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0, 0.0, 1.0);
  vP = local;
  vAnchor = iAnchor;
  vRing = iRing;
  vState = iState;
  vState2 = iState2;
  vWeapon = iWeapon;
  vTint = iTint;
  vChip = iChip;
  vLevel = iLevel;
  vAct = iAct;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uPlates;
/** The defuser icon's atlas cell: x, y, and its height in CSS px. */
uniform vec3 uKit;
varying vec2 vP;
varying vec4 vAnchor;
varying vec4 vRing;
varying vec4 vState;
varying vec4 vState2;
varying vec4 vWeapon;
varying vec4 vTint;
varying vec4 vChip;
varying vec2 vLevel;
varying vec4 vAct;
${OUTPUT_GLSL}
const float PR = ${BADGE.portraitRadius.toFixed(1)};
const float PY_FULL = ${BADGE.portraitY.toFixed(1)};
const float PY_DROP = ${BADGE.namelessDrop.toFixed(1)};
const float PLATE_Y = ${BADGE.plateY.toFixed(1)};
const float PLATE_HH = ${BADGE.plateHalfH.toFixed(1)};
const float TRI_H = ${BADGE.pointerH.toFixed(1)};
const float TRI_HW = 6.5;
const float RING_W = 3.4;
const float TAU = 6.2831853;
const float ICON_SCALE = ${ICON_SCALE.toFixed(1)};

vec4 acc = vec4(0.0);
void over(vec3 c, float a) {
  acc = vec4(c * a, a) + acc * (1.0 - a);
}
float box(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
vec4 atlas(vec2 px) {
  return texture2D(uAtlas, px / ${ATLAS.toFixed(1)});
}

void main() {
  float slot = vAnchor.w;
  vec3 ring = vRing.rgb;
  float halfW = vRing.w;
  float alpha = vState.x;
  float wash = vState.y;
  float flash = vState.z;
  float health = vState.w;
  float kit = vState2.x;
  float eye = vState2.y;
  float dead = vState2.z;
  float names = vState2.w;
  float halo = vTint.w;
  float PY = PY_FULL - PY_DROP * (1.0 - names);
  vec2 p = vP;

  vec2 pc = p - vec2(0.0, PY);
  float d = length(pc) - PR;

  vec3 ringNow = mix(mix(ring, vec3(1.0, 0.2, 0.33), flash), vec3(1.0), wash * 0.85);
  vec3 add = vec3(0.0);

  // Two passes over the same instances: every portrait, then every plate,
  // so a neighbour's portrait never covers a name.
  if (uPlates > 0.5) {
  // Pointer, then the name plate: the name centred over the pointer, the
  // held weapon after it, so the icon only ever widens the plate rightwards.
  float dTri = max((abs(p.x) * TRI_H - p.y * TRI_HW) / length(vec2(TRI_H, TRI_HW)), p.y - TRI_H - 1.5);
  over(ringNow, cover(dTri));
  // The plate carries the gun only while it is big enough to read.
  float iconW = vWeapon.z * step(0.5, vChip.w);
  float right = halfW + (iconW > 0.0 ? iconW + 5.0 : 0.0);
  float dPlate = box(p - vec2(0.5 * (right - halfW), PLATE_Y), vec2(0.5 * (right + halfW) + 7.0, PLATE_HH), 4.0);
  over(vec3(0.0), 0.4 * names * cover(dPlate));
  vec2 tq = p - vec2(0.0, PLATE_Y);
  vec2 nameCell = vec2(mod(slot, 4.0) * ${NAME_W.toFixed(1)} + ${(NAME_W / 2).toFixed(1)}, ${NAMES_Y.toFixed(1)} + floor(slot / 4.0) * ${NAME_H.toFixed(1)} + ${(NAME_H / 2).toFixed(1)});
  float inName = step(abs(tq.x), 63.0) * step(abs(tq.y), 11.9);
  over(vec3(1.0), atlas(nameCell + vec2(tq.x, -tq.y) * 2.0).a * inName * names * (1.0 - dead * 0.5));
  vec2 iq = p - vec2(right - 0.5 * iconW, PLATE_Y);
  float inIcon = step(abs(iq.x), 0.5 * iconW + 0.5) * step(abs(iq.y), 0.5 * vWeapon.w + 0.5) * step(0.5, iconW);
  // A freshly drawn weapon: its slot of the plate flashes the team colour.
  float dSlot = box(iq, vec2(0.5 * iconW + 3.0, PLATE_HH - 2.5), 3.0);
  over(ringNow, 0.75 * vAct.z * names * vChip.w * step(0.5, iconW) * cover(dSlot));
  vec4 icon = atlas(vWeapon.xy + vec2(${(WEAPON_W / 2).toFixed(1)}, ${(WEAPON_H / 2).toFixed(1)}) + vec2(iq.x, -iq.y) * ICON_SCALE);
  over(vTint.rgb, icon.a * inIcon * names * vChip.w * (1.0 - dead * 0.5));
  // Crouching: a down chevron on the portrait's lower left, over the plate.
  vec2 duckC = vec2(-PR * 0.78, PY - PR * 0.62);
  float duck = vAct.w;
  float dDuck = length(p - duckC) - 8.5;
  over(vec3(0.08, 0.09, 0.11), 0.92 * duck * cover(dDuck));
  vec2 dq = p - duckC;
  float dChev = abs(abs(dq.x) * 0.8 - dq.y * 0.6 - 0.9) - 1.25;
  over(vec3(1.0), duck * cover(max(dChev, abs(dq.x) - 4.4)));
  } else {
  // Once the plates are gone, the weapon rides in a chip off the portrait's
  // side, kept to a readable size whatever the zoom; the portrait covers
  // its inner end.
  float chip = vChip.x;
  if (chip > 0.0) {
    float k = vChip.y;
    float side = vChip.z;
    float iw = vWeapon.z * k;
    float ih = vWeapon.w * k;
    vec2 cq = vec2(p.x * side, p.y - (PY - PR * 0.4));
    float x0 = PR * 0.5;
    float x1 = PR + 9.0 * k + iw;
    float dChip = box(cq - vec2(0.5 * (x0 + x1), 0.0), vec2(0.5 * (x1 - x0), 0.5 * ih + 3.5 * k), 4.0 * k);
    over(vec3(0.0), 0.62 * chip * cover(dChip));
    // A freshly drawn weapon: the chip flashes the team colour.
    over(ringNow, 0.75 * vAct.z * chip * cover(dChip));
    vec2 iq = vec2(p.x - side * (PR + 4.5 * k + 0.5 * iw), cq.y) / k;
    float inIcon = step(abs(iq.x), 0.5 * vWeapon.z + 0.5) * step(abs(iq.y), 0.5 * vWeapon.w + 0.5);
    vec4 icon = atlas(vWeapon.xy + vec2(${(WEAPON_W / 2).toFixed(1)}, ${(WEAPON_H / 2).toFixed(1)}) + vec2(iq.x, -iq.y) * ICON_SCALE);
    over(vTint.rgb, icon.a * inIcon * chip);
  }

  // Soft drop shadow, so stacked portraits read as coins.
  over(vec3(0.0), 0.4 * (1.0 - smoothstep(-3.0, 5.0, length(pc + vec2(-0.5, 2.5)) - PR)));

  // Portrait: a thin dark edge, the photo, the team ring.
  over(vec3(0.0), 0.45 * cover(d - 1.2));
  float inner = PR - RING_W;
  vec2 cellA = vec2(mod(slot, 8.0), floor(slot / 8.0)) * ${AVATAR.toFixed(1)} + ${(AVATAR / 2).toFixed(1)};
  vec3 photo = atlas(cellA + vec2(pc.x, -pc.y) / inner * ${(AVATAR / 2 - 2).toFixed(1)}).rgb;
  float grey = dot(photo, vec3(0.3, 0.55, 0.15));
  photo = mix(photo, vec3(grey * 0.7), dead);
  photo = mix(photo, vec3(1.0), wash * 0.9);
  // The ring doubles as a health gauge, draining anticlockwise from the top.
  float turn = fract(atan(pc.x, pc.y) / TAU + 1.0);
  float lost = smoothstep(health - 0.004, health + 0.004, turn) * step(health, 0.999);
  vec3 ringCol = mix(ringNow, vec3(0.1, 0.11, 0.13), lost * 0.85);
  over(mix(photo, ringCol, 1.0 - cover(d + RING_W)), cover(d));

  // Blindness left: a white arc outside the ring, emptying back to the top.
  float rArc = length(pc) - (PR + 4.5);
  float blinded = step(0.02, wash);
  over(vec3(0.08, 0.09, 0.11), 0.6 * blinded * cover(abs(rArc) - 2.7));
  over(vec3(1.0), blinded * step(turn, wash) * cover(abs(rArc) - 1.8));
  // Flash rays: eight short white spikes, as long as the blindness is deep.
  float rr = length(pc);
  float r0 = PR + 8.5;
  float rayLen = 3.0 + 10.0 * wash;
  float f = fract(atan(pc.y, pc.x) / TAU * 8.0) - 0.5;
  float along = clamp((rr - r0) / rayLen, 0.0, 1.0);
  float dRay = max(abs(f) * TAU / 8.0 * rr - 2.4 * (1.0 - along), max(r0 - rr, rr - r0 - rayLen));
  float rays = smoothstep(0.05, 0.3, wash);
  over(vec3(0.08, 0.09, 0.11), 0.5 * rays * cover(dRay - 1.2));
  over(vec3(1.0), rays * cover(dRay));

  // Status badges on the portrait's edge.
  vec2 eyeC = vec2(PR * 0.74, PY + PR * 0.74);
  float dEye = length(p - eyeC) - 12.0;
  over(vec3(0.08, 0.09, 0.11), cover(dEye - 1.6) * eye);
  over(vec3(1.0), cover(dEye) * eye);
  vec4 eyeIcon = atlas(vec2(32.0, ${(ICONS_Y + 32).toFixed(1)}) + vec2(p.x - eyeC.x, eyeC.y - p.y) * 2.4);
  over(eyeIcon.rgb, eyeIcon.a * cover(dEye) * eye);
  // Kit: the game's defuser icon on CT blue; a defuse without one shows it
  // crossed out.
  vec2 kitC = vec2(PR * 0.74, PY - PR * 0.74);
  float dKit = length(p - kitC) - 9.5;
  float hasKit = min(kit, 1.0);
  float noKit = step(1.5, kit);
  over(vec3(0.06, 0.07, 0.09), 0.9 * cover(dKit - 1.5) * hasKit);
  over(mix(vec3(0.08, 0.3, 0.55), vec3(0.3, 0.08, 0.08), noKit), cover(dKit) * hasKit);
  vec2 kq = (p - kitC) * (ICON_SCALE * max(uKit.z, 1.0) / 11.0);
  float inKit = step(abs(kq.x), ${(WEAPON_W / 2).toFixed(1)}) * step(abs(kq.y), ${(WEAPON_H / 2).toFixed(1)}) * step(0.5, uKit.z);
  vec4 kitIcon = atlas(uKit.xy + vec2(${(WEAPON_W / 2).toFixed(1)}, ${(WEAPON_H / 2).toFixed(1)}) + vec2(kq.x, -kq.y));
  over(vec3(1.0) * (1.0 - 0.3 * noKit), kitIcon.a * inKit * cover(dKit) * hasKit);
  vec2 sq = p - kitC;
  over(vec3(1.0, 0.3, 0.25), noKit * cover(max(abs(sq.x + sq.y) * 0.7071 - 1.3, length(sq) - 9.0)));

  // Planting or defusing: a ring outside the portrait filling clockwise
  // over the real duration, bomb red to plant, team colour to defuse.
  float act = vAct.x;
  if (vAct.y > 0.5) {
    float rAct = length(pc) - (PR + 6.0);
    vec3 actCol = mix(vec3(1.0, 0.29, 0.24), ringNow, step(1.5, vAct.y));
    over(vec3(0.06, 0.07, 0.09), 0.85 * cover(abs(rAct) - 3.4));
    over(actCol, step(turn, act) * cover(abs(rAct) - 2.2));
  }

  // Glows: white while blind, red-pink as they take a hit.
  float outside = max(d, 0.0);
  add = vec3(1.0) * halo * 1.2 * exp(-outside / 11.0) * step(0.0, d)
    + vec3(1.0, 0.25, 0.38) * flash * 0.85 * exp(-outside / 5.0) * step(0.0, d);
  }

  // Off the storey in view: faded, with a ▲ or ▼ for where they are, kept
  // at full strength so it still reads.
  float fade = 1.0 - vLevel.y;
  vec4 result = acc * alpha * fade;
  if (uPlates < 0.5 && vLevel.x != 0.0) {
    vec2 lc = p - vec2(-PR * 0.76, PY + PR * 0.76);
    float dDisc = length(lc) - 11.5;
    vec2 tq = vec2(lc.x, lc.y * sign(vLevel.x) + 0.7) / 1.3;
    float dArrow = 1.3 * max((abs(tq.x) * 8.0 + (tq.y - 4.6) * 5.2) / 9.54, -3.4 - tq.y);
    vec3 c = mix(vec3(0.08, 0.09, 0.11), vec3(1.0), cover(dArrow));
    float a = alpha * cover(dDisc);
    result = vec4(c * a, a) + result * (1.0 - a);
  }
  vec3 straight = result.a > 0.0001 ? result.rgb / result.a : vec3(0.0);
  gl_FragColor = vec4(toOutput(straight) * result.a + toOutput(add * alpha * fade), result.a);
}
`;

export type BadgeBatch = {
  /** Portraits, then the plates of the same instances drawn over them all. */
  mesh: THREE.Mesh;
  plates: THREE.Mesh;
  begin(): void;
  push(
    x: number,
    y: number,
    scale: number,
    slot: number,
    nameWidth: number,
    ring: number,
    alpha: number,
    wash: number,
    flash: number,
    health: number,
    /** 1 has a kit, 2 defusing without one, 0 neither. */
    kit: number,
    eye: number,
    dead: number,
    /** 0..1, how much of the name plate shows. */
    names: number,
    weapon: WeaponCell | null,
    /** 0..1, the white glow of a blinded player. */
    halo: number,
    /**
     * The icon-only weapon chip: how much shows, its size factor against
     * the plate icon, and its side (1 right, -1 left).
     */
    chip: number,
    chipScale: number,
    chipSide: number,
    /** 0..1, how much the weapon shows on the name plate instead. */
    plateIcon: number,
    /** 1 above the storey in view, -1 below, 0 on it. */
    level: number,
    /** 0..1, how far it is dimmed for standing off that storey. */
    dim: number,
    /** How far a plant or defuse has got, 0..1. */
    act: number,
    /** 0 none, 1 planting, 2 defusing. */
    actKind: number,
    /** 1 just after a weapon switch, easing to 0. */
    pop: number,
    /** 0..1, crouching. */
    duck: number,
  ): void;
  end(): void;
  setViewport(width: number, height: number): void;
  /** Where the defuser icon sits in the atlas, once it has drawn. */
  setKit(cell: WeaponCell | null): void;
  dispose(): void;
};

export function createBadgeBatch(
  texture: THREE.Texture,
  max: number,
): BadgeBatch {
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  const layout = {
    iAnchor: 4,
    iRing: 4,
    iState: 4,
    iState2: 4,
    iWeapon: 4,
    iTint: 4,
    iChip: 4,
    iLevel: 2,
    iAct: 4,
  };
  const arrays: Record<string, Float32Array> = {};
  const attrs: THREE.InstancedBufferAttribute[] = [];
  for (const [name, size] of Object.entries(layout)) {
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(max * size),
      size,
    );
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
    arrays[name] = attr.array as Float32Array;
    attrs.push(attr);
  }
  const viewport = new THREE.Vector2(1, 1);
  const kitCell = new THREE.Vector3(0, 0, 0);
  const pass = (plates: boolean) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAtlas: { value: texture },
        uViewport: { value: viewport },
        uKit: { value: kitCell },
        uPlates: { value: plates ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = plates ? 1000.5 : 1000;
    return mesh;
  };
  const mesh = pass(false);
  const plates = pass(true);
  const {
    iAnchor,
    iRing,
    iState,
    iState2,
    iWeapon,
    iTint,
    iChip,
    iLevel,
    iAct,
  } = arrays;
  let count = 0;
  return {
    mesh,
    plates,
    begin() {
      count = 0;
    },
    push(
      x,
      y,
      scale,
      slot,
      nameWidth,
      ring,
      alpha,
      wash,
      flash,
      health,
      kit,
      eye,
      dead,
      names,
      weapon,
      halo,
      chip,
      chipScale,
      chipSide,
      plateIcon,
      level,
      dim,
      act,
      actKind,
      pop,
      duck,
    ) {
      if (count >= max || alpha <= 0) {
        return;
      }
      const i = count++;
      iAnchor[i * 4] = x;
      iAnchor[i * 4 + 1] = y;
      iAnchor[i * 4 + 2] = scale;
      iAnchor[i * 4 + 3] = slot;
      writeSrgb(iRing, i * 4, ring);
      iRing[i * 4 + 3] = nameWidth;
      iState[i * 4] = alpha;
      iState[i * 4 + 1] = wash;
      iState[i * 4 + 2] = flash;
      iState[i * 4 + 3] = health;
      iState2[i * 4] = kit;
      iState2[i * 4 + 1] = eye;
      iState2[i * 4 + 2] = dead;
      iState2[i * 4 + 3] = names;
      iWeapon[i * 4] = weapon?.x ?? 0;
      iWeapon[i * 4 + 1] = weapon?.y ?? 0;
      iWeapon[i * 4 + 2] = weapon?.width ?? 0;
      iWeapon[i * 4 + 3] = weapon?.height ?? 0;
      writeSrgb(iTint, i * 4, weapon?.tint ?? 0xffffff);
      iTint[i * 4 + 3] = halo;
      iChip[i * 4] = weapon ? chip : 0;
      iChip[i * 4 + 1] = chipScale;
      iChip[i * 4 + 2] = chipSide;
      iChip[i * 4 + 3] = plateIcon;
      iLevel[i * 2] = level;
      iLevel[i * 2 + 1] = dim;
      iAct[i * 4] = act;
      iAct[i * 4 + 1] = actKind;
      iAct[i * 4 + 2] = pop;
      iAct[i * 4 + 3] = duck;
    },
    end() {
      geometry.instanceCount = count;
      for (const attr of attrs) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, count * attr.itemSize);
        attr.needsUpdate = true;
      }
      mesh.visible = count > 0;
      plates.visible = count > 0;
    },
    setKit(cell) {
      kitCell.set(cell?.x ?? 0, cell?.y ?? 0, cell?.height ?? 0);
    },
    setViewport(width, height) {
      viewport.set(width, height);
    },
    dispose() {
      plane.dispose();
      geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      (plates.material as THREE.Material).dispose();
    },
  };
}
