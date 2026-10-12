/**
 * GLSL for the map. Positions stay in source units (x east, y north, z up)
 * under a group rotated into the Y-up world, so every height test reads
 * `position.z` directly.
 */

/**
 * The roof cut: each surface carries the floor height its patch is cut from
 * (prep decides it per patch, see `cutPlanes`), and goes above that plus a
 * height. One plane per patch, so cut edges are straight. Walls are sliced
 * at the plane; roofs and small loose pieces go whole once the cut is under
 * their group's top.
 *
 * 2D removes what is above `uCut2D`; 3D keeps what is above `uCut3D` as a
 * translucent ghost (`uGhost`). `uView` (0 at the 3D pitch, 1 straight
 * down) blends the two, so tilting fades between them with no pop.
 */
export const CUT_GLSL = /* glsl */ `
uniform float uCut2D;
uniform float uCut3D;
uniform float uView;
uniform float uGhost;
// A chosen lower level: everything above this height fades to a faint
// ghost as uLevelMix goes to 1.
uniform float uLevelCut;
uniform float uLevelMix;
// The floor the surface is cut from (32767: never), its group's top, and
// its patch's bottom.
flat varying vec3 vCut;

// Whether a cut at height h above the floor takes this fragment.
bool cutBy(int info, float z, float h) {
  if (vCut.x > 32000.0 || h > 1e8) return false;
  float plane = vCut.x + h;
  if ((info & 3) == 1 || (info & 6144) == 2048) return z > plane;
  return vCut.y > plane;
}

// 1 solid, 0 gone, between: the ghost's opacity. Leaves stay in 3D and are
// screened, not removed, in 2D; what hangs over a room goes outright.
float cutOpacity(int info, float z) {
  bool leaf = (info & 3) == 1;
  float ghost = (info & 16384) != 0 ? 0.0 : uGhost;
  float in3D = !leaf && cutBy(info, z, uCut3D) ? ghost : 1.0;
  float in2D = cutBy(info, z, uCut2D) ? (leaf ? 0.4 : 0.0) : 1.0;
  float opacity = mix(in3D, in2D, uView);
  if (z > uLevelCut) opacity *= mix(1.0, 0.1, uLevelMix);
  return opacity;
}

// Where the solid part of a wall ends right now, for its ink line and cap.
float cutLine() {
  float h = uView > 0.001 ? uCut2D : uCut3D;
  return vCut.x < 32000.0 && h < 1e8 ? vCut.x + h : 1e9;
}

bool wallSliced(int info) {
  return (info & 6144) == 2048 && vCut.y > cutLine();
}
`;

/**
 * The table the map stands on, as the dunes paint it, so the map's own
 * out-of-bounds ground and the ground round it meet without a seam. `lit` is
 * the sun term (1 for flat ground in full sun), shadows already in it; they
 * fall soft on the table so it stays a dark, quiet surface.
 */
export const SAND_GLSL = /* glsl */ `
float sandHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 sandColor(vec3 src, float lit, vec3 sand, vec3 sandShade) {
  vec3 col = mix(sandShade, sand, smoothstep(0.0, 1.0, lit));
  // Faint drifts and grain, so a big flat table is not a void.
  col *= 0.96 + 0.08 * smoothstep(-1.0, 1.0, sin(src.x * 0.0011 + sin(src.y * 0.0007) * 2.0));
  col *= 0.99 + 0.02 * sandHash(floor(src.xy / 64.0));
  return col;
}
`;

export const MAP_VERT = /* glsl */ `
uniform vec3 uWorldShift;
attribute float aHeight;
attribute float aInfo;
attribute vec3 aCut;
attribute float aRemote;
attribute vec4 aCanopy;
varying vec4 vCanopy;
flat varying vec3 vCut;
varying float vRemote;
varying vec3 vSrc;
varying vec3 vWorld;
varying float vH;
varying vec3 vBary;
flat varying float vInfo;
void main() {
  vSrc = position;
  vH = aHeight;
  vInfo = aInfo;
  vCut = aCut;
  vRemote = aRemote;
  vCanopy = aCanopy;
  int corner = gl_VertexID % 3;
  vBary = vec3(corner == 0, corner == 1, corner == 2);
  vec4 world = modelMatrix * vec4(position, 1.0);
  // A lower storey's copy is lit where the storey really is.
  vWorld = world.xyz - uWorldShift;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MAP_FRAG = /* glsl */ `
