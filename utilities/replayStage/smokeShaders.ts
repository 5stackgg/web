/**
 * GLSL for the smoke volumes. The march runs in source space (x east, y
 * north, z up): world is (x, z, -y), so getting there is a swizzle.
 */

export const SMOKE_MAX_BLASTS = 5;
/** Source units a puff may swell past the baked surface. */
export const SMOKE_BIAS = 30;
/** Grids one march merges, so overlapping smokes read as one cloud. */
export const SMOKE_MEMBERS = 4;

const MEMBERS = Array.from({ length: SMOKE_MEMBERS }, (_, i) => i);

export const MARCH_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * One cluster of overlapping smokes. Marches the camera ray through their
 * baked grids (surface distance, arrival, sky light, openness) taking the union of
 * their shapes, stops at the map's depth so walls in front hide the cloud,
 * carves a lumpy surface out of it with tiled noise, and shades it from the
 * key light. Writes premultiplied colour into the half-resolution target.
 */
export const MARCH_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

${MEMBERS.map((i) => `uniform sampler3D uGrid${i};`).join("\n")}
uniform int uCount;
uniform vec3 uGridMin[${SMOKE_MEMBERS}];
uniform vec3 uGridInv[${SMOKE_MEMBERS}];
uniform vec3 uTint[${SMOKE_MEMBERS}];
// Share of each smoke's reach its front has got to, and that reach in
// source units.
uniform vec4 uFront;
uniform vec4 uReach;
uniform vec4 uFade;
uniform vec4 uErode;
// Source units the R channel spans, per grid.
uniform vec4 uSpan;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform sampler3D uNoise;
// GLSL ES 3 samplers default to lowp: phones would read fp16 depth and let
// the cloud show through walls.
uniform highp sampler2D uDepth;
uniform vec2 uResolution;
uniform mat4 uInvProj;
uniform float uShadeLo;
uniform float uShadeHi;
uniform float uRimLight;
uniform float uDensity;
uniform float uNoiseScale;
uniform vec3 uDrift;
uniform vec3 uLightDir;
uniform vec3 uLit;
uniform vec3 uMid;
uniform vec3 uShade;
uniform vec4 uBlast[${SMOKE_MAX_BLASTS}];
uniform float uBlastK[${SMOKE_MAX_BLASTS}];
uniform int uBlastCount;
// The cloud is drawn shifted by this (source units): a lower storey laid
// beside the map. The march runs where the smoke really is.
uniform vec3 uShift;

varying vec3 vWorld;

vec3 toSource(vec3 w) {
  return vec3(w.x, -w.z, w.y);
}

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// CS2's HE hole: a 200u core, feathered to 240u, filling back in as the
// blast ages (strength precomputed per blast). Given as distance to the
// holes' surface, so a hole shrinks as it refills and the noise carves its
// walls like any other edge of the cloud.
float holes(vec3 p) {
  float hole = 1e4;
  for (int i = 0; i < ${SMOKE_MAX_BLASTS}; i++) {
    if (i >= uBlastCount) break;
    float s = uBlast[i].w / 250.0;
    hole = min(hole, distance(p, uBlast[i].xyz) - 214.0 * s * uBlastK[i]);
  }
  return hole;
}

// How far smoke may billow past the grid's surface, how deep the billows
// carve at full erosion, and the depth over which density reaches full, in
// source units. Balanced so a settled cloud turns opaque on the faces of the
// voxels it fills: measured against the game's own render of a recorded
// smoke, whose outline is those faces, a cloud carved deeper than it swells
// drew half the size.
const float BIAS = ${SMOKE_BIAS.toFixed(1)};
const float CARVE = 70.0;
const float SOFT = 18.0;

