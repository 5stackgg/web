/**
 * The stage's pointer. The native cursor set cannot say pan, orbit, tilt or
 * "this player", so it is hidden over the canvas and a reticle drawn instead:
 * one SVG whose state is a `data-mode` attribute, letting CSS own every
 * transition. While orbiting, the arc arrows turn to the heading of the drag
 * and a sweep trails them by speed, both off a per-frame smoothed velocity
 * (raw deltas jitter). A bracket frames the portrait of the player under the
 * pointer. Touch-first devices keep their own pointer: there is nothing to
 * replace, and hiding it would strand them.
 */

export type CursorMode = "idle" | "pan" | "orbit" | "tilt" | "player";

export type StageCursor = {
  /** The steady state; a zoom flashes over it. */
  set(mode: CursorMode): void;
  /** Shows ZOOM briefly; call again to keep it up. */
  zoom(inward: boolean): void;
  /** Follow is on: idle shows it. */
  following(on: boolean): void;
  /** A press is down on the hovered player. */
  pressed(on: boolean): void;
  /** Pointer position, client coordinates. */
  move(clientX: number, clientY: number): void;
  /** Motion that is not the pointer's (keys), px per frame, steering the arrows. */
  steer(dx: number, dy: number): void;
  /** Frames a player: centre and radius in canvas CSS px. */
  target(x: number, y: number, r: number): void;
  untarget(): void;
  show(on: boolean): void;
  /** Off gives the native cursor back (camera input is off). */
  enable(on: boolean): void;
  destroy(): void;
};

const LABELS: Record<CursorMode, string> = {
  idle: "",
  pan: "PAN",
  orbit: "ORBIT",
  tilt: "TILT",
  player: "SELECT",
};

const SIZE = 56;
const C = SIZE / 2;
const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R;
const ARROW_SPAN = 64;
const ZOOM_FLASH = 420;

