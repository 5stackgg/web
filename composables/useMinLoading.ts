import { ref } from "vue";

export function useMinLoading(minMs = 2000) {
  const loading = ref(false);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (loading.value) {
      return;
    }

    loading.value = true;
    const start = Date.now();

    try {
      return await fn();
    } finally {
      const remaining = minMs - (Date.now() - start);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      loading.value = false;
    }
  }

  return { loading, run };
}
