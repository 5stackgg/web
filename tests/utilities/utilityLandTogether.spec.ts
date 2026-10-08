import { describe, expect, it } from "vitest";
import {
  UTILITY_EXECUTE_FOLLOW_UP_SECONDS,
  UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
  executeFlightSeconds,
  utilityLandTogether,
} from "~/utilities/utilityDisplay";

const lineup = (id: string, utility_type: string, flight_time_ms: number) => ({
  id,
  utility_type: utility_type as any,
  flight_time_ms,
});

// When each step's grenade comes down, given the throw times worked out.
function landings(
  steps: Array<{ lineup: ReturnType<typeof lineup> | null }>,
) {
  return utilityLandTogether(steps).map((seconds, index) =>
    seconds === null || !steps[index].lineup
      ? null
      : Math.round(
          (seconds + executeFlightSeconds(steps[index].lineup!)) * 10,
        ) / 10,
  );
}

describe("utilityLandTogether", () => {
  it("lands every smoke on one moment and starts the clock on the first throw", () => {
    const steps = [
      { lineup: lineup("a", "Smoke", 2400) },
      { lineup: lineup("b", "Smoke", 4100) },
      { lineup: lineup("c", "Smoke", 1300) },
    ];
    const times = utilityLandTogether(steps);
    expect(Math.min(...(times as number[]))).toBe(
      UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
    );
    const landed = landings(steps);
    expect(new Set(landed).size).toBe(1);
  });

  it("lands the rest a few seconds after the smokes", () => {
    const steps = [
      { lineup: lineup("a", "Smoke", 3000) },
      { lineup: lineup("b", "Flash", 1600) },
      { lineup: lineup("c", "Molotov", 2200) },
    ];
    const [smoke, flash, molly] = landings(steps) as number[];
    expect(flash - smoke).toBeCloseTo(UTILITY_EXECUTE_FOLLOW_UP_SECONDS, 5);
    expect(molly - smoke).toBeCloseTo(UTILITY_EXECUTE_FOLLOW_UP_SECONDS, 5);
  });

  it("lands everything together when there is no smoke to wait for", () => {
    const landed = landings([
      { lineup: lineup("a", "Flash", 1600) },
      { lineup: lineup("b", "HighExplosive", 2600) },
    ]);
    expect(landed[0]).toBe(landed[1]);
  });

  it("lands a lineup thrown again after its last one", () => {
    const [first, again] = landings([
      { lineup: lineup("a", "Flash", 1600) },
      { lineup: lineup("a", "Flash", 1600) },
    ]) as number[];
    expect(again - first).toBeCloseTo(UTILITY_EXECUTE_FOLLOW_UP_SECONDS, 5);
  });

  it("leaves a step it has no flight for", () => {
    const times = utilityLandTogether([
      { lineup: null },
      { lineup: lineup("a", "Smoke", 2000) },
    ]);
    expect(times[0]).toBeNull();
    expect(times[1]).toBe(UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS);
  });
});
