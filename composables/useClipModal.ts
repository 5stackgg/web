import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

// Global clip-detail modal state, driven by the URL's `?clip=<id>`
// query param. Putting it in the URL means deep links and browser
// back/forward both Just Work — sharing /highlights?clip=<id> opens
// directly into the modal, and closing pops the param without
// changing the underlying page.
//
// The standalone /clips/<id> route stays as a deep-link entry point
// (cleaner share URL); its page redirects into /highlights?clip=<id>
// so the modal is always the canonical viewer.
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
    // Replace, not push — closing shouldn't add a history entry.
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
