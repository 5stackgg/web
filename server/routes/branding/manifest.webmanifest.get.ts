// Same-origin PWA manifest for white-label instances.
//
// The web app manifest MUST be served from the same origin as the page,
// otherwise its start_url/scope resolve to a different origin and the manifest
// stops applying to the document — Chrome never fires beforeinstallprompt (no
// install button) and iOS won't reliably enter standalone mode.
//
// So instead of pointing <link rel="manifest"> at the API, we build the
// manifest here (same Hasura-admin pattern as server/routes/clips/[id].get.ts)
// and serve it from the web origin. start_url ("/") resolves to the web origin;
// the favicon icon is an absolute API URL, and cross-origin icons are allowed.

const SETTINGS_QUERY = `query BrandingManifest {
  settings(where: { name: { _in: [
    "public.brand_name",
    "public.favicon_url",
    "public.pwa_icon"
  ] } }) {
    name
    value
  }
}`;

function guessContentType(path: string): string {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}

// A favicon can be a tiny .ico, which Chrome can't use as an install icon, so
// only fall back to it when it's a raster format that's usable at install sizes.
function faviconUsableAsIcon(path: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(path);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Content-Type", "application/manifest+json");
  setResponseHeader(event, "Cache-Control", "public, max-age=60");

  const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
  const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  // No backend wired up — fall back to the static build manifest.
  if (!apiDomain || !adminSecret) {
    return sendRedirect(event, "/manifest.webmanifest", 302);
  }

  let settings: Array<{ name: string; value: string }> = [];
  try {
    const res = await $fetch<{ data?: { settings?: typeof settings } }>(
      `https://${apiDomain}/v1/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret,
        },
        body: { query: SETTINGS_QUERY },
      },
    );
    settings = res?.data?.settings ?? [];
  } catch (err) {
    console.error("[branding-manifest] settings fetch failed:", err);
    return sendRedirect(event, "/manifest.webmanifest", 302);
  }

  const get = (name: string) => settings.find((s) => s.name === name)?.value;

  const brandName = get("public.brand_name") || "5Stack";
  const pwaIcon = get("public.pwa_icon");
  const faviconUrl = get("public.favicon_url");

  // Icon source priority:
  //   1. The dedicated PWA icon (API-generated 192/512 PNGs) — best.
  //   2. A raster favicon (only if usable at install sizes).
  //   3. The bundled 5Stack icons.
  // Cross-origin icons (API origin) are allowed; only the manifest itself must
  // be same-origin.
  let icons;
  if (pwaIcon) {
    const v = encodeURIComponent(pwaIcon);
    icons = [192, 512].map((size) => ({
      src: `https://${apiDomain}/branding/pwa/${size}?v=${v}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    }));
  } else if (faviconUrl && faviconUsableAsIcon(faviconUrl)) {
    const src = `https://${apiDomain}/branding/favicon?v=${encodeURIComponent(faviconUrl)}`;
    icons = [
      { src, sizes: "192x192 512x512", type: guessContentType(faviconUrl) },
      { src, sizes: "any", type: guessContentType(faviconUrl), purpose: "any" },
    ];
  } else {
    icons = [
      { src: "/favicon/192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/favicon/512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ];
  }

  return {
    name: brandName,
    short_name: brandName,
    icons,
    // Always dark — the install/splash chrome should match the app's dark theme
    // regardless of the instance's custom colors.
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
    start_url: "/",
  };
});
