import { watch } from "vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { directRoomId, directTabId } from "~/composables/useDirectMessages";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import socket from "~/web-sockets/Socket";

// The api sends no event on a block or an unblock, only changes what it sends
// from then on, so what this client already holds is its own to hide. A block
// made on another device arrives through the same subscription.
export function useChatBlocks() {
  const { blocks, loaded } = usePlayerBlocks();
  const { closeTab } = useChatTabs();
  const authStore = useAuthStore();

  watch(
    [
      () => (loaded.value ? blocks.value : null),
      () => authStore.isRoleAbove(e_player_roles_enum.moderator),
    ],
    ([rows, moderator]) => {
      if (!rows) {
        return;
      }

      const { added } = socket.setHiddenAuthors(
        rows.map((row) => String(row.blocked_steam_id)),
        { inGroups: !moderator },
      );

      const mySteamId = authStore.me?.steam_id;
      if (!mySteamId) {
        return;
      }

      for (const steamId of added) {
        closeTab(directTabId(directRoomId(mySteamId, steamId)));
      }
    },
    { immediate: true },
  );
}
