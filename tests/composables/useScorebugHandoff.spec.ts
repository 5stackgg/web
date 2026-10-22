import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handOffScorebug,
  useScorebugHandoff,
} from "~/composables/useScorebugHandoff";

const realStart = (document as any).startViewTransition;

afterEach(() => {
  (document as any).startViewTransition = realStart;
  document.body.replaceChildren();
});

describe("the scorebug hand-off", () => {
  it("just swaps where there are no view transitions", async () => {
    (document as any).startViewTransition = undefined;
    const swap = vi.fn();

    await handOffScorebug(swap);

    expect(swap).toHaveBeenCalledOnce();
    expect(useScorebugHandoff().value).toBe(false);
  });

  it("names the scorebug and drops the page fades only while it runs", async () => {
    const seen: Array<[boolean, boolean]> = [];
    (document as any).startViewTransition = (update: () => Promise<void>) => {
      const done = update();
      return { finished: done };
    };
    const swap = () => {
      seen.push([
        useScorebugHandoff().value,
        document.documentElement.classList.contains("scorebug-handoff"),
      ]);
      const bug = document.createElement("div");
      bug.dataset.scorebug = "box";
      bug.getClientRects = () => [{}] as any;
      document.body.appendChild(bug);
    };

    await handOffScorebug(swap);

    expect(seen).toEqual([[true, true]]);
    expect(useScorebugHandoff().value).toBe(false);
    expect(
      document.documentElement.classList.contains("scorebug-handoff"),
    ).toBe(false);
  });
});
