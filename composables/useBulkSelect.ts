import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

type Modifiers = Pick<MouseEvent, "shiftKey" | "metaKey" | "ctrlKey">;

/** The ids from `from` to `to` in list order, both included. */
export function idRange(ids: readonly string[], from: string, to: string) {
  const a = ids.indexOf(from);
  const b = ids.indexOf(to);
  if (b === -1) {
    return [];
  }
  if (a === -1) {
    return [to];
  }
  return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/**
 * The one bulk-select model for admin lists: a checkbox per row (see
 * SelectDot), ⌘/Ctrl-click toggles a row, Shift-click selects the range from
 * the last row toggled, Esc clears. Rows that leave `items` leave the
 * selection, so a bulk action only ever reaches rows on screen.
 */
export function useBulkSelect<T>(options: {
  /** The visible rows, in display order. */
  items: MaybeRefOrGetter<readonly T[]>;
  getId: (item: T) => string;
  /** Esc anywhere outside a field clears the selection. Default true. */
  escape?: boolean;
}) {
  const selected = shallowRef<ReadonlySet<string>>(new Set());
  let anchor: string | null = null;

  const ids = computed(() => toValue(options.items).map(options.getId));

  function commit(next: Set<string>) {
    selected.value = next;
  }

  const isSelected = (id: string) => selected.value.has(id);

  /** Flips one row, or sets it with `on`. It becomes the range anchor. */
  function toggle(id: string, on = !selected.value.has(id)) {
    const next = new Set(selected.value);
    if (on) next.add(id);
    else next.delete(id);
    anchor = id;
    commit(next);
  }

  /** Adds every row from the anchor to `id`. */
  function range(id: string) {
    const next = new Set(selected.value);
    for (const value of idRange(ids.value, anchor ?? id, id)) {
      next.add(value);
    }
    anchor ??= id;
    commit(next);
  }

  function clear() {
    anchor = null;
    if (selected.value.size) commit(new Set());
  }

  function selectAll() {
    commit(new Set(ids.value));
  }

  /**
   * A click on the row itself. Returns true when it was a selection gesture
   * (⌘/Ctrl or Shift), so the caller skips opening the row.
   */
  function onRowClick(id: string, event: Modifiers) {
    if (event.shiftKey) {
      range(id);
      return true;
    }
    if (event.metaKey || event.ctrlKey) {
      toggle(id);
      return true;
    }
    return false;
  }

  /** A click on the row's checkbox: Shift selects the range, else toggles. */
  function onCheckbox(id: string, event?: Modifiers) {
    if (event?.shiftKey && anchor) {
      range(id);
      return;
    }
    toggle(id);
  }

  const count = computed(() => selected.value.size);
  const selectedItems = computed(() =>
    toValue(options.items).filter((item) =>
      selected.value.has(options.getId(item)),
    ),
  );
  /** For the header checkbox. */
  const allState = computed<boolean | "indeterminate">(() => {
    const picked = ids.value.filter((id) => selected.value.has(id)).length;
    if (picked === 0) return false;
    return picked === ids.value.length ? true : "indeterminate";
  });

  watch(ids, (list) => {
    if (!selected.value.size) return;
    const present = new Set(list);
    const next = new Set([...selected.value].filter((id) => present.has(id)));
    if (next.size !== selected.value.size) commit(next);
    if (anchor && !present.has(anchor)) anchor = null;
  });

  function onDocumentKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented || !count.value) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable)
    ) {
      return;
    }
    if (
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]',
      )
    ) {
      return;
    }
    clear();
  }

  if (options.escape !== false && getCurrentInstance()) {
    onMounted(() => document.addEventListener("keydown", onDocumentKeydown));
    onBeforeUnmount(() =>
      document.removeEventListener("keydown", onDocumentKeydown),
    );
  }

  return {
    selected,
    count,
    selectedItems,
    allState,
    isSelected,
    toggle,
    range,
    clear,
    selectAll,
    onRowClick,
    onCheckbox,
    onKeydown: onDocumentKeydown,
  };
}
