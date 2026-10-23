// The link-preview image for the panel: its logo and name as the left nav
// draws them (server/utils/brandCard.ts). Rendered once per branding version
// and kept in memory.
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrandCardBrand } from "../../utils/brandCard";

let rendered: { version: string; png: Buffer } | null = null;
let fontFile: Promise<string> | null = null;

// resvg only loads fonts from files, and server assets are bundled into the
// server, so the font is written out once per process.
function brandFont() {
  fontFile ??= (async () => {
    const path = join(tmpdir(), `og-oxanium-${process.pid}.ttf`);
    const font = await useStorage("assets:server").getItemRaw(
      "og/Oxanium-Bold.ttf",
    );
    await writeFile(path, Buffer.from(font));
    return path;
  })();
  return fontFile;
}

async function brandLogo(brand: BrandCardBrand) {
  if (brand.logo) {
    try {
      const logo = await $fetch<ArrayBuffer>(
        `https://${process.env.NUXT_PUBLIC_API_DOMAIN}/branding/logo`,
        { responseType: "arrayBuffer" },
      );
      return { png: Buffer.from(logo), standIn: false };
    } catch (err) {
      console.error("[branding-og] logo fetch failed:", err);
    }
  }
  const crest = await useStorage("assets:server").getItemRaw("og/logo.png");
  return { png: Buffer.from(crest), standIn: !!brand.logo };
}

export default defineEventHandler(async (event) => {
  const brand = brandCardBrand(await loadPublicSettings());
  const version = brandCardVersion(brand);

  let png = rendered?.version === version ? rendered.png : null;
  if (!png) {
    const logo = await brandLogo(brand);
    png = renderBrandCard(brand, logo.png, await brandFont());
    // A failed logo fetch draws the crest for now and tries again next time.
    if (!logo.standIn) rendered = { version, png };
  }

  setResponseHeaders(event, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=600",
  });
  return png;
});
