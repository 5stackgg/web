export default defineNuxtPlugin((nuxtApp) => {
  let revealed = false;

  const reveal = () => {
    if (revealed) {
      return;
    }
    revealed = true;

    // Two frames: the first lets Vue's just-resolved patch land in the DOM,
    // the second lets the browser actually paint it. Fading on the same tick
    // starts the transition against a still-empty page, which is the flash
    // we're avoiding.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add("pre-loader--fade");

        setTimeout(() => {
          document.body.classList.remove("pre-loader", "pre-loader--fade");
        }, 300);
      });
    });
  };

  // NOT app:mounted — Nuxt fires that the instant the root component mounts,
  // before the root <Suspense> resolves. NuxtLayout and NuxtPage both defer
  // hydration, so at that point the layout, its async children and the page
  // chunk are all still in flight and the app renders nothing. Tearing the
  // overlay down there leaves a blank screen until everything lands.
  nuxtApp.hook("app:suspense:resolve", reveal);

  // An error aborts the suspense — the overlay still has to go.
  nuxtApp.hook("app:error", reveal);

  // Last resort: never leave someone stuck staring at the spinner.
  setTimeout(reveal, 20000);
});
