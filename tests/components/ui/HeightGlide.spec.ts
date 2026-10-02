import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";

// jsdom has no layout and no ResizeObserver: stub the observer so the test can
// fire it, and give the content a settable offsetHeight.
let fireResize: () => void = () => {};
let contentHeight = 0;

class StubResizeObserver {
  constructor(callback: () => void) {
    fireResize = callback;
  }
  observe() {}
  disconnect() {}
}

let wrapper: VueWrapper | undefined;

function mountGlide(initial: number) {
  contentHeight = initial;
  wrapper = mount(HeightGlide, {
    slots: { default: "<p>panel</p>" },
    attachTo: document.body,
  });
  const shell = wrapper.element as HTMLElement;
  const content = shell.firstElementChild as HTMLElement;
  return { shell, content };
}

// jsdom's CSSStyleDeclaration is itself a Proxy, so wrap the element's style
// getter rather than redefining the height property on it.
function recordHeightWrites(shell: HTMLElement) {
  const writes: string[] = [];
  const real = shell.style;
  const recording = new Proxy(real, {
    get: (target, key) => {
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set: (target, key, value) => {
      if (key === "height") {
        writes.push(value);
      }
      return Reflect.set(target, key, value);
    },
  });
  Object.defineProperty(shell, "style", {
    configurable: true,
    get: () => recording,
  });
  return writes;
}

function resizeTo(next: number, shell: HTMLElement, rendered: number) {
  contentHeight = next;
  shell.getBoundingClientRect = () => ({ height: rendered }) as DOMRect;
  fireResize();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.classList?.contains("flow-root") ? contentHeight : 0;
    },
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as any).offsetHeight;
});

describe("HeightGlide", () => {
  it("glides from the content's previous height to its new one, then lets go", () => {
    const { shell } = mountGlide(600);

    // At rest the shell is auto, so it has already taken the new size by the
    // time the observer reports; the glide must start from the old height.
    resizeTo(950, shell, 950);

    expect(shell.style.height).toBe("950px");
    expect(shell.classList.contains("height-glide-animating")).toBe(true);

    vi.advanceTimersByTime(300);

    expect(shell.style.height).toBe("");
    expect(shell.classList.contains("height-glide-animating")).toBe(false);
  });

  it("pins the old height first, so the jump is never drawn", () => {
    const { shell } = mountGlide(600);
    const writes = recordHeightWrites(shell);

    resizeTo(950, shell, 950);

    expect(writes).toEqual(["600px", "950px"]);
  });

  it("retargets from where a glide in progress has got to", () => {
    const { shell } = mountGlide(600);

    resizeTo(1000, shell, 1000);
    const writes = recordHeightWrites(shell);
    // Partway through (the box is at 800px), the content changes again.
    resizeTo(400, shell, 800);

    expect(writes).toEqual(["800px", "400px"]);
    vi.advanceTimersByTime(300);
    expect(shell.style.height).toBe("");
  });

  it("ignores a report with no change in height", () => {
    const { shell } = mountGlide(600);

    resizeTo(600, shell, 600);

    expect(shell.style.height).toBe("");
    expect(shell.classList.contains("height-glide-animating")).toBe(false);
  });

  it("jumps without a tween when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { shell } = mountGlide(600);

    resizeTo(900, shell, 900);

    expect(shell.style.height).toBe("");
    expect(shell.classList.contains("height-glide-animating")).toBe(false);
  });
});
