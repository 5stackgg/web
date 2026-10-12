import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// Every mounted component that wants a replay stage, newest last.
const claims = ref<symbol[]>([]);

/**
 * One replay stage on the page at a time: each is a WebGL context and a whole
 * map in memory. The newest component to mount holds it; the one under it
 * gets it back when that one goes.
 */
export function useReplayStageSlot() {
  const own = Symbol("replay-stage");
  onMounted(() => {
    claims.value = [...claims.value, own];
  });
  onBeforeUnmount(() => {
    claims.value = claims.value.filter((claim) => claim !== own);
  });
  return computed(() => claims.value[claims.value.length - 1] === own);
}
