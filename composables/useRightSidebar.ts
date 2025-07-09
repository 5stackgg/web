import { ref, computed } from "vue";

const rightSidebarOpen = ref(false);

export function useRightSidebar() {
  const setRightSidebarOpen = (value: boolean) => {
    rightSidebarOpen.value = value;
  };

  const toggleRightSidebar = () => {
    rightSidebarOpen.value = !rightSidebarOpen.value;
  };

  return {
    rightSidebarOpen: computed(() => rightSidebarOpen.value),
    setRightSidebarOpen,
    toggleRightSidebar,
  };
}
