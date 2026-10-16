import { buildAssetsURL } from "#internal/nuxt/paths";

// Nuxt's router will not run the first route's middleware until it has fetched
// builds/meta/<buildId>.json, and it only starts that fetch once the entry
// chunk, its imports and the locale messages have all loaded and run -- a full
// round-trip parked in the middle of boot. Preloading it from the shell starts
// the download alongside the entry chunk instead. The href and `crossorigin`
// must match the $fetch that consumes it (same URL builder, same credentials
// mode), or the browser downloads the file twice.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html) => {
    const { buildId } = useRuntimeConfig().app;
    if (!buildId) {
      return;
    }

    const href = buildAssetsURL(`builds/meta/${buildId}.json`);
    html.head.push(
      `<link rel="preload" as="fetch" crossorigin href="${href}">`,
    );
  });
});
