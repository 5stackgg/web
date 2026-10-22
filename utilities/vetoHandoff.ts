// The start stage's last move. The board has folded its maps away; the page
// takes them back: each map card (marked data-veto-home="map-N") unfolds in
// turn, and the order of play in the header (data-veto-home="rail") fades in
// as its row folds open, so the row never opens empty. Each is marked
// data-landed as it comes in, so the page can keep it hidden until then.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// The gap between the cards, closed while one is still folded.
const CARD_GAP = 12;

// With the columns stacked (below lg) the cards sit above the board in one
// column: they open together, on the board's own fold, so the column only
// ever moves one way instead of shrinking and then growing back.
const stacked = () => !window.matchMedia?.("(min-width: 1024px)")?.matches;

const nextFrame = () =>
  new Promise((done) => requestAnimationFrame(() => done(null)));

// Shut on this frame: the card keeps its place in the order but takes no room.
function fold(home: HTMLElement, i: number) {
  const height = home.getBoundingClientRect().height;
  const folded = {
    height: "0px",
    marginTop: i ? `-${CARD_GAP}px` : "0px",
    opacity: "0",
  };
  home.setAttribute("data-landed", "");
  Object.assign(home.style, folded, { overflow: "hidden" });
  return { home, i, height, folded };
}

function unfold(
  { home, i, height, folded }: ReturnType<typeof fold>,
  together: boolean,
) {
  const animation = home.animate(
    [folded, { height: `${height}px`, marginTop: "0px", opacity: 1 }],
    together
      ? { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      : { duration: 460, delay: 80 + i * 110, easing: EASE },
  );
  return animation.finished
    .catch(() => {})
    .finally(() => {
      Object.assign(home.style, {
        height: "",
        marginTop: "",
        opacity: "",
        overflow: "",
      });
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
  // A stage that comes back (the server went down again) lands afresh.
  document
    .querySelectorAll("[data-veto-home][data-landed]")
    .forEach((home) => home.removeAttribute("data-landed"));

  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reduced || typeof document.body.animate !== "function") {
    return;
  }

  // The cards shut now, before their column opens, and start unfolding
  // with the board's own fold, which Vue begins two frames on. The header's
  // row has mounted by then too.
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-veto-home^="map-"]'),
  ).map(fold);
  await nextFrame();
  await nextFrame();
  const together = stacked();
  const rail = document.querySelector<HTMLElement>('[data-veto-home="rail"]');
  await Promise.all([
    ...cards.map((card) => unfold(card, together)),
    rail ? fadeIn(rail, 0) : null,
  ]);
}
