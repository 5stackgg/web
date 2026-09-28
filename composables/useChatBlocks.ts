import { watch } from "vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { directRoomId, directTabId } from "~/composables/useDirectMessages";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import { useAuthStore } from "~/stores/AuthStore";
import { blockedIdsChange } from "~/utilities/playerBlocks";
import socket from "~/web-sockets/Socket";

// The api sends no event on a block or an unblock, only changes what it sends
// from then on, so what this client already holds is its own to hide. A block
// made on another device arrives through the same subscription.
export function useChatBlocks() {
  const { blocks, loaded } = usePlayerBlocks();
  const { closeTab } = useChatTabs();
  const authStore = useAuthStore();

  let applied = new Set<string>();

  watch(
    () => (loaded.value ? blocks.value : null),
    (rows) => {
      if (!rows) {
        return;
      }

      const next = new Set(rows.map((row) => String(row.blocked_steam_id)));
      const { added, removed } = blockedIdsChange(applied, next);
      applied = next;

      if (added.length > 0) {
        socket.hideAuthors(added);

        const mySteamId = authStore.me?.steam_id;
        if (mySteamId) {
          for (const steamId of added) {
            closeTab(directTabId(directRoomId(mySteamId, steamId)));
          }
        }
      }

      if (removed.length > 0) {
        socket.showAuthors(removed);
      }
    },
    { immediate: true },
  );
}
