import { computed, shallowRef } from "vue";
import type { ChatAttachmentConfig } from "~/utilities/chatAttachments";

// The operator's limits and whether a GIPHY key is set. Admin-only settings,
// so the api hands the composer just what it needs to know.
const config = shallowRef<ChatAttachmentConfig | null>(null);
let loadedAt = 0;
let pending: Promise<void> | null = null;

const STALE_MS = 5 * 60 * 1000;

export function useChatAttachmentConfig() {
  function load(force = false): Promise<void> {
    if (pending) {
      return pending;
    }

    if (!force && config.value && Date.now() - loadedAt < STALE_MS) {
      return Promise.resolve();
    }

    pending = $fetch<ChatAttachmentConfig>(
      `https://${useRuntimeConfig().public.apiDomain}/chat/attachments/config`,
      { credentials: "include" },
    )
      .then((loaded) => {
        config.value = loaded;
        loadedAt = Date.now();
      })
      .catch(() => {
        loadedAt = 0;
      })
      .finally(() => {
        pending = null;
      });

    return pending;
  }

  return { config: computed(() => config.value), load };
}
