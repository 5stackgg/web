import { describe, expect, it } from "vitest";
import { renderUnfurl } from "~/server/utils/unfurl";
import {
  utilityLineupThrowInstruction,
  utilityLineupUnfurlOptions,
  type UtilityLineupUnfurlRow,
} from "~/server/utils/utilityLineupUnfurl";
import { UTILITY_IN_BUTTONS as IN } from "~/utilities/utilityThrowGuide";

const ORIGIN = "https://5stack.gg";
const ID = "1afc5d54-805e-482b-a9a1-351f911758ca";
const CLIP = `https://cf.5stack.gg/clips/utility/${ID}/render.mp4?v=1`;
const THUMB = `https://cf.5stack.gg/clips/utility/${ID}/render.jpg?v=1`;

function lineup(
  overrides: Partial<UtilityLineupUnfurlRow> = {},
): UtilityLineupUnfurlRow {
  return {
    id: ID,
    name: "Mid Window Smoke",
    description: null,
    map_name: "de_mirage",
    utility_type: "Smoke",
    side: "TERRORIST",
    technique: "WalkJump",
    throw_strength: "Full",
    visibility: "Public",
    archived_at: null,
    approach: null,
    preview_url: CLIP,
    preview_thumbnail_url: THUMB,
    preview_stills_url: null,
    preview_duration_ms: 20000,
    ...overrides,
  };
}

// 64Hz, ending on the release at t = 0, the way the recorder cuts them.
function approach(buttons: number[]) {
  return buttons.map((held, index) => ({
    t: Math.round(((index - (buttons.length - 1)) * 1000) / 64),
    x: index,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    pitch: 0,
    yaw: 0,
    buttons: held,
    on_ground: true,
    ducked: false,
  }));
}

describe("utilityLineupThrowInstruction", () => {
  it("reads the technique and strength as something to do", () => {
    expect(utilityLineupThrowInstruction(lineup())).toBe(
      "Smoke · T side — Walk, then jump throw (left click, full throw)",
    );
  });

  it("names the buttons for each strength", () => {
    expect(
      utilityLineupThrowInstruction(
        lineup({
          utility_type: "Flash",
          side: "CT",
          technique: "Stationary",
          throw_strength: "Half",
        }),
      ),
    ).toBe(
      "Flash · CT side — Stand still and throw (left + right click, half throw)",
    );
    expect(
      utilityLineupThrowInstruction(
        lineup({
          utility_type: "HighExplosive",
          technique: "Running",
          throw_strength: "Drop",
        }),
      ),
    ).toBe("HE grenade · T side — Run and throw (right click, drop)");
  });

  it("says the recorded run-up in keys instead of the technique", () => {
    const walkForward = IN.forward | IN.walk;
    const ticks = [
      ...Array.from({ length: 60 }, () => walkForward),
      walkForward | IN.jump,
      walkForward,
    ];

    expect(
      utilityLineupThrowInstruction(lineup({ approach: approach(ticks) })),
    ).toBe(
      "Smoke · T side — Hold Shift + W for 1.0s, then jump throw (left click, full throw)",
    );
  });

  it("never asks for a jump-throw bind", () => {
    expect(
      utilityLineupThrowInstruction({
        ...lineup(),
        jump_throw_bind: true,
      } as UtilityLineupUnfurlRow),
    ).not.toMatch(/bind/i);
  });
});

