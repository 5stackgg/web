import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

// Modal driven by the `?clip=<id>` query param so deep links and
// back/forward navigate naturally.
export function useClipModal() {
  const route = useRoute();
  const router = useRouter();

  const activeClipId = computed<string | null>(() => {
    const v = route.query.clip;
    if (typeof v !== "string" || v.length === 0) return null;
    return v;
  });

  function openClip(id: string) {
    router.push({
      path: route.path,
      query: { ...route.query, clip: id },
      hash: route.hash,
    });
  }

  function closeClip() {
    const next = { ...route.query } as Record<string, any>;
    delete next.clip;
    router.replace({
      path: route.path,
      query: next,
      hash: route.hash,
    });
  }

  return {
    activeClipId,
    openClip,
    closeClip,
  };
}
