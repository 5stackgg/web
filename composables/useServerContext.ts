import { ref } from "vue";

type ServerContextValue = {
  id: string;
  name: string;
} | null;

const serverContext = ref<ServerContextValue>(null);

export function useServerContext() {
  return serverContext;
}