// The grids carry signed distance to the cloud's surface (R), so the cloud
// is a shell of a known depth that the noise carves into puffs: a puff
// where a noise cell sits, a crease between cells. Overlapping smokes take
// the union, so they merge into one wall.
float density(vec3 p, out vec4 g, out vec3 tint) {
  vec4 sd = vec4(-1e4);
  float top = -1e4;
  g = vec4(0.0, 0.0, 1.0, 1.0);
  tint = uTint[0];
${MEMBERS.map(
  (i) => `  if (uCount > ${i}) {
    vec3 uvw = (p - uGridMin[${i}]) * uGridInv[${i}];
    if (all(greaterThanEqual(uvw, vec3(0.0))) && all(lessThanEqual(uvw, vec3(1.0)))) {
      vec4 s = texture(uGrid${i}, uvw);
      // How far ahead of the growing front this is: a distance, so the
      // noise carves the front like any other edge as it rolls out.
      float ahead = max(0.0, s.g * 1.004 - uFront[${i}]) * uReach[${i}];
      // The box's faces are a surface too, so a cloud that fills its box
      // fades out before them rather than being sliced off.
      vec3 edge = min(uvw, 1.0 - uvw) / uGridInv[${i}];
      float d = min(
        (s.r - 0.5) * uSpan[${i}] - ahead,
        min(edge.x, min(edge.y, edge.z)) - BIAS - 2.0
      );
      sd[${i}] = d;
      if (d > top) {
        top = d;
        g = s;
        tint = uTint[${i}];
      }
    }
  }`,
).join("\n")}
  if (top < -BIAS) return 0.0;
  if (uBlastCount > 0) sd = min(sd, vec4(holes(p)));
  vec2 n = texture(uNoise, p * uNoiseScale + uDrift).rg;
  vec4 shape = clamp((sd + BIAS - (1.0 - n.r) * CARVE * uErode) / SOFT, 0.0, 1.0);
  // The body stays whole; its fringe thins out in fine wisps.
  shape *= mix(vec4(n.g), vec4(1.0), shape) * uFade;
  // The creases between puffs sit in their neighbours' shade; the puffs
  // themselves stand out into the light.
  tint *= mix(0.9, 1.1, n.r);
  return max(max(shape.x, shape.y), max(shape.z, shape.w));
}

vec2 hitBox(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / rd;
  vec3 a = (uBoxMin - ro) * inv;
  vec3 b = (uBoxMax - ro) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  return vec2(max(max(lo.x, lo.y), lo.z), min(min(hi.x, hi.y), hi.z));
}

