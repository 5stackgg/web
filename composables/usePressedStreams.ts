import { reactive } from "vue";

const pressed = reactive(new Set<string>());

export function usePressedStreams() {
  function isPressed(key: string) {
    return pressed.has(key);
  }

  function press(key: string) {
    pressed.add(key);
  }

  return { isPressed, press };
}
