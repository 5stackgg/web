import { useChatTabs } from "~/composables/useChatTabs";
import { directTabId } from "~/composables/useDirectMessages";

// The DM rail's membership and order, which live on the server now.
//
// They used to be localStorage, so the bar was per-browser and two devices
// disagreed about which conversations were even on it. The row is already per
// (room, participant), so recording this says nothing to the other party --
// which was the original reason for keeping it local.
//
// Every mutation applies locally first and then tells the server. A dropped
// request costs the arrangement on the next load and nothing in this session;
// blocking the drag on a round trip would cost the drag.
export function useDirectConversationBar() {
  const { tabs, closeTab, setTabPosition } = useChatTabs();

  const base = () =>
    `https://${useRuntimeConfig().public.apiDomain}/chat/direct/conversations`;

  async function setOpen(roomId: string, open: boolean) {
    try {
      await $fetch(`${base()}/${encodeURIComponent(roomId)}/open`, {
        method: "PUT",
        credentials: "include",
        body: { open },
      });
    } catch {
      // Best effort. The bar is a convenience, not a record.
    }
  }

  // Removing a conversation from the rail. It still exists, and comes back the
  // moment the other person writes.
  function remove(roomId: string) {
    closeTab(directTabId(roomId));
    void setOpen(roomId, false);
  }

  function add(roomId: string) {
    void setOpen(roomId, true);
  }

  // Written whole rather than as a move, so a drag lands as one request and
  // cannot half-apply.
  function reorder(roomIds: string[]) {
    for (const [index, roomId] of roomIds.entries()) {
      setTabPosition(directTabId(roomId), index + 1);
    }

    void (async () => {
      try {
        await $fetch(`${base()}/order`, {
          method: "PUT",
          credentials: "include",
          body: { roomIds },
        });
      } catch {
        // As above -- the order reverts on the next load, not mid-drag.
      }
    })();
  }

  // The rail's conversations in the order it shows them, which is what a drag
  // rewrites relative to.
  function directRoomIds(): string[] {
    return tabs.value
      .filter((tab) => tab.type === "direct")
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((tab) => tab.lobbyId);
  }

  // Above everything already arranged, which is where the server puts a new
  // conversation too. Mirrors the `min(position) - 1` in ChatService.
  function topPosition(): number {
    const positions = tabs.value
      .filter((tab) => tab.type === "direct")
      .map((tab) => tab.position ?? 0);

    return positions.length === 0 ? 0 : Math.min(...positions) - 1;
  }

  return { remove, add, reorder, directRoomIds, topPosition };
}
