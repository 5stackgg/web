import { computed, ref } from "vue";

// The hub has two states: open for as long as you are using it, or pinned. A
// hover (or a click, which only skips the wait) opens it, and leaving it,
// clicking outside or Escape puts it away again. Pinning is the only way to
// keep it open, and the only state a reload restores.
const rightSidebarOpen = ref(false);
const isPinned = ref(false);
const hoverCloseLocks = ref(0);
const hoverCloseSuspended = computed(() => hoverCloseLocks.value > 0);

const SIDEBAR_PIN_STORAGE_KEY = "right-hub-pinned";

if (
  typeof window !== "undefined" &&
  window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY) === "1"
) {
  isPinned.value = true;
  rightSidebarOpen.value = true;
}

function setPinned(value: boolean) {
  isPinned.value = value;
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, "1");
  } else {
    window.localStorage.removeItem(SIDEBAR_PIN_STORAGE_KEY);
  }
}

export function useRightSidebar() {
  const setRightSidebarOpen = (value: boolean) => {
    rightSidebarOpen.value = value;
    // Explicitly closing also unpins.
    if (!value && isPinned.value) {
      setPinned(false);
    }
  };

  const toggleRightSidebar = () => {
    setRightSidebarOpen(!rightSidebarOpen.value);
  };

  // Leaving the hub, clicking away from it, Escape: everything but a pin.
  function dismissRightSidebar() {
    if (!isPinned.value) {
      rightSidebarOpen.value = false;
    }
  }

  function suspendHoverClose() {
    hoverCloseLocks.value += 1;
  }

  function resumeHoverClose() {
    hoverCloseLocks.value = Math.max(0, hoverCloseLocks.value - 1);
  }

  // Pinning opens the hub if it was closed; unpinning leaves it open until the
  // pointer leaves, like any other open.
  function togglePin() {
    setPinned(!isPinned.value);
    if (isPinned.value) {
      rightSidebarOpen.value = true;
    }
  }

  return {
    rightSidebarOpen,
    setRightSidebarOpen,
    toggleRightSidebar,
    dismissRightSidebar,
    hoverCloseSuspended,
    suspendHoverClose,
    resumeHoverClose,
    isPinned,
    togglePin,
  };
}
