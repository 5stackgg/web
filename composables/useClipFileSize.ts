import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

export function formatClipBytes(bytes: number | null): string | null {
  if (!bytes || !Number.isFinite(bytes)) {
    return null;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(0)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

// The schema does not track a clip's size, so it is read off a HEAD of the
// file itself -- best effort, and nothing is shown until it answers.
export function useClipFileSize(
  url: MaybeRefOrGetter<string | null | undefined>,
) {
  const bytes = ref<number | null>(null);
  let token = 0;

  watch(
    () => toValue(url) ?? null,
    async (next) => {
      const mine = ++token;
      bytes.value = null;
      if (!next || !import.meta.client) {
        return;
      }
      try {
        const res = await fetch(next, { method: "HEAD" });
        const length = Number(res.headers.get("content-length"));
        if (mine === token && Number.isFinite(length) && length > 0) {
          bytes.value = length;
        }
      } catch {}
    },
    { immediate: true },
  );

  return computed(() => formatClipBytes(bytes.value));
}
