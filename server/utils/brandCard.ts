import { createHash } from "node:crypto";
import { Resvg } from "@resvg/resvg-js";
import { escapeHtml } from "./unfurl";
import type { PublicSettings } from "./publicSettings";

// The link-preview image: the left nav's logo and wordmark
// (layouts/components/LeftNavBanner.vue) drawn at 1200x630 from the panel's
// own logo, name and colours, so each panel's links unfurl as itself.

export const BRAND_CARD_WIDTH = 1200;
export const BRAND_CARD_HEIGHT = 630;

const W = BRAND_CARD_WIDTH;
const H = BRAND_CARD_HEIGHT;

// The nav's 52px logo, scaled up; every other size follows from it as it
// does there (rounded-xl corners, gap-3.5, a 1.6rem wordmark).
const LOGO = 176;
const SCALE = LOGO / 52;
const RADIUS = 12 * SCALE;
const GAP = 14 * SCALE;
const FONT = 25.6 * SCALE;
const MARGIN = 96;
const MAX_WORD = W - MARGIN * 2 - LOGO - GAP;

export interface BrandCardBrand {
  name: string;
  amber: string;
  background: string;
  // The uploaded logo's version, or null for the bundled 5Stack crest.
  logo: string | null;
}

export function brandCardBrand(settings: PublicSettings): BrandCardBrand {
  return {
    name: settings["public.brand_name"] || "5Stack",
    amber: hslToHex(
      settings["public.color_dark_tactical_amber"] || "33 94% 58%",
    ),
    background: hslToHex(
      settings["public.color_dark_background"] || "240 10% 3.9%",
    ),
    logo: settings["public.logo_url"]
      ? settings["public.pwa_icon"] || settings["public.logo_url"]
      : null,
  };
}

// Changes whenever anything drawn on the card does, so a crawler that caches
// images by URL picks up a rebrand.
export function brandCardVersion(brand: BrandCardBrand): string {
  return createHash("sha1")
    .update(JSON.stringify(brand))
    .digest("hex")
    .slice(0, 10);
}

// The settings store colours as "h s% l%" (the CSS variables' form).
export function hslToHex(hsl: string): string {
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return "#000000";
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return (
    "#" +
    [h + 1 / 3, h, h - 1 / 3]
      .map((t) =>
        Math.round((s === 0 ? l : channel(t)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const resvgOptions = (fontFile: string) => ({
  font: {
    fontFiles: [fontFile],
    loadSystemFonts: false,
    defaultFontFamily: "Oxanium",
  },
});

const wordAttrs = (size: number) =>
  `font-family="Oxanium" font-weight="700" font-size="${size}" letter-spacing="${(size * 0.08).toFixed(2)}"`;

// The wordmark's inked extent at a given size, so the lockup centres on what
// is drawn rather than on the advance widths.
function measureWord(word: string, size: number, fontFile: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="0" y="${size}" ${wordAttrs(size)}>${escapeHtml(word)}</text></svg>`;
  const box = new Resvg(svg, resvgOptions(fontFile)).getBBox();
  return { x: box?.x ?? 0, width: box?.width ?? 0 };
}

export function renderBrandCard(
  brand: Pick<BrandCardBrand, "name" | "amber" | "background">,
  logo: Buffer,
  fontFile: string,
): Buffer {
  // A long name shrinks to fit, and past a floor it is cut short with an
  // ellipsis, as the nav cuts it.
  let word = brand.name.toUpperCase();
  const natural = measureWord(word, FONT, fontFile);
  const size = Math.max(
    40,
    Math.min(FONT, (FONT * MAX_WORD) / Math.max(1, natural.width)),
  );
  let ink = measureWord(word, size, fontFile);
  for (let keep = word.length - 1; ink.width > MAX_WORD && keep > 0; keep--) {
    word = `${brand.name.toUpperCase().slice(0, keep).trimEnd()}…`;
    ink = measureWord(word, size, fontFile);
  }

  const left = (W - (LOGO + GAP + ink.width)) / 2;
  const logoY = (H - LOGO) / 2;
  const wordX = left + LOGO + GAP;
  // A line-height: 1 box, an 8px gap and a 2px rule, centred on the logo.
  // Oxanium's ascent is 0.79em, so the baseline sits that far into the box.
  const block = size * (1 + 8 / 25.6 + 2 / 25.6);
  const blockY = H / 2 - block / 2;
  const baseline = blockY + size * 0.79;
  const ruleY = blockY + size * (1 + 8 / 25.6);
  const ruleH = size * (2 / 25.6);
  const ruleW = Math.min(size * (118 / 25.6), ink.width);
  const ghost = size * (2 / 25.6);

  // Contour rings out of the bottom-right corner, as in the nav's band.
  const ringX = W * 0.88;
  const ringY = H * 1.2;
  const rings = Array.from({ length: 52 }, (_, i) => {
    const rx = 28 * (i + 1);
    return `<ellipse cx="${ringX}" cy="${ringY}" rx="${rx}" ry="${(rx / 1.14).toFixed(1)}" />`;
  }).join("");

  const text = escapeHtml(word);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.3" stop-color="${brand.amber}" stop-opacity="0" />
      <stop offset="1" stop-color="${brand.amber}" stop-opacity="0.07" />
    </linearGradient>
    <linearGradient id="ring-fade" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#fff" />
      <stop offset="0.75" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <mask id="ring-mask"><rect width="${W}" height="${H}" fill="url(#ring-fade)" /></mask>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" />
      <stop offset="1" stop-color="#c9c9cf" />
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${brand.amber}" />
      <stop offset="1" stop-color="${brand.amber}" stop-opacity="0" />
    </linearGradient>
    <clipPath id="logo-clip">
      <rect x="${left}" y="${logoY}" width="${LOGO}" height="${LOGO}" rx="${RADIUS}" />
    </clipPath>
    <filter id="logo-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="${6 * SCALE}" stdDeviation="${9 * SCALE}" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${brand.background}" />
  <g mask="url(#ring-mask)" fill="none" stroke="#fff" stroke-opacity="0.045" stroke-width="2">${rings}</g>
  <rect width="${W}" height="${H}" fill="url(#wash)" />
  <rect x="${left}" y="${logoY}" width="${LOGO}" height="${LOGO}" rx="${RADIUS}" fill="${brand.background}" filter="url(#logo-shadow)" />
  <image href="data:image/png;base64,${logo.toString("base64")}" x="${left}" y="${logoY}" width="${LOGO}" height="${LOGO}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logo-clip)" />
  <rect x="${left + 1}" y="${logoY + 1}" width="${LOGO - 2}" height="${LOGO - 2}" rx="${RADIUS - 1}" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2" />
  <text x="${wordX - ink.x + ghost}" y="${baseline + ghost}" ${wordAttrs(size)} fill="none" stroke="${brand.amber}" stroke-opacity="0.55" stroke-width="${(size / 25.6).toFixed(2)}">${text}</text>
  <text x="${wordX - ink.x}" y="${baseline}" ${wordAttrs(size)} fill="url(#face)">${text}</text>
  <rect x="${wordX}" y="${ruleY}" width="${ruleW}" height="${ruleH}" fill="url(#rule)" />
</svg>`;

  return new Resvg(svg, {
    ...resvgOptions(fontFile),
    fitTo: { mode: "original" },
  })
    .render()
    .asPng();
}