${CUT_GLSL}
${SAND_GLSL}
uniform vec3 uSun;
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform highp sampler2D uHeightMap;
uniform sampler2D uAoMap;
uniform vec4 uTopGrid;
uniform vec2 uZRange;
uniform vec3 uTop;
// 1 to hatch the flat tops nobody can walk on (MapPalette.noAccess).
uniform float uNoAccess;
uniform vec3 uFloor;
// Floors open to the sky (a yard, a street), and the top-down height of the
// map with nothing cut, which says which floors are.
uniform vec3 uFloorOutdoor;
uniform highp sampler2D uSkyMap;
uniform vec3 uWall;
uniform vec3 uFoliage;
uniform vec3 uProps[3];
uniform vec3 uSeeThrough;
uniform vec3 uSand;
uniform vec3 uSandShade;
uniform vec3 uShadow;
uniform vec3 uOcclusion;
uniform vec3 uOutline;
uniform vec3 uSite;
uniform vec3 uSiteLetter;
uniform vec4 uSites[2];
uniform vec4 uSiteZ;
uniform sampler2D uLetters;
uniform float uLetterSize;
uniform float uLineWidth;
uniform float uAlpha;
// Side by side: the main map clears outskirts where the lower storey's copy
// lands (x0, y0, x1, y1; off when x1 < x0); the copy keeps only its storey,
// in this rect and between these heights (bottom, cut).
uniform vec4 uCopyLanding;
uniform vec4 uCopyRect;
uniform vec2 uCopyZ;
uniform vec3 uHaze;
uniform vec3 uMapCentre;
uniform vec2 uHazeRange;

varying vec3 vSrc;
varying vec3 vWorld;
varying float vH;
varying vec3 vBary;
flat varying float vInfo;
varying float vRemote;
varying vec4 vCanopy;

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

#define TOP_SPAN 22.0
#define TOP_STEP 18.0

