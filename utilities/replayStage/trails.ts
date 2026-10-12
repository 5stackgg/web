import * as THREE from "three";
import { pxScale } from "./fx";
import { TEAM_BASE } from "./teamColors";
import type { StageContext, StageModule, StageTrails } from "./types";

/**
 * Where everyone walked this round, as ribbons flat on the floor in team
 * colours, the latest stretch brightest and the rest fading as it ages. The
 * round's walks are built into one mesh once; each frame only moves `now`,
 * and the shader cuts every ribbon where its player stands, so a trail ends
 * under the puck between samples too. One draw call.
 */

/** World width, and the narrowest it gets on screen when zoomed out. */
const WIDTH = 9;
const MIN_PX = 3.6;
/** Seconds for a stretch to fade most of the way to `OLD`. */
const FADE_SECS = 9;
const OLD = 0.35;

const VERT = /* glsl */ `
attribute vec2 aDir;
attribute float aSide;
attribute float aTime;
attribute vec2 aInfo;
uniform float uNow;
uniform float uFocus;
uniform float uPxScale;
varying float vAge;
varying float vSide;
varying float vTeam;
varying float vFocus;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float focus = 1.0 - step(0.5, abs(aInfo.y - uFocus));
  float width = max(${WIDTH.toFixed(1)}, ${MIN_PX.toFixed(2)} * -mv.z * uPxScale) * (1.0 + 0.7 * focus);
  vec3 side = vec3(-aDir.y, 0.0, aDir.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + side * aSide * width * 0.5, 1.0);
  vAge = uNow - aTime;
  vSide = aSide;
  vTeam = aInfo.x;
  vFocus = focus;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uCt;
uniform vec3 uT;
uniform float uDim;
uniform float uTail;
varying float vAge;
varying float vSide;
varying float vTeam;
varying float vFocus;
void main() {
  if (vAge < 0.0) discard;
  float recent = exp(-vAge / ${FADE_SECS.toFixed(1)});
  float alpha = mix(${OLD.toFixed(2)}, 0.9, recent) * mix(uDim, 1.0, vFocus);
  // A tail, when asked for one, runs out instead of fading to a floor.
  if (uTail > 0.0) alpha = 0.9 * (1.0 - smoothstep(uTail * 0.35, uTail, vAge));
  vec3 team = mix(uCt, uT, vTeam);
  float edge = abs(vSide);
  // A dark rim, so the line reads on sand and on shadow alike.
  vec3 col = mix(team * 0.18, mix(team, vec3(1.0), 0.18 * recent), 1.0 - smoothstep(0.5, 0.7, edge));
  alpha *= 1.0 - smoothstep(0.8, 1.0, edge);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

export function createTrailsModule(): StageModule {
  let mesh: THREE.Mesh | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let built: StageTrails | null = null;
  /** Player id → its index in the built mesh, for the focus. */
  let players = new Map<string, number>();

  const spot = { x: 0, y: 0, z: 0 };
  const at = new THREE.Vector3();
  let builtShift: StageContext["levelShift"] = null;

  function build(trails: StageTrails, ctx: StageContext) {
    builtShift = ctx.levelShift ?? null;
    const geometry = mesh!.geometry;
    geometry.dispose();
    const next = new THREE.BufferGeometry();
    players = new Map();
    let total = 0;
    for (const strip of trails.strips) {
      total += strip.count;
    }
    const position = new Float32Array(total * 2 * 3);
    const dir = new Float32Array(total * 2 * 2);
    const side = new Float32Array(total * 2);
    const time = new Float32Array(total * 2);
    const info = new Float32Array(total * 2 * 2);
    const quads = total - trails.strips.length;
    const index =
      total * 2 > 65535
        ? new Uint32Array(Math.max(0, quads) * 6)
        : new Uint16Array(Math.max(0, quads) * 6);
    const p = trails.points;
    let v = 0;
    let n = 0;
    for (const strip of trails.strips) {
      let player = players.get(strip.id);
      if (player === undefined) {
        player = players.size;
        players.set(strip.id, player);
      }
      const team = strip.team === "t" ? 1 : 0;
      for (let i = 0; i < strip.count; i++) {
        const k = strip.start + i;
        const a = Math.max(strip.start, k - 1) * 4;
        const b = Math.min(strip.start + strip.count - 1, k + 1) * 4;
        // Along the walk on the floor, world xz (x east, z south).
        let dx = p[b] - p[a];
        let dz = -(p[b + 1] - p[a + 1]);
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        for (let s = -1; s <= 1; s += 2) {
          // Through `wpos`, so a walk on a lower storey laid side by side
          // is drawn on its copy.
          spot.x = p[k * 4];
          spot.y = p[k * 4 + 1];
          spot.z = p[k * 4 + 2];
          ctx.wpos(spot, at);
          position[v * 3] = at.x;
          position[v * 3 + 1] = at.y;
          position[v * 3 + 2] = at.z;
          dir[v * 2] = dx;
          dir[v * 2 + 1] = dz;
          side[v] = s;
          time[v] = p[k * 4 + 3];
          info[v * 2] = team;
          info[v * 2 + 1] = player;
          v++;
        }
        // A walk down to a storey laid beside the map breaks there, rather
        // than drawing a line across to its copy.
        const shift = ctx.levelShift;
        const crosses =
          !!shift &&
          i > 0 &&
          p[k * 4 + 2] < shift.below !== p[(k - 1) * 4 + 2] < shift.below;
        if (i > 0 && !crosses) {
          const o = v - 4;
          index[n++] = o;
          index[n++] = o + 1;
          index[n++] = o + 2;
          index[n++] = o + 1;
          index[n++] = o + 3;
          index[n++] = o + 2;
        }
      }
    }
    next.setAttribute("position", new THREE.BufferAttribute(position, 3));
    next.setAttribute("aDir", new THREE.BufferAttribute(dir, 2));
    next.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    next.setAttribute("aTime", new THREE.BufferAttribute(time, 1));
    next.setAttribute("aInfo", new THREE.BufferAttribute(info, 2));
    next.setIndex(new THREE.BufferAttribute(index, 1));
    // Breaks between storeys leave the tail of the index unused.
    next.setDrawRange(0, n);
    mesh!.geometry = next;
    built = trails;
  }

  return {
    name: "trails",
    init(ctx) {
      material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uNow: { value: 0 },
          uFocus: { value: -1 },
          uDim: { value: 1 },
          uTail: { value: 0 },
          uPxScale: { value: 0.001 },
          uCt: { value: new THREE.Color(TEAM_BASE.ct) },
          uT: { value: new THREE.Color(TEAM_BASE.t) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      });
      mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      mesh.visible = false;
      ctx.scene.add(mesh);
    },
    update(frame, ctx) {
      const trails = frame.trails ?? null;
      if (!trails || !trails.strips.length) {
        mesh!.visible = false;
        return;
      }
      if (trails !== built || (ctx.levelShift ?? null) !== builtShift) {
        build(trails, ctx);
      }
      let focus = -1;
      for (const player of frame.players) {
        if (player.selected) {
          focus = players.get(player.id) ?? -1;
        }
      }
      const u = material!.uniforms;
      u.uNow.value = frame.time;
      u.uFocus.value = focus;
      u.uDim.value = focus >= 0 ? 0.5 : 1;
      u.uTail.value = trails.tail ?? 0;
      u.uPxScale.value = pxScale(ctx);
      // From straight above it is a radar: walks under a roof still show.
      material!.depthTest = ctx.view === "3d";
      mesh!.visible = true;
    },
    dispose() {
      mesh?.removeFromParent();
      mesh?.geometry.dispose();
      material?.dispose();
      mesh = null;
      material = null;
      built = null;
    },
  };
}