void main() {
  vec3 rd = normalize(toSource(vWorld) - toSource(cameraPosition));
  vec3 ro = toSource(cameraPosition) - uShift;
  vec2 span = hitBox(ro, rd);
  span.x = max(span.x, 0.0);

  // The map's depth along this pixel: walls in front cut the cloud.
  vec2 suv = gl_FragCoord.xy / uResolution;
  float z = texture2D(uDepth, suv).x;
  if (z < 1.0) {
    vec4 view = uInvProj * vec4(suv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
    span.y = min(span.y, length(view.xyz / view.w));
  }
  float len = span.y - span.x;
  if (len <= 0.0) discard;

  int steps = int(clamp(ceil(len / MIN_STEP), 4.0, float(MAX_STEPS)));
  float dt = len / float(steps);
  float t = span.x + dt * ign(gl_FragCoord.xy);
  float transmit = 1.0;
  vec3 col = vec3(0.0);
  vec3 surface = vec3(0.0);
  bool found = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= steps || transmit < 0.01) break;
    vec3 p = ro + rd * t;
    vec4 g;
    vec3 tint;
    float d = density(p, g, tint);
    if (d > 0.002) {
      float sky = g.b;
      float sun = sky;
#ifdef LIGHT_SAMPLES
      vec4 g1;
      vec3 t1;
      float l1 = density(p + uLightDir * 16.0, g1, t1);
      float l2 = density(p + uLightDir * 44.0, g1, t1);
      sun = exp(-(l1 * 16.0 + l2 * 28.0) * uDensity * 0.45) * mix(0.6, 1.0, sky);
#endif
      sun = clamp(sun, 0.0, 1.0);
      vec3 c = sun < 0.5 ? mix(uShade, uMid, sun * 2.0) : mix(uMid, uLit, sun * 2.0 - 1.0);
      // Buried, enclosed parts get less of the sky; open wisps get more.
      c *= mix(0.78, 1.0, sky) * (0.9 + 0.2 * g.a) * tint;
      float a = 1.0 - exp(-d * uDensity * dt);
      col += transmit * a * c;
      float before = transmit;
      transmit *= 1.0 - a;
      if (!found && transmit < 0.7) {
        found = true;
        // Where in this step the opacity crossed, not the step itself:
        // snapping draws contour rings on a face seen head-on.
        surface = p - rd * dt * (1.0 - (before - 0.7) / (before - transmit));
      }
    }
    t += dt;
  }
  float alpha = 1.0 - transmit;
  if (alpha < 0.003) discard;
  if (found) {
    // Shade the billows like a surface: the density gradient where the
    // cloud turns opaque is its normal, lit by the key light, with a bright
    // rim on the lit side. This is what makes the lumps read from above.
    vec4 g;
    vec3 tint;
    float h = 12.0;
    float c0 = density(surface, g, tint);
    vec3 grad = vec3(
      density(surface + vec3(h, 0.0, 0.0), g, tint) - c0,
      density(surface + vec3(0.0, h, 0.0), g, tint) - c0,
      density(surface + vec3(0.0, 0.0, h), g, tint) - c0
    );
    float len2 = dot(grad, grad);
    vec3 n = len2 > 1e-6 ? -grad * inversesqrt(len2) : -rd;
    float lambert = dot(n, uLightDir) * 0.5 + 0.5;
    float facing = 1.0 - abs(dot(n, rd));
    float rim = facing * facing * smoothstep(0.35, 1.0, lambert);
    col *= mix(uShadeLo, uShadeHi, lambert);
    col += alpha * uLit * rim * uRimLight;
  }
  gl_FragColor = vec4(col, alpha);
}
`;

export const COMPOSITE_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Lays the half-resolution smoke over the frame. In 2D, where the cloud is
 * seen only from above, it also gives the footprint a body: a soft shadow on
 * the ground away from the sun, a pillowy darkening toward the edge, and a
 * thin ink line along the outline so the shape reads crisply.
 */
export const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uSmoke;
uniform vec4 uViewport;
uniform float uMaxAlpha;
uniform float uFlat;
uniform float uStroke;
uniform vec2 uShadowOffset;
uniform vec3 uRimColor;
uniform vec3 uShadowColor;

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
  vec4 s = texture2D(uSmoke, uv);
  float a = s.a;
  if (uFlat == 0.0 && a < 0.002) discard;
  vec3 color = s.rgb / max(a, 1e-4);
  float alpha = a * uMaxAlpha;
  if (uFlat > 0.0) {
    vec2 px = 1.0 / uViewport.zw;
    vec2 o = uv - uShadowOffset;
    float shade = 0.0;
    shade += texture2D(uSmoke, o + vec2(px.x, px.y) * 3.0).a;
    shade += texture2D(uSmoke, o + vec2(-px.x, px.y) * 3.0).a;
    shade += texture2D(uSmoke, o + vec2(px.x, -px.y) * 3.0).a;
    shade += texture2D(uSmoke, o - vec2(px.x, px.y) * 3.0).a;
    shade = smoothstep(0.0, 0.6, shade * 0.25) * 0.5;
    if (a < 0.002 && shade < 0.002) discard;

    // From straight above the cloud sits on warm roofs of nearly its own
    // value, so the footprint is drawn solid with a hard edge, an ink line
    // a constant width on screen however far out the view is, and its
    // shadow on the ground.
    alpha = smoothstep(0.1, 0.35, a) * uMaxAlpha;
    float d = uStroke;
    float gx = texture2D(uSmoke, uv + vec2(px.x * d, 0.0)).a - texture2D(uSmoke, uv - vec2(px.x * d, 0.0)).a;
    float gy = texture2D(uSmoke, uv + vec2(0.0, px.y * d)).a - texture2D(uSmoke, uv - vec2(0.0, px.y * d)).a;
    float grad = length(vec2(gx, gy)) / (2.0 * d);
    float rim = (1.0 - smoothstep(0.5, 1.0, abs(a - 0.11) / max(grad * d, 1e-4))) * step(0.004, grad);

    // Pillow: darker toward the edge, from how deep inside the footprint
    // this pixel is.
    float ring = 0.0;
    for (int i = 0; i < 6; i++) {
      float t = float(i) * 1.0472 + 0.5;
      ring += texture2D(uSmoke, uv + vec2(cos(t), sin(t)) * px * d * 4.0).a;
    }
    color *= mix(0.84, 1.0, smoothstep(0.4, 1.0, ring / 6.0));
    // A touch whiter and less yellow than the roofs it lies against.
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, vec3(luma), 0.35) * 1.06;
    color = mix(color, uRimColor, rim);
    alpha = max(alpha, rim * 0.9);

    float under = shade * (1.0 - alpha);
    color = (color * alpha + uShadowColor * under) / max(alpha + under, 1e-4);
    alpha += under;
  }
  if (alpha < 0.002) discard;
  color += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
