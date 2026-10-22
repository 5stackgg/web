import { nextTick, ref } from "vue";

// The draft room's scorebug and the match page's are one thing to the eye.
// When the room hands over, the swap runs inside a view transition: the parts
// marked data-scorebug (crests, team names, the centre box) glide from the
// room's header to the match header while the two pages crossfade around them
// (the timing is in assets/css/tailwind.css). Without view transitions, in a
// hidden tab or with reduced motion, the swap simply runs.
const handingOff = ref(false);

// True for the length of a hand-off: the page transition drops its own fades
// (app.vue) and the match header arrives already in place.
export function useScorebugHandoff() {
  return handingOff;
}

// The match page's header arrives with the page's first query; the room's
// last frame holds until then, or this long.
const LANDING_MS = 1200;

const landed = (old: Set<Element>) =>
  Array.from(document.querySelectorAll("[data-scorebug]")).some(
    (el) => !old.has(el) && el.getClientRects().length > 0,
  );

function waitForLanding(old: Set<Element>) {
  return new Promise<void>((resolve) => {
    if (landed(old)) {
      resolve();
      return;
    }
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (landed(old)) {
        done();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(done, LANDING_MS);
  });
}

export async function handOffScorebug(swap: () => unknown) {
  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (!document.startViewTransition || reduced || document.hidden) {
    await swap();
    return;
  }

  const old = new Set(document.querySelectorAll("[data-scorebug]"));
  handingOff.value = true;
  // The page transition gives up its fades before the swap starts. Inside the
  // view transition no frames run, and Vue's own transitions wait on frames.
  await nextTick();
  const root = document.documentElement;
  root.classList.add("scorebug-handoff");
  try {
    await document.startViewTransition(async () => {
      await swap();
      await waitForLanding(old);
    }).finished;
  } catch {
    // A failed swap has already left the page where it is.
  } finally {
    root.classList.remove("scorebug-handoff");
    handingOff.value = false;
  }
}
