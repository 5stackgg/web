import { describe, expect, it } from "vitest";
import {
  UTILITY_CLIP_PEEK_FROM_MS,
  UTILITY_IN_BUTTONS as IN,
  utilityClipPeekStartSeconds,
  utilityRunUp,
  utilityRunUpCaps,
  utilityRunUpSeconds,
} from "~/utilities/utilityThrowGuide";

type Tick = { buttons: number; on_ground?: boolean };

// 64Hz, ending on the release at t = 0, the way the recorder cuts them.
function approach(ticks: Tick[]) {
  return ticks.map((tick, index) => ({
    t: Math.round(((index - (ticks.length - 1)) * 1000) / 64),
    x: index,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    pitch: 0,
    yaw: 0,
    buttons: tick.buttons,
    on_ground: tick.on_ground ?? true,
    ducked: false,
  }));
}

function repeat(count: number, tick: Tick): Tick[] {
  return Array.from({ length: count }, () => ({ ...tick }));
}

describe("utilityRunUp", () => {
  it("has nothing to say without a run-up", () => {
    expect(utilityRunUp(null)).toBeNull();
    expect(utilityRunUp("nope")).toBeNull();
    expect(utilityRunUp(approach([{ buttons: IN.forward }]))).toBeNull();
    expect(utilityRunUp(approach(repeat(20, { buttons: 0 })))).toBeNull();
  });

  it("reads a strafe that ends in a jump as hold D, then jump throw", () => {
    const runUp = utilityRunUp(
      approach([
        ...repeat(24, { buttons: IN.moveRight }),
        { buttons: IN.moveRight | IN.jump | IN.attack },
      ]),
    );
    expect(runUp).toMatchObject({
      keys: ["D"],
      walk: false,
      crouch: false,
      jump: true,
      capped: false,
    });
    expect(runUp?.ms).toBe(375);
    expect(utilityRunUpSeconds(runUp!)).toBe("0.4");
  });

  it("reads shift held under W as a walk, with no jump", () => {
    const runUp = utilityRunUp(
      approach(repeat(40, { buttons: IN.forward | IN.walk })),
    );
    expect(runUp).toMatchObject({ keys: ["W"], walk: true, jump: false });
    expect(utilityRunUpCaps(runUp!)).toEqual(["Shift", "W"]);
  });

  it("ignores a key tapped for less than half of the run-up", () => {
    const runUp = utilityRunUp(
      approach([
        ...repeat(30, { buttons: IN.forward }),
        ...repeat(6, { buttons: IN.back }),
      ]),
    );
    expect(runUp?.keys).toEqual(["W"]);
  });

  it("drops opposite keys held together, since they cancel out", () => {
    expect(
      utilityRunUp(
        approach(repeat(20, { buttons: IN.moveLeft | IN.moveRight })),
      ),
    ).toBeNull();
    expect(
      utilityRunUp(
        approach(
          repeat(20, { buttons: IN.forward | IN.moveLeft | IN.moveRight }),
        ),
      )?.keys,
    ).toEqual(["W"]);
  });

  it("keeps W A S D order and puts the modifiers first", () => {
    const runUp = utilityRunUp(
      approach(
        repeat(20, { buttons: IN.moveRight | IN.forward | IN.duck | IN.walk }),
      ),
    );
    expect(runUp?.keys).toEqual(["W", "D"]);
    expect(utilityRunUpCaps(runUp!)).toEqual(["Shift", "Ctrl", "W", "D"]);
  });

  it("counts a jump well before the release only while still in the air", () => {
    const early = [
      ...repeat(10, { buttons: IN.forward }),
      { buttons: IN.forward | IN.jump },
      ...repeat(40, { buttons: IN.forward, on_ground: false }),
    ];
    expect(utilityRunUp(approach(early))?.jump).toBe(true);

    const landed = early.map((tick, index) =>
      index > 40 ? { ...tick, on_ground: true } : tick,
    );
    expect(utilityRunUp(approach(landed))?.jump).toBe(false);
  });

  it("times the run-up from when the keys went down, not from the cut", () => {
    const runUp = utilityRunUp(
      approach([
        ...repeat(8, { buttons: 0 }),
        ...repeat(33, { buttons: IN.forward }),
      ]),
    );
    expect(runUp?.ms).toBe(500);
    expect(runUp?.capped).toBe(false);
  });

  it("says when the run-up filled the recorder and may be longer", () => {
    const runUp = utilityRunUp(approach(repeat(128, { buttons: IN.forward })));
    expect(runUp?.capped).toBe(true);
    expect(utilityRunUpSeconds(runUp!)).toBe("2.0+");
  });

  it("sorts the ticks and skips malformed ones", () => {
    const ticks = approach(repeat(20, { buttons: IN.moveLeft })).reverse();
    const runUp = utilityRunUp([...ticks, null, { t: "x", buttons: 1 }]);
    expect(runUp?.keys).toEqual(["A"]);
    expect(runUp?.ms).toBe(297);
  });
});

describe("utilityClipPeekStartSeconds", () => {
  const rendered = {
    preview_url: "https://clips.example/a.mp4",
    preview_stills_url: { stance: "s.jpg", stance_eyes: "e.jpg" },
    preview_duration_ms: 14000,
  };

  it("starts a clip filmed to the current beat sheet just before the aim", () => {
    expect(utilityClipPeekStartSeconds(rendered)).toBe(
      UTILITY_CLIP_PEEK_FROM_MS / 1000,
    );
    expect(
      utilityClipPeekStartSeconds({ ...rendered, preview_duration_ms: null }),
    ).toBe(UTILITY_CLIP_PEEK_FROM_MS / 1000);
  });

  it("plays anything else from the top", () => {
    expect(
      utilityClipPeekStartSeconds({
        ...rendered,
        preview_stills_url: { stance: "s.jpg", aim: "a.jpg" },
      }),
    ).toBe(0);
    expect(
      utilityClipPeekStartSeconds({ ...rendered, preview_stills_url: null }),
    ).toBe(0);
    expect(
      utilityClipPeekStartSeconds({ ...rendered, preview_url: null }),
    ).toBe(0);
    expect(
      utilityClipPeekStartSeconds({ ...rendered, preview_duration_ms: 4000 }),
    ).toBe(0);
  });
});
