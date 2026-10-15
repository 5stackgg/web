// The start stage's last move: each map flies from the stage to its card in
// the left column, and the order of play lifts into the match header. The
// flights are fixed-position copies on the body, so the board can fold away
// underneath them; each lands on an element marked data-veto-home and marks
// it data-landed.

export type VetoMapFlight = {
  rect: DOMRect;
  poster: string;
  label: string;
  home: string;
};

export type VetoFlight = {
  maps: VetoMapFlight[];
  rail: { el: HTMLElement; rect: DOMRect } | null;
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
const box = (rect: DOMRect) => ({
  left: `${rect.left}px`,
  top: `${rect.top}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
});
const onScreen = (rect: DOMRect) =>
  rect.width > 0 &&
  rect.bottom > 0 &&
  rect.top < window.innerHeight &&
  rect.right > 0 &&
  rect.left < window.innerWidth;

function ghostOf(flight: VetoMapFlight) {
  const ghost = document.createElement("div");
  Object.assign(ghost.style, box(flight.rect), {
    position: "fixed",
    zIndex: "60",
    overflow: "hidden",
    borderRadius: "12px",
    pointerEvents: "none",
    backgroundImage: `linear-gradient(rgb(0 0 0 / 0.45), rgb(0 0 0 / 0.45)), url("${flight.poster}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    boxShadow: "0 14px 34px rgb(0 0 0 / 0.5)",
  });
  const label = document.createElement("span");
  label.textContent = flight.label;
  Object.assign(label.style, {
    position: "absolute",
    left: "10px",
    bottom: "8px",
    fontSize: "14px",
    fontWeight: "700",
    color: "#fff",
    whiteSpace: "nowrap",
  });
  ghost.appendChild(label);
  document.body.appendChild(ghost);
  return ghost;
}

async function fly(
  ghost: HTMLElement,
  from: DOMRect,
  home: Element | null,
  target: Element | null | undefined,
  options: KeyframeAnimationOptions,
  radius?: [string, string],
) {
  const to = target?.getBoundingClientRect();
  if (to && onScreen(to)) {
    const start = { ...box(from), ...(radius && { borderRadius: radius[0] }) };
    const end = { ...box(to), ...(radius && { borderRadius: radius[1] }) };
    await ghost.animate([start, end], {
      easing: EASE,
      fill: "forwards",
      ...options,
    }).finished;
  }
  home?.setAttribute("data-landed", "");
  ghost.remove();
}

export async function flyHome({ maps, rail }: VetoFlight) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return;
  }

  const ghosts = maps.map(ghostOf);

  let railGhost: HTMLElement | null = null;
  if (rail) {
    railGhost = rail.el.cloneNode(true) as HTMLElement;
    Object.assign(railGhost.style, box(rail.rect), {
      position: "fixed",
      zIndex: "61",
      margin: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(railGhost);
    rail.el.style.visibility = "hidden";
  }

  // The cards and the header row open first; land on where they settle.
  await wait(460);

  await Promise.all([
    ...maps.map((flight, i) => {
      const home = document.querySelector(`[data-veto-home="${flight.home}"]`);
      return fly(
        ghosts[i],
        flight.rect,
        home,
        home?.querySelector("[data-veto-poster]") ?? home,
        { duration: 680, delay: i * 80 },
        ["12px", "12px 12px 0 0"],
      );
    }),
    railGhost && rail
      ? (() => {
          const home = document.querySelector('[data-veto-home="rail"]');
          return fly(railGhost, rail.rect, home, home, { duration: 640 });
        })()
      : null,
  ]);
}
