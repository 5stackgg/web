import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import debounce from "~/utilities/debounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("calls once, with the last arguments, after the calls stop", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 300);

    debounced("a");
    vi.advanceTimersByTime(200);
    debounced("b");
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("b");
  });

  it("still fires by maxWait under calls that never stop", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 2000, { maxWait: 6000 });

    for (let elapsed = 0; elapsed < 6000; elapsed += 1500) {
      debounced(elapsed);
      vi.advanceTimersByTime(1500);
    }

    expect(spy).toHaveBeenCalledTimes(1);

    debounced("after");
    vi.advanceTimersByTime(2000);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("after");
  });

  it("never fires once cancelled", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 2000, { maxWait: 6000 });

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(10000);

    expect(spy).not.toHaveBeenCalled();
  });
});
