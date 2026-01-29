import { ref, nextTick } from "vue";

/**
 * Composable for common file tree utilities
 */
export function useFileTreeUtilities() {
  // Drag state
  const dragCounter = ref(0);

  // Context menu state
  const contextMenuOpen = ref(false);
  const contextMenuPosition = ref({ x: 0, y: 0 });

  // Inline input utilities
  /**
   * Focus an inline input element and select its contents
   */
  function focusInlineInput(inputRef: Ref<InstanceType<any> | null>) {
    nextTick(() => {
      const inputEl = inputRef.value?.$el as HTMLInputElement;
      if (inputEl && typeof inputEl.focus === "function") {
        inputEl.focus();
        inputEl.select?.();
      }
    });
  }

  /**
   * Handle blur for inline create/rename with confirmation
   * @param confirmFn - Function to call when confirming
   * @param cancelFn - Function to call when cancelling
   * @param value - Current input value
   * @param currentName - Current item name (for rename validation)
   */
  function handleInlineBlur(
    confirmFn: () => void | Promise<void>,
    cancelFn: (() => void) | undefined,
    value: string | undefined | null,
    currentName?: string,
  ) {
    if (!value || !cancelFn) {
      cancelFn?.();
      return;
    }

    setTimeout(() => {
      if (currentName !== undefined && value.trim() !== currentName) {
        confirmFn();
      } else if (value.trim()) {
        confirmFn();
      } else {
        cancelFn();
      }
    }, 100);
  }

  // Context menu handlers
  function openContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    contextMenuPosition.value = { x: event.clientX, y: event.clientY };
    contextMenuOpen.value = true;
  }

  function closeContextMenu() {
    contextMenuOpen.value = false;
  }

  // Drag handlers
  function handleDragEnter(event?: DragEvent) {
    dragCounter.value++;
  }

  function handleDragLeave(event?: DragEvent) {
    dragCounter.value--;
    if (dragCounter.value === 0) {
      // Optional: Add callback to signal drag has left
    }
  }

  function resetDragState() {
    dragCounter.value = 0;
  }

  return {
    // Drag state
    dragCounter,
    // Context menu state
    contextMenuOpen,
    contextMenuPosition,
    openContextMenu,
    closeContextMenu,
    // Inline input utilities
    focusInlineInput,
    handleInlineBlur,
    // Drag handlers
    handleDragEnter,
    handleDragLeave,
    resetDragState,
  };
}