describe("utilityLineupUnfurlOptions", () => {
  it("plays the rendered clip inline with the thumbnail behind it", () => {
    const options = utilityLineupUnfurlOptions(lineup(), ORIGIN);

    expect(options).toEqual({
      title: "Mid Window Smoke · Mirage",
      description:
        "Smoke · T side — Walk, then jump throw (left click, full throw)",
      pageUrl: `${ORIGIN}/utility/de_mirage?lineup=${ID}`,
      humanUrl: `${ORIGIN}/utility/de_mirage?lineup=${ID}&ufl=1`,
      image: THUMB,
      imageAlt: "Mid Window Smoke · Mirage",
      imageWidth: 1920,
      imageHeight: 1080,
      video: { url: CLIP, width: 1920, height: 1080, durationSec: 20 },
    });
  });

  it("falls back to a still, then the map, without a clip", () => {
    const still = `https://cf.5stack.gg/clips/utility/${ID}/render/aim.jpg?v=1`;
    const fromStill = utilityLineupUnfurlOptions(
      lineup({
        preview_url: null,
        preview_thumbnail_url: null,
        preview_stills_url: { landing: "https://x/landing.jpg", aim: still },
      }),
      ORIGIN,
    );
    expect(fromStill?.video).toBeNull();
    expect(fromStill?.image).toBe(still);
    expect(fromStill?.imageWidth).toBe(1920);

    const unrendered = utilityLineupUnfurlOptions(
      lineup({
        preview_url: null,
        preview_thumbnail_url: null,
        preview_duration_ms: null,
      }),
      ORIGIN,
    );
    expect(unrendered?.video).toBeNull();
    expect(unrendered?.image).toBe(
      `${ORIGIN}/img/maps/screenshots/de_mirage.webp`,
    );
    expect(unrendered?.imageWidth).toBeUndefined();
  });

  it("takes a workshop map's label and poster", () => {
    const poster = "https://images.steamusercontent.com/ugc/1/poster/";
    const options = utilityLineupUnfurlOptions(
      lineup({
        map_name: "de_cbble16",
        preview_url: null,
        preview_thumbnail_url: null,
      }),
      ORIGIN,
      { label: "Cobblestone", poster },
    );

    expect(options?.title).toBe("Mid Window Smoke · Cobblestone");
    expect(options?.image).toBe(poster);
  });

  it("names an unnamed lineup by its utility", () => {
    expect(
      utilityLineupUnfurlOptions(lineup({ name: "  " }), ORIGIN)?.title,
    ).toBe("Smoke lineup · Mirage");
  });

  it("puts the author's note after the instruction", () => {
    const options = utilityLineupUnfurlOptions(
      lineup({
        description: "  Aim at the antenna tip.\n\nWorks from T spawn.",
      }),
      ORIGIN,
    );

    expect(options?.description).toBe(
      "Smoke · T side — Walk, then jump throw (left click, full throw). Aim at the antenna tip. Works from T spawn.",
    );
  });

  it("gives a crawler nothing for a lineup a visitor could not open", () => {
    expect(
      utilityLineupUnfurlOptions(lineup({ visibility: "Private" }), ORIGIN),
    ).toBeNull();
    expect(
      utilityLineupUnfurlOptions(lineup({ visibility: "Team" }), ORIGIN),
    ).toBeNull();
    expect(
      utilityLineupUnfurlOptions(
        lineup({ archived_at: "2026-10-01T00:00:00Z" }),
        ORIGIN,
      ),
    ).toBeNull();
  });
});

describe("renderUnfurl", () => {
  it("emits the clip route's inline video tags for a clip", () => {
    const html = renderUnfurl(utilityLineupUnfurlOptions(lineup(), ORIGIN)!);

    expect(html).toContain('<meta property="og:type" content="video.other" />');
    expect(html).toContain(`<meta property="og:video" content="${CLIP}" />`);
    expect(html).toContain(
      `<meta property="og:video:secure_url" content="${CLIP}" />`,
    );
    expect(html).toContain(
      '<meta property="og:video:type" content="video/mp4" />',
    );
    expect(html).toContain(
      '<meta property="og:video:width" content="1920" />',
    );
    expect(html).toContain(
      '<meta property="og:video:height" content="1080" />',
    );
    expect(html).toContain(
      '<meta property="og:video:duration" content="20" />',
    );
    expect(html).toContain(`<meta property="og:image" content="${THUMB}" />`);
    expect(html).toContain('<meta name="twitter:card" content="player" />');
    expect(html).toContain(
      `<meta name="twitter:player:stream" content="${CLIP}" />`,
    );
    expect(html).toContain(
      `url=${ORIGIN}/utility/de_mirage?lineup=${ID}&amp;ufl=1`,
    );
  });

  it("keeps a large image card without a clip", () => {
    const html = renderUnfurl(
      utilityLineupUnfurlOptions(
        lineup({ preview_url: null, preview_duration_ms: null }),
        ORIGIN,
      )!,
    );

    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(html).not.toContain("og:video");
    expect(html).not.toContain("twitter:player");
  });
});
