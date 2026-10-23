import { afterEach, describe, expect, it, vi } from "vitest";
import {
  glideNavMarker,
  rememberNavMarker,
} from "~/composables/useLeftNavMarker";

function marker(top: number) {
  const el = document.createElement("span");
  el.dataset.navMarker = "";
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.animate = vi.fn() as unknown as typeof el.animate;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the left nav marker", () => {
  it("glides in one piece from where it was to the new page", () => {
    const old = marker(120);
    document.body.append(old);
    rememberNavMarker();
    old.remove();

    const next = marker(300);
    glideNavMarker(next);

    expect(next.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(-180px)" }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  });

  it("fades in where it is when there was no marker before", () => {
    rememberNavMarker();

    const next = marker(300);
    glideNavMarker(next);

    expect(next.animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 150 }),
    );
  });
});
