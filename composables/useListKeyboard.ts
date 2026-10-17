import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export type ListKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** Where a navigation key lands, or null when it has nowhere to go. */
export function nextListId(
  ids: readonly string[],
  current: string | null,
  key: ListKey,
): string | null {
  if (!ids.length) {
    return null;
  }
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  const index = current ? ids.indexOf(current) : -1;
  if (index === -1) {
    return key === "ArrowDown" ? ids[0] : ids[ids.length - 1];
  }
  const step = key === "ArrowDown" ? 1 : -1;
  return ids[Math.min(ids.length - 1, Math.max(0, index + step))];
}

const isTyping = (target: HTMLElement | null) =>
  !!target &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
    target.isContentEditable);

const OVERLAY_OPEN =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"]';

/**
 * The admin list keyboard (GSN's model): ↑/↓ move the active row, skipping
 * hidden ones, Home/End jump, Enter opens it, Esc closes what is open and
 * otherwise clears the active row. Keys act only while focus is inside the
 * list, or on the page body while the list has an active row, and never while
 * typing in a field or with a dialog or menu open. Spread `rowProps(id)` on
 * each row for the roving tabindex and the active state.
 */
export function useListKeyboard<T>(options: {
  /** The rows in display order. */
  items: MaybeRefOrGetter<readonly T[]>;
  getId: (item: T) => string;
  /** The active row; the composable moves it. */
  activeId: Ref<string | null>;
  /** The list element: keys count while focus is anywhere inside it.
   *  Without it, only focus on a row counts. */
  container?: Ref<HTMLElement | null | undefined>;
  /** Enter on the active row. */
  onOpen?: (id: string) => void;
  /** Esc. Return true when it closed something; otherwise the row clears. */
  onClose?: () => boolean | void;
  /** Rows to step over (collapsed, filtered out but still rendered). */
  isHidden?: (item: T) => boolean;
}) {
  const visibleIds = computed(() =>
    toValue(options.items)
      .filter((item) => !options.isHidden?.(item))
      .map(options.getId),
  );
  const ids = () => visibleIds.value;

  function rowElement(id: string): HTMLElement | null {
    return (options.container?.value ?? document).querySelector<HTMLElement>(
      `[data-list-row="${CSS.escape(id)}"]`,
    );
  }

  function insideList(target: HTMLElement | null) {
    if (!target) return false;
    const box = options.container?.value;
    if (box) return box.contains(target);
    const row = target.closest<HTMLElement>("[data-list-row]");
    return !!row && ids().includes(row.dataset.listRow ?? "");
  }

  function focusRow(id: string) {
    nextTick(() => {
      const row = rowElement(id);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView?.({ block: "nearest" });
    });
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (isTyping(target) || document.querySelector(OVERLAY_OPEN)) {
      return;
    }
    const inList = insideList(target);
    const onBody =
      (!target || target === document.body) && !!options.activeId.value;
    if (!inList && !onBody) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End": {
        const id = nextListId(ids(), options.activeId.value, event.key);
        if (!id) return;
        event.preventDefault();
        options.activeId.value = id;
        focusRow(id);
        return;
      }
      case "Enter": {
        // Enter on a button or link inside the row presses that instead.
        const onBodyOrRow =
          !target || target === document.body || !!target.dataset?.listRow;
        const id = target?.dataset?.listRow ?? options.activeId.value;
        if (!id || !onBodyOrRow || !ids().includes(id)) return;
        event.preventDefault();
        options.onOpen?.(id);
        return;
      }
      case "Escape": {
        if (options.onClose?.() === true) {
          event.preventDefault();
          return;
        }
        if (options.activeId.value) {
          event.preventDefault();
          options.activeId.value = null;
        }
      }
    }
  }

  /**
   * `v-bind` on each row: roving tabindex, aria-selected, data-active, and
   * focus (a click or Tab) makes the row active.
   */
  function rowProps(id: string) {
    const list = ids();
    const active = options.activeId.value;
    const tabbable = active && list.includes(active) ? active : list[0];
    return {
      "data-list-row": id,
      tabindex: id === tabbable ? 0 : -1,
      "aria-selected": id === active,
      "data-active": id === active ? "true" : undefined,
      onFocus: (event: FocusEvent) => {
        if (event.target === event.currentTarget) options.activeId.value = id;
      },
    };
  }

  if (getCurrentInstance()) {
    onMounted(() => document.addEventListener("keydown", onKeydown));
    onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
  }

  return { onKeydown, rowProps, focusRow };
}