const CSS = `
.rs-cur-layer { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.rs-cur, .rs-cur-target {
  --acc: hsl(var(--tac-amber, 33 94% 58%));
  position:absolute; left:0; top:0; will-change:transform;
}
.rs-cur { width:${SIZE}px; height:${SIZE}px; margin:-${C}px 0 0 -${C}px; opacity:0; transition:opacity 120ms linear; }
.rs-cur[data-on="1"] { opacity:1; }
.rs-cur svg, .rs-cur-target svg {
  display:block; overflow:visible;
  filter:drop-shadow(0 0 0.75px rgba(0,0,0,0.95)) drop-shadow(0 0 2px rgba(0,0,0,0.45));
}
.rs-cur path, .rs-cur .ring, .rs-cur .sweep, .rs-cur-target path {
  fill:none; stroke-linecap:square; stroke-linejoin:miter; vector-effect:non-scaling-stroke;
}

.rs-cur .g { opacity:0; transform:scale(0.8); transform-origin:${C}px ${C}px; transition:opacity 140ms ease, transform 180ms cubic-bezier(0.22,1,0.36,1); }
.rs-cur .dot { fill:#fff; transition:opacity 120ms ease; }
.rs-cur .ring {
  stroke:#fff; stroke-width:1.25; opacity:0.8; transform-origin:${C}px ${C}px;
  transition:opacity 140ms ease, stroke 140ms ease, transform 200ms cubic-bezier(0.22,1,0.36,1);
}
.rs-cur .head { transform-origin:${C}px ${C}px; }
.rs-cur .orbit { stroke:#fff; stroke-width:1.4; opacity:0; transition:opacity 140ms ease; }
.rs-cur .sweep {
  stroke:var(--acc); stroke-width:1.75; opacity:0;
  stroke-dasharray:var(--sweep, 0px) ${RING_C.toFixed(2)}px; stroke-dashoffset:var(--sweep, 0px);
}
.rs-cur .acc { stroke:var(--acc); stroke-width:1.5; }
.rs-cur .line { stroke:#fff; stroke-width:1.25; }
.rs-cur .tilt .up, .rs-cur .tilt .down { opacity:0.6; transition:opacity 120ms ease; }
.rs-cur[data-tilt="up"] .tilt .up, .rs-cur[data-tilt="down"] .tilt .down { opacity:1; }
.rs-cur .label {
  fill:var(--acc); font:600 8px Oxanium, ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing:0.08em; text-anchor:middle; opacity:0; transition:opacity 140ms ease;
}

.rs-cur[data-mode="orbit"] .orbit { opacity:1; }
.rs-cur[data-mode="orbit"] .sweep { opacity:0.95; }
.rs-cur[data-mode="orbit"] .ring { opacity:0.3; }
.rs-cur[data-mode="pan"] .pan,
.rs-cur[data-mode="tilt"] .tilt,
.rs-cur[data-mode="zoom"][data-zoom="in"] .zin,
.rs-cur[data-mode="zoom"][data-zoom="out"] .zout { opacity:1; transform:none; }
.rs-cur[data-mode="pan"] .ring { opacity:0.35; transform:scale(0.6); }
.rs-cur[data-mode="tilt"] .ring { opacity:0.3; }
.rs-cur[data-mode="zoom"] .ring { opacity:0.85; transform:scale(1.08); }
.rs-cur[data-mode="tilt"] .dot, .rs-cur[data-mode="zoom"] .dot { opacity:0; }
/* Over a player the frame on their portrait does the talking; the reticle
   shrinks to a hotspot. */
.rs-cur[data-mode="player"] .ring { stroke:var(--acc); opacity:1; transform:scale(0.4); }
.rs-cur[data-mode="player"] .label { opacity:0 !important; }
.rs-cur[data-mode="idle"][data-follow="1"] .ring { stroke:var(--acc); opacity:0.9; }
.rs-cur[data-label="1"] .label { opacity:0.95; }
.rs-cur[data-mode="idle"][data-label="1"] .label { opacity:0.75; }

.rs-cur-target svg { stroke:var(--acc); opacity:0; transform:scale(1.3); transition:opacity 120ms ease, transform 180ms cubic-bezier(0.22,1,0.36,1); }
.rs-cur-target path { stroke:var(--acc); stroke-width:1.75; }
.rs-cur-target[data-on="1"] svg { opacity:1; transform:none; }
.rs-cur-target[data-on="1"][data-press="1"] svg { transform:scale(0.9); }
.rs-cur-target .tag {
  position:absolute; left:50%; bottom:100%; margin-bottom:3px; transform:translateX(-50%);
  font:600 8px/1 Oxanium, ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:0.08em;
  color:var(--acc); text-shadow:0 0 1px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.5);
  white-space:nowrap; opacity:0; transition:opacity 120ms ease;
}
.rs-cur-target[data-on="1"] .tag { opacity:0.95; }

@media (prefers-reduced-motion: reduce) {
  .rs-cur .g, .rs-cur .ring, .rs-cur-target svg, .rs-cur-target .tag { transition-duration:1ms; }
  .rs-cur .sweep { opacity:0 !important; }
}
`;

/** A point `r` out from the centre at `deg`, clockwise from up. */
function pt(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return `${(C + Math.sin(a) * r).toFixed(2)},${(C - Math.cos(a) * r).toFixed(2)}`;
}

/** Clockwise arc-arrow on the ring centred on `mid`, head at the leading end. */
function arcArrow(mid: number, span: number) {
  const a = mid - span / 2;
  const b = mid + span / 2;
  const back = (4.5 / RING_R) * (180 / Math.PI);
  return (
    `<path d="M${pt(a, RING_R)} A${RING_R},${RING_R} 0 0 1 ${pt(b, RING_R)}"/>` +
    `<path d="M${pt(b - back, RING_R - 3.5)} L${pt(b, RING_R)} L${pt(b - back, RING_R + 3.5)}"/>`
  );
}

