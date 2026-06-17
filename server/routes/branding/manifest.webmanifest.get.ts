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
    "public.color_dark_background",
    "public.color_dark_primary"
  ] } }) {
    name
    value
  }
}`;

// Stored color settings are shadcn space-separated HSL (e.g. "240 10% 3.9%").
function toCssColor(value: string | null | undefined): string {
  if (!value) return "#000000";
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("hsl")) return trimmed;
  return `hsl(${trimmed})`;
}

function guessContentType(path: string): string {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "image/png";
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
  const faviconUrl = get("public.favicon_url");

  // Cross-origin favicon (API origin) is fine; the manifest itself is what must
  // be same-origin. Static fallbacks are web-origin relative paths.
  const icons = faviconUrl
    ? [
        {
          src: `https://${apiDomain}/branding/favicon?v=${encodeURIComponent(faviconUrl)}`,
          sizes: "192x192 512x512",
          type: guessContentType(faviconUrl),
        },
        {
          src: `https://${apiDomain}/branding/favicon?v=${encodeURIComponent(faviconUrl)}`,
          sizes: "any",
          type: guessContentType(faviconUrl),
          purpose: "any",
        },
      ]
    : [
        { src: "/favicon/192.png", sizes: "192x192", type: "image/png" },
        {
          src: "/favicon/512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ];

  return {
    name: brandName,
    short_name: brandName,
    icons,
    theme_color: toCssColor(get("public.color_dark_primary")),
    background_color: toCssColor(get("public.color_dark_background")),
    display: "standalone",
    start_url: "/",
  };
});