float unpackHeight(vec4 t) {
  return uZRange.x + (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0 * uZRange.y;
}

vec2 topUv(vec2 xy) {
  return (xy - uTopGrid.xy) * uTopGrid.zw;
}

// One side's slope of the top-down height field, or none past a step.
float topSlope(float h0, float hPlus, float hMinus, float fallback) {
  bool plus = abs(hPlus - h0) < TOP_STEP;
  bool minus = abs(hMinus - h0) < TOP_STEP;
  if (plus && minus) return (hPlus - hMinus) / (2.0 * TOP_SPAN);
  if (plus) return (hPlus - h0) / TOP_SPAN;
  if (minus) return (h0 - hMinus) / TOP_SPAN;
  return fallback;
}

// The normal of the top surface around here, from the baked height field;
// the facet's own where the bake did not see this fragment.
vec3 topNormal(vec3 n, float zPerPx) {
  float h0 = unpackHeight(texture2D(uHeightMap, topUv(vSrc.xy)));
  if (abs(h0 - vSrc.z) > 6.0 + zPerPx * 2.0 || n.z < 0.3) return n;
  float sx = topSlope(
    h0,
    unpackHeight(texture2D(uHeightMap, topUv(vSrc.xy + vec2(TOP_SPAN, 0.0)))),
    unpackHeight(texture2D(uHeightMap, topUv(vSrc.xy - vec2(TOP_SPAN, 0.0)))),
    -n.x / n.z);
  float sy = topSlope(
    h0,
    unpackHeight(texture2D(uHeightMap, topUv(vSrc.xy + vec2(0.0, TOP_SPAN)))),
    unpackHeight(texture2D(uHeightMap, topUv(vSrc.xy - vec2(0.0, TOP_SPAN)))),
    -n.y / n.z);
  return normalize(vec3(-sx, -sy, 1.0));
}

float sunVisibility(vec3 nWorld) {
  vec4 sc = uShadowMatrix * vec4(vWorld + nWorld * 3.0, 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  float z = sc.z - 0.0008;
#ifdef SOFT_SHADOWS
  float o = uShadowTexel * 0.75;
  return 0.25 * (
    texture(uShadowMap, vec3(sc.xy + vec2(-o, -o), z)) +
    texture(uShadowMap, vec3(sc.xy + vec2(o, -o), z)) +
    texture(uShadowMap, vec3(sc.xy + vec2(-o, o), z)) +
    texture(uShadowMap, vec3(sc.xy + vec2(o, o), z)));
#else
  return texture(uShadowMap, vec3(sc.xy, z));
#endif
}

// The alpha a pass writes: the ghost and see-through passes carry the cut's
// opacity, the solid pass is opaque.
float opacityOut(float opacity) {
#if defined(GHOST) || defined(SEE_THROUGH)
  return opacity;
#else
  return 1.0;
#endif
}

float roundRect(vec2 p, vec4 r, float radius) {
  vec2 c = (r.xy + r.zw) * 0.5;
  vec2 q = abs(p - c) - (r.zw - r.xy) * 0.5 + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec3 dx = dFdx(vSrc);
  vec3 dy = dFdy(vSrc);
  vec3 facing = normalize(cross(dx, dy));
  vec3 n = gl_FrontFacing ? facing : -facing;
  // A ceiling seen from above with no roof over it (Valve often builds
  // only the inside) is the building's top as far as the view goes.
  if (!gl_FrontFacing && n.z < -0.6) n = -n;
  int info = int(vInfo + 0.5);
  int surface = info & 3;
  bool walkable = (info & 8) != 0;
  bool outside = (info & 4) != 0;
  bool floorless = (info & 128) != 0;
  bool ground = (info & 8192) != 0;
  float zPerPx = length(vec2(dFdx(vSrc.z), dFdy(vSrc.z)));
  vec3 bw = fwidth(vBary);

  float cut = cutLine();
  float levelLift = vSrc.z < uLevelCut ? uLevelMix : 0.0;
  bool foliage = surface == 1;
  float opacity = cutOpacity(info, vSrc.z);
#ifdef LEVEL_COPY
  levelLift = 1.0;
  if (
    surface == 1 ||
    vSrc.z > uCopyZ.y ||
    vSrc.z < uCopyZ.x ||
    any(lessThan(vSrc.xy, uCopyRect.xy)) ||
    any(greaterThan(vSrc.xy, uCopyRect.zw))
  ) discard;
#else
  // Whatever of the map strays past its play area (a crane's jib, the
  // outskirts) gives way where the lower storey is laid.
  if (
    uCopyLanding.z > uCopyLanding.x &&
    all(greaterThan(vSrc.xy, uCopyLanding.xy)) &&
    all(lessThan(vSrc.xy, uCopyLanding.zw))
  ) discard;
#endif
#if defined(GHOST) || defined(GHOST_DEPTH)
  // The ghost passes draw only what is part-way gone.
  if (opacity > 0.999 || opacity < 0.001) discard;
#elif defined(SEE_THROUGH)
  if (opacity < 0.001) discard;
#else
  if (opacity < 0.999) discard;
#endif
#ifdef GHOST_DEPTH
  gl_FragColor = vec4(0.0);
  return;
#endif

  vec3 col;
  float up = n.z;
  bool isFlat = up > 0.6;
  // Looking through a cut into a wall's thickness shows the backs of its
  // faces: they read as the top of the cut wall. Back faces anywhere else
  // (single-sided trims, tile ends) are just surfaces seen from behind.
  bool cap = !gl_FrontFacing && wallSliced(info);
#ifdef LEVEL_COPY
  // Cut open at its ceiling: whatever shows its back is a wall's inside.
  cap = !gl_FrontFacing;
#endif
  // Leaves light by their tree's soft canopy normal (see PrepMesh.canopy),
  // not card by card.
  vec3 leaf = dot(vCanopy.xyz, vCanopy.xyz) > 0.1 ? normalize(vCanopy.xyz) : n;
  if (foliage) {
    // A per-tree shift toward yellow-green or blue-green, and a darker
    // underside, so a stand of trees reads as separate rounded crowns.
    float tone = vCanopy.w;
    col = uFoliage * mix(vec3(0.92, 1.0, 1.08), vec3(1.1, 1.04, 0.86), tone * 0.5 + 0.5);
    col *= mix(0.62, 1.0, smoothstep(-0.6, 0.5, leaf.z));
    // A darker rim where the crown turns away, for a clean silhouette.
    vec3 toEye = normalize(cameraPosition - vWorld);
    float rim = 1.0 - abs(dot(vec3(leaf.x, leaf.z, -leaf.y), toEye));
    col *= mix(1.0, 0.72, smoothstep(0.6, 0.95, rim));
    cap = false;
  } else if (cap) {
    col = uTop * 0.92;
    up = 1.0;
  } else if (walkable) {
    float sky = unpackHeight(texture2D(uSkyMap, (vSrc.xy - uTopGrid.xy) * uTopGrid.zw));
    col = mix(uFloorOutdoor, uFloor, smoothstep(24.0, 48.0, sky - vSrc.z - zPerPx * 2.0));
  } else if (ground) {
    col = uSand;
  } else if (isFlat) {
    col = uTop;
  } else {
    col = uWall * (up < -0.3 ? 0.7 : 1.0);
  }
  int prop = (info >> 9) & 3;
  if (prop > 0 && !foliage) {
    vec3 tone = prop == 1 ? uProps[0] : prop == 2 ? uProps[1] : uProps[2];
    col = tone * (isFlat || cap ? 1.14 : up < -0.3 ? 0.66 : 0.86);
  }
#ifdef SEE_THROUGH
  col = uSeeThrough;
#endif

  float grime = 0.5;
#ifdef DETAIL
  // Buildings drift between a warmer and a paler plaster block to block.
  if (!walkable && !foliage && !ground && prop == 0) {
    float block = noise2(vSrc.xy / 520.0 + 11.0);
    col *= mix(vec3(1.04, 0.96, 0.92), vec3(0.98, 1.0, 1.03), block);
  }
  // Grime, so flat colour still reads as built stuff.
  grime = noise2(vSrc.xy / 180.0) * 0.6 + noise2(vSrc.xy / 47.0) * 0.4;
  col *= mix(1.0, 0.9 + 0.16 * grime, walkable ? 1.0 : 0.45);
  if (walkable && !cap && prop == 0) {
    // Paving: faint seams and per-slab tone, gone before they would alias.
    vec2 g = vSrc.xy / 64.0;
    vec2 fw = max(fwidth(g), vec2(1e-4));
    vec2 seamPx = abs(fract(g - 0.5) - 0.5) / fw;
    float seam = 1.0 - smoothstep(0.0, 1.2, min(seamPx.x, seamPx.y));
    float near = 1.0 - smoothstep(0.06, 0.2, max(fw.x, fw.y));
    float slab = hash11(dot(floor(g), vec2(1.0, 157.0)) + 0.5);
    col *= 1.0 - near * (seam * 0.08 + (slab - 0.5) * 0.05);
  }
#endif

  // Bomb-site decal: on the floor and the low kerbs and steps in it.
  float decal = 0.0;
  // Flat pieces the extractor did not call floor (a walkway over a lower
  // level) take it too when they are low in the site, so it never breaks up
  // into shards along triangle lines.
  if ((walkable || isFlat || (!foliage && vH < 14.0)) && !cap && prop == 0 && !foliage) {
    for (int i = 0; i < 2; i++) {
      vec4 r = uSites[i];
      vec2 zr = i == 0 ? uSiteZ.xy : uSiteZ.zw;
      if (!walkable && isFlat) zr.y = min(zr.y, zr.x + 224.0);
      if (r.z <= r.x || vSrc.z < zr.x || vSrc.z > zr.y) continue;
      float sd = roundRect(vSrc.xy, r, 28.0);
      float aa = max(fwidth(sd), 0.5);
      float inside = 1.0 - smoothstep(-aa, aa, sd);
      if (inside <= 0.0) continue;
      decal = max(decal, inside);
      vec3 site = uSite * (0.96 + 0.08 * grime);
      // A slightly darker band just inside the edge gives the decal a lip.
      site *= mix(0.8, 1.0, smoothstep(-24.0, -8.0, sd));
      col = mix(col, site, inside);
      vec2 luv = (vSrc.xy - (r.xy + r.zw) * 0.5) / uLetterSize + 0.5;
      if (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
        float letter = texture2D(uLetters, vec2((luv.x + float(i)) * 0.5, luv.y)).r;
        col = mix(col, uSiteLetter, letter * inside);
      }
    }
  }

  // Sun: a lit horizontal surface shows its palette colour exactly.
  // Decal kerbs light as the floor they belong to; tops as the top-down
  // height field smoothed over a few dozen units, so corrugation, tile rows
  // and the fans along eaves stop catching the light facet by facet.
  vec3 ln = decal > 0.0 ? vec3(0.0, 0.0, 1.0) : foliage ? leaf : n;
  if (isFlat && !cap && !foliage && !walkable && decal == 0.0) {
    ln = topNormal(n, zPerPx);
  }
  vec3 nWorld = vec3(ln.x, ln.z, -ln.y);
  float ndl = cap ? uSun.z : dot(ln, uSun);
  float lit = clamp(ndl / uSun.z, 0.0, 1.0);
  if (lit > 0.0 && !cap) {
    // Under a storey taken away, the light it blocked comes back. Leaves
    // take only half their shadow, so a crown is not speckled by its own.
    float vis = sunVisibility(nWorld);
    lit *= mix(vis, 1.0, max(levelLift, foliage ? 0.5 : 0.0));
  }
  if (foliage) {
    // Three soft bands: shade, lit, and a bright cap where it faces the sun.
    float band = smoothstep(0.05, 0.3, lit) * 0.7 + smoothstep(0.62, 0.8, lit) * 0.3;
    lit = mix(0.12, 1.08, band);
  }
  if (!isFlat && !cap && decal == 0.0) {
    lit *= 0.86;
  }
  // Where tops are hatched as out of play, the sun no longer carves them
  // into bright wedges between wall shadows: one tone, a hint of shade.
  if (
    uNoAccess > 0.5 && isFlat && !walkable && !cap && !foliage && !ground &&
    prop == 0 && decal == 0.0
  ) {
    lit = mix(lit, 1.0, 0.8);
  }
  if (ground && !cap) {
    // Out-of-bounds ground is the dunes' sand, painted the same way; long
    // shadows across it would read as holes, so they stay light.
    col = sandColor(vSrc, lit, uSand, uSandShade);
    float sandHaze = smoothstep(uHazeRange.x, uHazeRange.y, length(vSrc.xy - uMapCentre.xy));
    gl_FragColor = linearToOutputTexel(vec4(mix(col, uHaze, sandHaze * 0.85), uAlpha * opacityOut(opacity)));
    return;
  }
  vec3 shade = mix(uShadow, vec3(1.0), lit);

  // Occlusion: flat surfaces read the baked top-down AO when the bake saw
  // them; walls darken toward their foot.
  float ao = 1.0;
  if (isFlat && !cap) {
    vec2 tuv = (vSrc.xy - uTopGrid.xy) * uTopGrid.zw;
    float seen = unpackHeight(texture2D(uHeightMap, tuv));
    // Something above this point in the bake means it is under an overhang.
    float covered = smoothstep(8.0, 28.0, seen - vSrc.z - zPerPx * 2.0);
    ao = mix(texture2D(uAoMap, tuv).r, walkable ? 0.78 : 0.94, covered);
    // The bake (made with the 2D cut) did not see this surface: no corners.
    ao = mix(ao, 0.96, smoothstep(8.0, 28.0, vSrc.z - seen - zPerPx * 2.0));
  } else if (!cap && !isFlat && !foliage && !floorless && prop == 0) {
    if (vH < 30000.0) {
      ao = mix(0.6, 1.0, smoothstep(0.0, 64.0, vH));
      // Walls catch more bounce light toward their top.
      col *= mix(0.9, 1.06, smoothstep(40.0, 320.0, vH));
    }
#ifdef DETAIL
    // Stone courses in running bond, faded out before they alias.
    vec2 t = normalize(vec2(-n.y, n.x) + 1e-5);
    vec2 w = vec2(dot(vSrc.xy, t) / 56.0, vSrc.z / 28.0);
    w.x += 0.5 * floor(w.y);
    vec2 fw = max(fwidth(w), vec2(1e-4));
    vec2 d = (0.5 - abs(fract(w) - 0.5)) / fw;
    float seam = 1.0 - smoothstep(0.0, 1.0, min(d.x, d.y));
    float near = 1.0 - smoothstep(0.08, 0.22, max(fw.x, fw.y));
    float block = hash11(dot(floor(w), vec2(1.0, 113.0)) + 7.0);
    col *= 1.0 - near * (seam * 0.08 + (block - 0.5) * 0.045);
#endif
  }
  ao = mix(ao, 1.0, levelLift * 0.8);
  col *= shade * mix(uOcclusion, vec3(1.0), ao * sqrt(ao));
  // Scenery far from anywhere a player goes (hills, buildings nobody
  // reaches) recedes into the table, so the playable map is what stands out.
  col = mix(col, uSand * mix(0.8, 1.15, lit), vRemote * 0.6);
  // Tops nobody can walk on, hatched where the palette asks: roofs that
  // would otherwise read as more floor. Fades out before it would alias.
  if (
    uNoAccess > 0.5 && isFlat && !walkable && !cap && !foliage && !ground &&
    prop == 0 && decal == 0.0
  ) {
    float s = (vSrc.x + vSrc.y) / 40.0;
    float fw = max(fwidth(s), 1e-4);
    float px = min(fract(s), 1.0 - fract(s)) / fw;
    float hatch = 1.0 - smoothstep(0.5, 1.3, px);
    col *= 1.0 - hatch * (1.0 - smoothstep(0.12, 0.3, fw)) * 0.16;
  }

  // Outlines on creases and open edges, a pixel or so wide at any zoom.
  int edges = (info >> 4) & 7;
  float line = 1.0;
  vec3 e = smoothstep(bw * (uLineWidth - 0.5), bw * (uLineWidth + 0.5), vBary);
  if ((edges & 1) != 0) line = min(line, e.x);
  if ((edges & 2) != 0) line = min(line, e.y);
  if ((edges & 4) != 0) line = min(line, e.z);
  if (wallSliced(info) && !isFlat) {
    float d = (cut - vSrc.z) / max(fwidth(vSrc.z), 1e-4);
    line = min(line, smoothstep(uLineWidth - 0.5, uLineWidth + 0.5, d));
  }
#ifdef LEVEL_COPY
  if (!isFlat) {
    float d = (uCopyZ.y - vSrc.z) / max(fwidth(vSrc.z), 1e-4);
    line = min(line, smoothstep(uLineWidth - 0.5, uLineWidth + 0.5, d));
  }
#endif
  line = mix(line, 1.0, decal * 0.85);
  // Thinner ink when zoomed out, where every prop edge would turn to noise.
  float unitsPerPx = max(length(dx), length(dy));
  float ink = mix(0.8, 0.42, smoothstep(1.5, 7.0, unitsPerPx));
  col = mix(uOutline, col, mix(1.0, line, ink));

  float haze = smoothstep(uHazeRange.x, uHazeRange.y, length(vSrc.xy - uMapCentre.xy));
  col = mix(col, uHaze, haze * 0.85);

#ifdef GHOST
  // A ghost is a pale echo of the building, its ink kept faint.
  if (!foliage) col = mix(col, uTop, 0.25);
#endif
  gl_FragColor = linearToOutputTexel(vec4(col, uAlpha * opacityOut(opacity)));
}
`;

/** Depth only, with the same cut, for the sun's shadow map. */
export const DEPTH_FRAG = /* glsl */ `
${CUT_GLSL}
varying vec3 vSrc;
flat varying float vInfo;
void main() {
  int info = int(vInfo + 0.5);
  if ((info & 3) != 1 && cutBy(info, vSrc.z, uCut2D)) discard;
  gl_FragColor = vec4(1.0);
}
`;

/** Top-down height of what is visible from above, packed into RG. */
export const HEIGHT_FRAG = /* glsl */ `
${CUT_GLSL}
uniform vec2 uZRange;
varying vec3 vSrc;
flat varying float vInfo;
void main() {
  int info = int(vInfo + 0.5);
  // Canopies stay out (the ground under a tree gets its occlusion, the tree
  // its shadow), and so do cables, which alias into dotted lines.
  if ((info & 3) == 1 || (info & 256) != 0 || cutBy(info, vSrc.z, uCut2D)) discard;
  float v = clamp((vSrc.z - uZRange.x) / uZRange.y, 0.0, 1.0) * 65535.0;
  float hi = floor(v / 256.0);
  gl_FragColor = vec4(hi / 255.0, (v - hi * 256.0) / 255.0, 0.0, 1.0);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Horizon-based occlusion over the top-down height map: for each texel, how
 * much of the sky the neighbourhood hides, within `uRadius` source units.
 */
export const AO_FRAG = /* glsl */ `
uniform highp sampler2D uHeightMap;
uniform vec2 uZRange;
uniform vec2 uTexel;
uniform float uUnitsPerTexel;
uniform float uRadius;
varying vec2 vUv;

float heightAt(vec2 uv) {
  vec4 t = texture2D(uHeightMap, uv);
  return uZRange.x + (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0 * uZRange.y;
}

void main() {
  float h0 = heightAt(vUv);
  if (h0 <= uZRange.x + 1.0) {
    gl_FragColor = vec4(1.0);
    return;
  }
  const int DIRS = 12;
  const int STEPS = 7;
  // A per-texel turn of the ray fan, so a small object nearby shades a soft
  // patch (after the blur) instead of a starburst of ray marks.
  float turn = fract(sin(dot(floor(vUv / uTexel), vec2(12.9898, 78.233))) * 43758.5453);
  float occlusion = 0.0;
  for (int d = 0; d < DIRS; d++) {
    float a = (float(d) + turn) * 6.2831853 / float(DIRS);
    vec2 dir = vec2(cos(a), sin(a));
    float best = 0.0;
    for (int s = 0; s < STEPS; s++) {
      float t = (float(s) + 1.0) / float(STEPS);
      float r = uUnitsPerTexel * 0.75 + uRadius * t * t;
      // Rises under a kerb's height are ribs, tiles and bumpy ground.
      float dh = heightAt(vUv + dir * (r / uUnitsPerTexel) * uTexel) - h0 - 14.0;
      if (dh > 0.0) {
        // Low horizons are gentle slopes, not corners.
        float sinH = dh / sqrt(dh * dh + r * r);
        best = max(best, max(sinH - 0.3, 0.0) / 0.7 * (1.0 - t * t * 0.7));
      }
    }
    occlusion += best;
  }
  float ao = clamp(1.0 - 1.35 * occlusion / float(DIRS), 0.0, 1.0);
  gl_FragColor = vec4(ao * ao, 0.0, 0.0, 1.0);
}
`;

/** A 9-tap separable blur over the occlusion. */
export const AO_BLUR_FRAG = /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  float sum = texture2D(uSource, vUv).r * 0.227;
  sum += (texture2D(uSource, vUv + uStep * 1.385).r + texture2D(uSource, vUv - uStep * 1.385).r) * 0.316;
  sum += (texture2D(uSource, vUv + uStep * 3.231).r + texture2D(uSource, vUv - uStep * 3.231).r) * 0.07;
  gl_FragColor = vec4(sum, 0.0, 0.0, 1.0);
}
`;