/** Chevron with its tip `r` out at `deg`, pointing outward. */
function chevron(deg: number, r: number, cls = "") {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const p = (along: number, side: number) =>
    `${(C + dx * along - dy * side).toFixed(2)},${(C + dy * along + dx * side).toFixed(2)}`;
  return `<path class="${cls}" d="M${p(r - 3.5, -3.5)} L${p(r, 0)} L${p(r - 3.5, 3.5)}"/>`;
}

/** A short arrow along `deg` from radius `from` to `to`, head at `to`. */
function ray(deg: number, from: number, to: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const p = (along: number, side: number) =>
    `${(C + dx * along - dy * side).toFixed(2)},${(C + dy * along + dx * side).toFixed(2)}`;
  const back = to > from ? to - 3 : to + 3;
  return `<path d="M${p(from, 0)} L${p(to, 0)} M${p(back, -3)} L${p(to, 0)} L${p(back, 3)}"/>`;
}

/**
 * The sweep trails an arrow: a dash offset by its own length ends where the
 * circle starts, so each circle is turned to start at its arrow's tail.
 */
function sweep(tail: number) {
  return `<circle class="sweep" cx="${C}" cy="${C}" r="${RING_R}" transform="rotate(${tail - 90} ${C} ${C})"/>`;
}

const DIAGONALS = [45, 135, 225, 315];

const SVG = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">
  <circle class="ring" cx="${C}" cy="${C}" r="${RING_R}"/>
  <g class="head">
    ${sweep(-ARROW_SPAN / 2)}${sweep(180 - ARROW_SPAN / 2)}
    <g class="orbit">${arcArrow(0, ARROW_SPAN)}${arcArrow(180, ARROW_SPAN)}</g>
  </g>
  <g class="g pan acc">${[0, 90, 180, 270].map((d) => chevron(d, 19)).join("")}</g>
  <g class="g tilt">
    <path class="line" d="M${C - 7} ${C}h14"/>
    <g class="acc">${chevron(0, 18, "up")}${chevron(180, 18, "down")}</g>
  </g>
  <g class="g zin">
    <path class="line" d="M${C - 4} ${C}h8M${C} ${C - 4}v8"/>
    <g class="acc">${DIAGONALS.map((d) => ray(d, 14, 20)).join("")}</g>
  </g>
  <g class="g zout">
    <path class="line" d="M${C - 4} ${C}h8"/>
    <g class="acc">${DIAGONALS.map((d) => ray(d, 21, 15)).join("")}</g>
  </g>
  <circle class="dot" cx="${C}" cy="${C}" r="1.5"/>
  <text class="label" x="${C}" y="${C + 31}"></text>
