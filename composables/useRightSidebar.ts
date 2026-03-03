import { ref } from "vue";

const rightSidebarOpen = ref(false);
const isHoverPeeking = ref(false);
const isPinned = ref(false);

const SIDEBAR_PIN_STORAGE_KEY = "right-hub-pinned";

// Initialize pin state (and openness) from localStorage on client
if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY);
  if (saved === "1") {
    isPinned.value = true;
    rightSidebarOpen.value = true;
  }
}

export function useRightSidebar() {
  const setRightSidebarOpen = (value: boolean) => {
    rightSidebarOpen.value = value;
  };

  const toggleRightSidebar = () => {
    rightSidebarOpen.value = !rightSidebarOpen.value;
  };

  function startHoverPeek() {
    if (!rightSidebarOpen.value) {
      isHoverPeeking.value = true;
      rightSidebarOpen.value = true;
    }
  }

  function endHoverPeek() {
    isHoverPeeking.value = false;
    if (!isPinned.value) {
      rightSidebarOpen.value = false;
    }
  }

  function togglePin() {
    isPinned.value = !isPinned.value;

    if (typeof window !== "undefined") {
      if (isPinned.value) {
        window.localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(SIDEBAR_PIN_STORAGE_KEY);
      }
    }
  }

  return {
    rightSidebarOpen,
    setRightSidebarOpen,
    toggleRightSidebar,
    startHoverPeek,
    endHoverPeek,
    isPinned,
    togglePin,
  };
}
