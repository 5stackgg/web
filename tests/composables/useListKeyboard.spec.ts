// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextListId, useListKeyboard } from "~/composables/useListKeyboard";

describe("nextListId", () => {
  const ids = ["a", "b", "c"];

  it("steps and stops at the ends", () => {
    expect(nextListId(ids, "a", "ArrowDown")).toBe("b");
    expect(nextListId(ids, "c", "ArrowDown")).toBe("c");
    expect(nextListId(ids, "a", "ArrowUp")).toBe("a");
  });

  it("enters from the near end when nothing is active", () => {
    expect(nextListId(ids, null, "ArrowDown")).toBe("a");
    expect(nextListId(ids, null, "ArrowUp")).toBe("c");
    expect(nextListId(ids, "gone", "ArrowDown")).toBe("a");
  });

  it("jumps with Home and End, and has nowhere to go in an empty list", () => {
    expect(nextListId(ids, "b", "Home")).toBe("a");
    expect(nextListId(ids, "b", "End")).toBe("c");
    expect(nextListId([], null, "ArrowDown")).toBeNull();
  });
});

type Row = { id: string; hidden?: boolean };

let wrapper: VueWrapper | null = null;
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

function mountList(
  rows: Row[],
  handlers: { onOpen?: any; onClose?: any } = {},
) {
  const activeId = ref<string | null>(null);
  let api!: ReturnType<typeof useListKeyboard<Row>>;
  wrapper = mount(
    defineComponent({
      setup() {
        const container = ref<HTMLElement | null>(null);
        api = useListKeyboard({
          items: rows,
          getId: (row) => row.id,
          activeId,
          container,
          isHidden: (row) => !!row.hidden,
          ...handlers,
        });
        return () =>
          h("div", [
            h("input", { "data-field": "" }),
            h(
              "ul",
              { ref: container },
              rows.map((row) =>
                h("li", api.rowProps(row.id), [
                  h("button", { "data-inner": row.id }, "⋯"),
                ]),
              ),
            ),
          ]);
      },
    }),
    { attachTo: document.body },
  );
  const key = (target: Element, key: string) =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  const row = (id: string) =>
    wrapper!.element.querySelector(`[data-list-row="${id}"]`) as HTMLElement;
  return { activeId, api, key, row };
}

describe("useListKeyboard", () => {
  it("moves the active row with the arrows, skipping hidden rows", async () => {
    const { activeId, key, row } = mountList([
      { id: "a" },
      { id: "b", hidden: true },
      { id: "c" },
    ]);
    row("a").focus();
    await nextTick();
    expect(activeId.value).toBe("a");

    key(row("a"), "ArrowDown");
    expect(activeId.value).toBe("c");
    key(row("c"), "Home");
    expect(activeId.value).toBe("a");
    key(row("a"), "End");
    expect(activeId.value).toBe("c");
  });

  it("gives the active row the roving tabindex and selected state", async () => {
    const { activeId, row } = mountList([{ id: "a" }, { id: "b" }]);
    expect(row("a").tabIndex).toBe(0);
    expect(row("b").tabIndex).toBe(-1);

    activeId.value = "b";
    await nextTick();
    expect(row("a").tabIndex).toBe(-1);
    expect(row("b").tabIndex).toBe(0);
    expect(row("b").getAttribute("aria-selected")).toBe("true");
    expect(row("b").dataset.active).toBe("true");
    expect(row("a").dataset.active).toBeUndefined();
  });

  it("opens the active row on Enter, but not from a button inside it", () => {
    const onOpen = vi.fn();
    const { activeId, key, row } = mountList([{ id: "a" }], { onOpen });
    activeId.value = "a";

    key(row("a").querySelector("button")!, "Enter");
    expect(onOpen).not.toHaveBeenCalled();
    key(row("a"), "Enter");
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("lets Esc close what is open first, then clear the row", () => {
    let open = true;
    const onClose = vi.fn(() => {
      const closed = open;
      open = false;
      return closed;
    });
    const { activeId, key, row } = mountList([{ id: "a" }], { onClose });
    activeId.value = "a";

    key(row("a"), "Escape");
    expect(activeId.value).toBe("a");
    key(row("a"), "Escape");
    expect(activeId.value).toBeNull();
  });

  it("ignores keys while typing or with focus outside the list", () => {
    const { activeId, key } = mountList([{ id: "a" }, { id: "b" }]);
    activeId.value = "a";

    key(wrapper!.element.querySelector("[data-field]")!, "ArrowDown");
    expect(activeId.value).toBe("a");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    key(outside, "ArrowDown");
    expect(activeId.value).toBe("a");
    outside.remove();
  });

  it("acts from the page body while the list has an active row", () => {
    const { activeId, key } = mountList([{ id: "a" }, { id: "b" }]);
    key(document.body, "ArrowDown");
    expect(activeId.value).toBeNull();

    activeId.value = "a";
    key(document.body, "ArrowDown");
    expect(activeId.value).toBe("b");
  });
});
