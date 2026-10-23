// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_CARD_HEIGHT,
  BRAND_CARD_WIDTH,
  brandCardBrand,
  brandCardVersion,
  hslToHex,
  renderBrandCard,
} from "~/server/utils/brandCard";

const ASSETS = path.resolve(__dirname, "../../server/assets/og");
const FONT = path.join(ASSETS, "Oxanium-Bold.ttf");
const CREST = fs.readFileSync(path.join(ASSETS, "logo.png"));

const pngSize = (png: Buffer) => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe("the panel's link-preview card", () => {
  it("is drawn from the panel's branding, with 5Stack's as the default", () => {
    expect(brandCardBrand({})).toEqual({
      name: "5Stack",
      amber: "#f99e2f",
      background: "#09090b",
      logo: null,
    });
    expect(
      brandCardBrand({
        "public.brand_name": "Frag Republic",
        "public.color_dark_tactical_amber": "200 80% 50%",
        "public.logo_url": "branding/logo.png",
        "public.pwa_icon": "1729000000000",
      }),
    ).toEqual({
      name: "Frag Republic",
      amber: hslToHex("200 80% 50%"),
      background: "#09090b",
      logo: "1729000000000",
    });
  });

  it("gets a new URL when anything on it changes", () => {
    const base = brandCardBrand({});
    expect(brandCardVersion(base)).toBe(brandCardVersion(brandCardBrand({})));
    expect(brandCardVersion({ ...base, name: "Frag Republic" })).not.toBe(
      brandCardVersion(base),
    );
    expect(brandCardVersion({ ...base, logo: "2" })).not.toBe(
      brandCardVersion({ ...base, logo: "1" }),
    );
  });

  it("reads the settings' h s% l% colours", () => {
    expect(hslToHex("0 0% 100%")).toBe("#ffffff");
    expect(hslToHex("0 100% 50%")).toBe("#ff0000");
    expect(hslToHex("nonsense")).toBe("#000000");
  });

  it("renders a 1200x630 PNG, a long name included", () => {
    for (const name of [
      "5Stack",
      "The Greater Midwest Collegiate Counter-Strike Esports League",
    ]) {
      const png = renderBrandCard(
        brandCardBrand({ "public.brand_name": name }),
        CREST,
        FONT,
      );
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(pngSize(png)).toEqual({
        width: BRAND_CARD_WIDTH,
        height: BRAND_CARD_HEIGHT,
      });
    }
  });
});
