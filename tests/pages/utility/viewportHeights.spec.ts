// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HEADER = "100dvh-var(--header-height,4rem)";
const ALERTS = "-var(--system-alerts-height,0px)";

// The system alert banners sit above the page, so a column sized to the
// window below the header ends a banner's height off screen.
describe("utility columns sized to the window", () => {
  it.each([
    "pages/utility.vue",
    "pages/utility/[map].vue",
    "pages/utility/index.vue",
  ])("%s leaves room for the system alert banners", (page) => {
    const sized = readFileSync(join(process.cwd(), page), "utf8")
      .split(HEADER)
      .slice(1);

    expect(sized.length).toBeGreaterThan(0);
    for (const rest of sized) {
      expect(rest.startsWith(ALERTS)).toBe(true);
    }
  });
});
