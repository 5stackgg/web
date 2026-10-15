// The start stage's last move. The board has folded its maps away; the page
// takes them back: each map card (marked data-veto-home="map-N") unfolds in
// turn, then the order of play in the header (data-veto-home="rail") fades
// in. Each is marked data-landed as it comes in, so the page can keep it
// hidden until then.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// The gap between the cards, closed while one is still folded.
const CARD_GAP = 12;

function unfold(home: HTMLElement, i: number) {
  const height = home.offsetHeight;
  home.setAttribute("data-landed", "");
  home.style.overflow = "hidden";
  return home
    .animate(
      [
        { height: "0px", marginTop: i ? `-${CARD_GAP}px` : "0px", opacity: 0 },
        { height: `${height}px`, marginTop: "0px", opacity: 1 },
      ],
      { duration: 460, delay: 80 + i * 110, easing: EASE, fill: "backwards" },
    )
    .finished.catch(() => {})
    .finally(() => {
      home.style.overflow = "";
    });
}

function fadeIn(home: HTMLElement, delay: number) {
  home.setAttribute("data-landed", "");
  return home
    .animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 420, delay, easing: EASE, fill: "backwards" },
    )
    .finished.catch(() => {});
}

export async function unfoldHome() {
  // The header's row mounts with the hand-off; let the page render it first.
  await new Promise((done) => requestAnimationFrame(() => done(null)));
  const homes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-veto-home]"),
  );
  // A stage that comes back (the server went down again) lands afresh.
  homes.forEach((home) => home.removeAttribute("data-landed"));

  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reduced || typeof document.body.animate !== "function") {
    return;
  }

  const cards = homes.filter((home) =>
    home.dataset.vetoHome?.startsWith("map-"),
  );
  const rail = homes.find((home) => home.dataset.vetoHome === "rail");
  await Promise.all([...cards.map(unfold), rail ? fadeIn(rail, 160) : null]);
}
