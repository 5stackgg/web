// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { idRange, useBulkSelect } from "~/composables/useBulkSelect";

type Row = { id: string };
const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));
const none = { shiftKey: false, metaKey: false, ctrlKey: false };

let wrapper: VueWrapper | null = null;
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

function mountSelect(initial: Row[]) {
  const items = ref(initial);
  let bulk!: ReturnType<typeof useBulkSelect<Row>>;
  wrapper = mount(
    defineComponent({
      setup() {
        bulk = useBulkSelect({ items, getId: (row) => row.id });
        return () => h("div");
      },
    }),
    { attachTo: document.body },
  );
  const picked = () => [...bulk.selected.value].sort();
  return { items, bulk, picked };
}

describe("idRange", () => {
  it("covers both ends in list order, whichever way it runs", () => {
    expect(idRange(["a", "b", "c", "d"], "b", "d")).toEqual(["b", "c", "d"]);
    expect(idRange(["a", "b", "c", "d"], "d", "b")).toEqual(["b", "c", "d"]);
    expect(idRange(["a", "b"], "gone", "b")).toEqual(["b"]);
    expect(idRange(["a", "b"], "a", "gone")).toEqual([]);
  });
});

describe("useBulkSelect", () => {
  it("toggles rows and reports the header checkbox state", () => {
    const { bulk, picked } = mountSelect(rows("a", "b", "c"));
    expect(bulk.allState.value).toBe(false);

    bulk.toggle("a");
    bulk.toggle("b");
    expect(picked()).toEqual(["a", "b"]);
    expect(bulk.isSelected("a")).toBe(true);
    expect(bulk.count.value).toBe(2);
    expect(bulk.allState.value).toBe("indeterminate");

    bulk.toggle("a");
    expect(picked()).toEqual(["b"]);
    bulk.selectAll();
    expect(bulk.allState.value).toBe(true);
    bulk.clear();
    expect(bulk.count.value).toBe(0);
  });

  it("selects a range from the last row toggled with Shift", () => {
    const { bulk, picked } = mountSelect(rows("a", "b", "c", "d", "e"));
    bulk.onCheckbox("b", none);
    bulk.onCheckbox("d", { ...none, shiftKey: true });
    expect(picked()).toEqual(["b", "c", "d"]);
  });

  it("treats ⌘/Ctrl and Shift row clicks as selection, plain clicks as open", () => {
    const { bulk, picked } = mountSelect(rows("a", "b", "c"));
    expect(bulk.onRowClick("a", none)).toBe(false);
    expect(picked()).toEqual([]);

    expect(bulk.onRowClick("a", { ...none, metaKey: true })).toBe(true);
    expect(bulk.onRowClick("c", { ...none, shiftKey: true })).toBe(true);
    expect(picked()).toEqual(["a", "b", "c"]);
    expect(bulk.onRowClick("b", { ...none, ctrlKey: true })).toBe(true);
    expect(picked()).toEqual(["a", "c"]);
  });

  it("drops rows that leave the list", async () => {
    const { items, bulk, picked } = mountSelect(rows("a", "b", "c"));
    bulk.selectAll();
    items.value = rows("a", "c");
    await nextTick();
    expect(picked()).toEqual(["a", "c"]);
    expect(bulk.selectedItems.value.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("clears on Esc, but not while typing", () => {
    const { bulk } = mountSelect(rows("a", "b"));
    bulk.selectAll();

    const field = document.createElement("input");
    document.body.appendChild(field);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(bulk.count.value).toBe(2);
    field.remove();

    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(bulk.count.value).toBe(0);
  });
});
