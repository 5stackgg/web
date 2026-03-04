import { ref, onMounted, onUnmounted } from "vue";

export function useVisualViewport() {
  const height = ref(window.visualViewport?.height ?? window.innerHeight);

  function update() {
    if (window.visualViewport) {
      height.value = window.visualViewport.height;
    }
  }

  onMounted(() => {
    window.visualViewport?.addEventListener("resize", update);
  });

  onUnmounted(() => {
    window.visualViewport?.removeEventListener("resize", update);
  });

  return { height };
}
