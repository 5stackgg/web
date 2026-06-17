// Same-origin PWA manifest for white-label instances.
//
// The web app manifest must be served from the SAME origin as the page,
// otherwise its start_url/scope resolve to the API origin and the manifest
// no longer applies to the document — Chrome never fires beforeinstallprompt
// (no install button) and iOS won't reliably enter standalone mode.
//
// So we proxy the API's dynamic manifest (brand name + colors) through the
// web origin. start_url ("/") resolves to the web origin here; the icon URLs
// in the API manifest are absolute (API origin), and cross-origin icons are
// allowed by the spec.

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Content-Type", "application/manifest+json");
  setResponseHeader(event, "Cache-Control", "public, max-age=60");

  const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
  if (!apiDomain) {
    return sendRedirect(event, "/manifest.webmanifest", 302);
  }

  try {
    return await $fetch(`https://${apiDomain}/branding/manifest.webmanifest`);
  } catch (err) {
    console.error("[branding-manifest] fetch failed:", err);
    // Fall back to the static build manifest rather than serving nothing.
    return sendRedirect(event, "/manifest.webmanifest", 302);
  }
});
