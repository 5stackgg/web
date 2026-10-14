// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import UtilityExecuteTransport from "~/components/utility/UtilityExecuteTransport.vue";
import { usePlaybackClock } from "~/composables/usePlaybackClock";

// A ten-second run, paused at `position`.
function runAt(position: number) {
  const run = usePlaybackClock({ length: () => 10 });
  run.seek(position);
  return run;
}

const mountBar = ({ position = 2 }: { position?: number } = {}) =>
  mount(UtilityExecuteTransport, {
    props: {
      run: runAt(position),
      running: false,
      beats: [{ key: "a", seconds: 5, color: "#fff" }],
    },
    global: { mocks: { $t: (key: string) => key } },
    attachTo: document.body,
  });

describe("UtilityExecuteTransport", () => {
  it("plays and pauses from its button", async () => {
    const bar = mountBar();
    await bar.get("button").trigger("click");
    expect(bar.emitted("toggle")).toHaveLength(1);
  });

  it("scrubs a second at a time from the keyboard, without the camera hearing it", async () => {
    const bar = mountBar();
    let reachedWindow = false;
    const listen = () => (reachedWindow = true);
    window.addEventListener("keydown", listen);
    await bar.get("[role=slider]").trigger("keydown", { key: "ArrowRight" });
    await bar.get("[role=slider]").trigger("keydown", { key: "End" });
    window.removeEventListener("keydown", listen);
    expect(bar.emitted("seek")).toEqual([[3], [10]]);
    expect(reachedWindow).toBe(false);
    bar.unmount();
  });

  it("offers to start again once the run has finished", () => {
    const bar = mountBar({ position: 10 });
    expect(bar.get("[role=slider]").attributes("aria-valuenow")).toBe("10");
    expect(
      bar
        .find("button svg.lucide-rotate-ccw-icon, button svg.lucide-rotate-ccw")
        .exists(),
    ).toBe(true);
  });
});
