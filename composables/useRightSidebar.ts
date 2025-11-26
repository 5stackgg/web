import { ref } from "vue";

const rightSidebarOpen = ref(false);

export function useRightSidebar() {
  const setRightSidebarOpen = (value: boolean) => {
    rightSidebarOpen.value = value;
  };

  const toggleRightSidebar = () => {
    rightSidebarOpen.value = !rightSidebarOpen.value;
  };

  return {
    rightSidebarOpen,
    setRightSidebarOpen,
    toggleRightSidebar,
  };
}
