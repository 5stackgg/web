import { reactive } from "vue";

const pressed = reactive(new Set<string>());
const failed = reactive(new Set<string>());

export function usePressedStreams() {
  function isPressed(key: string) {
    return pressed.has(key);
  }

  function press(key: string) {
    pressed.add(key);
    failed.delete(key);
  }

  function hasFailed(key: string) {
    return failed.has(key);
  }

  function fail(key: string) {
    failed.add(key);
  }

  return { isPressed, press, hasFailed, fail };
}
