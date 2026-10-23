// The link-preview image for the panel: its logo and name as the left nav
// draws them (server/utils/brandCard.ts). Rendered once per branding version
// and kept in memory.
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrandCardBrand } from "../../utils/brandCard";

// A card drawn with the crest because the logo fetch failed is kept this
// long before the logo is tried again.
const STAND_IN_MS = 60 * 1000;

type Card = { version: string; expires: number; png: Promise<Buffer> };

let card: Card | null = null;
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
        { responseType: "arrayBuffer", timeout: 5000 },
      );
      return { png: Buffer.from(logo), standIn: false };
    } catch (err) {
      console.error("[branding-og] logo fetch failed:", err);
    }
  }
  const crest = await useStorage("assets:server").getItemRaw("og/logo.png");
  return { png: Buffer.from(crest), standIn: !!brand.logo };
}

// Requests that arrive while a card is drawing wait on the same render.
function drawCard(brand: BrandCardBrand, version: string) {
  const entry = { version, expires: Infinity } as Card;
  entry.png = (async () => {
    const logo = await brandLogo(brand);
    if (logo.standIn) entry.expires = Date.now() + STAND_IN_MS;
    return renderBrandCard(brand, logo.png, await brandFont());
  })();
  entry.png.catch(() => {
    if (card === entry) card = null;
  });
  return entry;
}

export default defineEventHandler(async (event) => {
  const brand = brandCardBrand(await loadPublicSettings());
  const version = brandCardVersion(brand);

  if (!card || card.version !== version || Date.now() > card.expires) {
    card = drawCard(brand, version);
  }
  const png = await card.png;

  setResponseHeaders(event, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=600",
  });
  return png;
});
