import { computed, ref } from "vue";

const rightSidebarOpen = ref(false);
const isHoverPeeking = ref(false);
const isPinned = ref(false);
const hoverCloseLocks = ref(0);
const hoverCloseSuspended = computed(() => hoverCloseLocks.value > 0);

const SIDEBAR_PIN_STORAGE_KEY = "right-hub-pinned";
const SIDEBAR_OPEN_STORAGE_KEY = "right-hub-open";

if (typeof window !== "undefined") {
  if (window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY) === "1") {
    isPinned.value = true;
    rightSidebarOpen.value = true;
  } else {
    rightSidebarOpen.value =
      window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY) === "1";
  }
}

function persistOpen(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, "1");
  } else {
    window.localStorage.removeItem(SIDEBAR_OPEN_STORAGE_KEY);
  }
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
    persistOpen(value);
    // Explicitly closing also unpins, so hover-to-peek resumes afterwards.
    if (!value && isPinned.value) {
      setPinned(false);
    }
  };

  const toggleRightSidebar = () => {
    setRightSidebarOpen(!rightSidebarOpen.value);
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

  function suspendHoverClose() {
    hoverCloseLocks.value += 1;
  }

  function resumeHoverClose() {
    hoverCloseLocks.value = Math.max(0, hoverCloseLocks.value - 1);
  }

  function togglePin() {
    setPinned(!isPinned.value);
  }

  return {
    rightSidebarOpen,
    setRightSidebarOpen,
    toggleRightSidebar,
    startHoverPeek,
    endHoverPeek,
    hoverCloseSuspended,
    suspendHoverClose,
    resumeHoverClose,
    isPinned,
    togglePin,
  };
}