</svg>`;

let styleRefs = 0;
let styleEl: HTMLStyleElement | null = null;

function acquireStyle() {
  if (styleRefs++ === 0) {
    styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }
}

function releaseStyle() {
  if (--styleRefs === 0) {
    styleEl?.remove();
    styleEl = null;
  }
}

const NOOP: StageCursor = {
  set() {},
  zoom() {},
  following() {},
  pressed() {},
  move() {},
  steer() {},
  target() {},
  untarget() {},
  show() {},
  enable() {},
  destroy() {},
};

/**
 * Mounts the reticle over `surface` (the canvas) inside `container`, its
 * parent. Positions are measured against both, so padding or a border on the
 * container cannot offset the reticle from the real pointer.
 */
export function createStageCursor(
  container: HTMLElement,
  surface: HTMLElement,
): StageCursor {
  if (
    typeof matchMedia === "undefined" ||
    matchMedia("(pointer: coarse)").matches
  ) {
    return NOOP;
  }
  acquireStyle();
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  const prevCursor = surface.style.cursor;
  surface.style.cursor = "none";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  const layer = document.createElement("div");
  layer.className = "rs-cur-layer";
  const node = document.createElement("div");
  node.className = "rs-cur";
  node.dataset.mode = "idle";
  node.innerHTML = SVG;
  const frame = document.createElement("div");
  frame.className = "rs-cur-target";
  frame.innerHTML = `<svg aria-hidden="true"><path/></svg><span class="tag">${LABELS.player}</span>`;
  layer.append(frame, node);
  // Right above the canvas in paint order, under whatever overlays follow it.
  if (surface.parentElement === container) {
    surface.after(layer);
  } else {
    container.appendChild(layer);
  }
  // A z-indexed canvas would otherwise paint over the layer and hide it.
  const surfaceZ = getComputedStyle(surface).zIndex;
  if (surfaceZ !== "auto") {
    layer.style.zIndex = surfaceZ;
  }

  const head = node.querySelector<SVGGElement>(".head")!;
  const label = node.querySelector<SVGTextElement>(".label")!;
  const frameSvg = frame.querySelector("svg")!;
  const framePath = frame.querySelector("path")!;

  let mode: CursorMode = "idle";
  let shown: string = "";
  let zoomUntil = 0;
  let zoomIn = true;
  let follow = false;
  let enabled = true;
  let visible = false;

  // The hotspot is the true pointer; only the heading is eased.
  let x = 0;
  let y = 0;
  let rawX = 0;
  let rawY = 0;
  let vx = 0;
  let vy = 0;
  let havePos = false;
  // Unwrapped, so the arrows always take the short way round.
  let heading = 0;
  let raf = 0;
  let lastTick = 0;
  let frameSide = 0;
  let frameLeft = NaN;
  let frameTop = NaN;
  let frameOn = false;

  // Cached: pointermove fires far too often for a layout read each time.
  let layerRect = layer.getBoundingClientRect();
  let surfaceRect = surface.getBoundingClientRect();
  const remeasure = () => {
    layerRect = layer.getBoundingClientRect();
    surfaceRect = surface.getBoundingClientRect();
  };
  const observer = new ResizeObserver(remeasure);
  observer.observe(layer);
  observer.observe(surface);
  window.addEventListener("scroll", remeasure, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", remeasure);

  function setAttr(key: string, value: string) {
    if (node.dataset[key] !== value) {
      node.dataset[key] = value;
    }
  }

  function paintState(now: number) {
    const zooming = now < zoomUntil;
    const state = zooming ? "zoom" : mode;
    setAttr("mode", state);
    setAttr("zoom", zoomIn ? "in" : "out");
    setAttr("follow", follow ? "1" : "0");
    const text = zooming
      ? "ZOOM"
      : mode === "idle" && follow
        ? "FOLLOW"
        : LABELS[mode];
    if (text !== shown) {
      shown = text;
      label.textContent = text;
    }
    setAttr("label", text ? "1" : "0");
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = lastTick ? Math.min(0.1, (now - lastTick) / 1000) : 1 / 60;
    lastTick = now;
    const ease = 1 - Math.exp(-dt * 13);
    vx += (rawX - vx) * ease;
    vy += (rawY - vy) * ease;
    const decay = Math.exp(-dt * 12);
    rawX *= decay;
    rawY *= decay;
    paintState(now);
    const speed = Math.hypot(vx, vy);
    const calm = reduced.matches;

    if (mode === "tilt" && Math.abs(vy) > 0.3) {
      setAttr("tilt", vy < 0 ? "up" : "down");
    }
    if (mode === "orbit" && speed > 0.35) {
      const target = (Math.atan2(vy, vx) * 180) / Math.PI;
      heading += ((((target - heading) % 360) + 540) % 360) - 180;
      head.style.transform = `rotate(${heading.toFixed(1)}deg)`;
      node.style.setProperty(
        "--sweep",
        `${calm ? 0 : Math.min(speed * 1.6, 24).toFixed(1)}px`,
      );
      // A few px of lag behind the drag: the reticle has some weight.
      const lag = calm ? 0 : Math.min(speed * 0.22, 4);
      const a = (heading * Math.PI) / 180;
      node.style.transform = `translate3d(${(x - Math.cos(a) * lag).toFixed(1)}px,${(y - Math.sin(a) * lag).toFixed(1)}px,0)`;
      return;
    }
    if (mode === "orbit") {
      node.style.setProperty("--sweep", "0px");
    }
    node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  }

  function start() {
    if (!raf && visible && enabled) {
      lastTick = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function hideFrame() {
    if (frameOn) {
      frameOn = false;
      frame.dataset.on = "0";
    }
  }

  return {
    set(next) {
      if (mode === next) {
        return;
      }
      mode = next;
      if (next !== "orbit") {
        node.style.setProperty("--sweep", "0px");
      }
      if (next !== "player") {
        hideFrame();
      }
      paintState(performance.now());
    },
    zoom(inward) {
      zoomIn = inward;
      zoomUntil = performance.now() + ZOOM_FLASH;
      paintState(performance.now());
    },
    following(on) {
      follow = on;
    },
    pressed(on) {
      const value = on ? "1" : "0";
      setAttr("press", value);
      if (frame.dataset.press !== value) {
        frame.dataset.press = value;
      }
    },
    move(clientX, clientY) {
      const nx = clientX - layerRect.left;
      const ny = clientY - layerRect.top;
      if (havePos) {
        rawX = nx - x;
        rawY = ny - y;
      }
      x = nx;
      y = ny;
      if (!havePos) {
        // Jump to the spot before revealing, or it flies in from 0,0.
        havePos = true;
        node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }
    },
    steer(dx, dy) {
      rawX = dx;
      rawY = dy;
    },
    target(tx, ty, r) {
      if (!visible || !enabled) {
        return;
      }
      const side = Math.round(2 * (r + 6));
      if (side !== frameSide) {
        frameSide = side;
        const corner = Math.min(14, Math.max(6, side * 0.26));
        const s = side - 1;
        frameSvg.setAttribute("width", `${side}`);
        frameSvg.setAttribute("height", `${side}`);
        frameSvg.setAttribute("viewBox", `0 0 ${side} ${side}`);
        frameSvg.style.transformOrigin = `${side / 2}px ${side / 2}px`;
        framePath.setAttribute(
          "d",
          `M1 ${1 + corner}V1H${1 + corner}M${s - corner} 1H${s}V${1 + corner}` +
            `M${s} ${s - corner}V${s}H${s - corner}M${1 + corner} ${s}H1V${s - corner}`,
        );
      }
      const left =
        Math.round((tx + surfaceRect.left - layerRect.left - side / 2) * 4) / 4;
      const top =
        Math.round((ty + surfaceRect.top - layerRect.top - side / 2) * 4) / 4;
      if (left !== frameLeft || top !== frameTop) {
        frameLeft = left;
        frameTop = top;
        frame.style.transform = `translate3d(${left}px,${top}px,0)`;
      }
      if (!frameOn) {
        frameOn = true;
        frame.dataset.on = "1";
      }
    },
    untarget: hideFrame,
    show(on) {
      if (on) {
        remeasure();
      } else {
        havePos = false;
        hideFrame();
      }
      visible = on;
      node.dataset.on = on && enabled ? "1" : "0";
      if (on) {
        start();
      } else {
        stop();
      }
    },
    enable(on) {
      enabled = on;
      surface.style.cursor = on ? "none" : prevCursor;
      node.dataset.on = on && visible ? "1" : "0";
      if (on) {
        start();
      } else {
        hideFrame();
        stop();
      }
    },
    destroy() {
      stop();
      observer.disconnect();
      window.removeEventListener("scroll", remeasure, { capture: true });
      window.removeEventListener("resize", remeasure);
      layer.remove();
      surface.style.cursor = prevCursor;
      releaseStyle();
    },
  };
}
