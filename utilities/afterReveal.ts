// requestIdleCallback alone is NOT enough to keep work out of the boot: boot is
// full of idle gaps while chunks and GraphQL are in flight, so rIC fires
// *during* it -- measured at 828ms against a 979ms reveal. The pre-loader
// overlay coming down is the real signal (plugins/preloader.client.ts removes
// the `pre-loader` class once the root Suspense has resolved), so gate on that
// and only then ask for idle.
export function afterReveal(run: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  let scheduled = false;

  const idle = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 5000 });
      return;
    }

    setTimeout(run, 1000);
  };

  // Already revealed -- a client-side navigation, or the overlay is long gone.
  if (!document.body.classList.contains("pre-loader")) {
    idle();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains("pre-loader")) {
      observer.disconnect();
      idle();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Never strand the work if the overlay ever stops being torn down.
  setTimeout(() => {
    observer.disconnect();
    idle();
  }, 10000);
}
