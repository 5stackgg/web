import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import BlockedMenuItem from "~/components/common/BlockedMenuItem.vue";

const REASONS = ["The start time has passed.", "Add a stage first."];

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

const Menu = defineComponent({
  setup() {
    return () =>
      h(DropdownMenu, null, {
        default: () => [
          h(DropdownMenuTrigger, null, { default: () => "Status" }),
          h(DropdownMenuContent, null, {
            default: () => [
              h(DropdownMenuItem, null, {
                default: () => "Close Registration",
              }),
              h(
                BlockedMenuItem,
                { reasons: REASONS },
                { default: () => "Open Registration" },
              ),
            ],
          }),
        ],
      });
  },
});

async function openByKeyboard() {
  const wrapper = await mountSuspended(Menu, { attachTo: document.body });
  unmount = () => wrapper.unmount();
  await wrapper
    .find("button[aria-haspopup='menu']")
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
  return wrapper;
}

const items = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'));

const blocked = () =>
  items().find((item) => item.textContent?.includes("Open Registration"))!;

async function arrowDown() {
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  await flushPromises();
}

describe("BlockedMenuItem", () => {
  it("is announced as disabled without leaving the arrow-key order", async () => {
    await openByKeyboard();

    expect(blocked().getAttribute("aria-disabled")).toBe("true");
    expect(blocked().hasAttribute("data-disabled")).toBe(false);

    await arrowDown();
    if (document.activeElement !== blocked()) {
      await arrowDown();
    }

    expect(document.activeElement).toBe(blocked());
  });

  it("shows its reasons when focused from the keyboard", async () => {
    await openByKeyboard();
    blocked().focus();
    await flushPromises();

    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain(REASONS[0]);
    expect(tooltip?.textContent).toContain(REASONS[1]);
  });

  it("does nothing and keeps the menu open when chosen", async () => {
    await openByKeyboard();
    blocked().focus();
    blocked().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    expect(blocked()).toBeDefined();
    expect(items()).toHaveLength(2);
  });
});
