import { ref } from "vue";
import { chatThreadKey } from "~/utilities/chatThread";

// Where the player has read up to in each thread, as the server sees it.
//
// The unread badges were purely in-memory before, so a reload wiped them and
// two devices never agreed. The server keeps a cursor per thread and the client
// already holds each room's messages, so the count is derived here rather than
// shipped -- which also means it stays right as new messages arrive without
// asking the server again.
const cursors = ref<Record<string, string>>({});

export function useChatReadState() {
  async function hydrate() {
    try {
      const { threads } = await $fetch<{
        threads: Array<{ thread: string; lastReadAt: string }>;
      }>(`https://${useRuntimeConfig().public.apiDomain}/chat/threads`, {
        credentials: "include",
      });

      const next: Record<string, string> = {};
      for (const { thread, lastReadAt } of threads) {
        next[thread] = lastReadAt;
      }
      cursors.value = next;
    } catch {
      // Badges fall back to counting from this session only, which is what
      // they did before there was a cursor at all.
    }
  }

  // Called alongside socket.markLobbyRead so the badge clears immediately
  // rather than on the next hydrate, and so a room's history snapshot arriving
  // afterwards doesn't put it straight back.
  //
  // Optimistic, and from the wrong clock: message timestamps are the API's, and
  // this is the browser's. The server answers `chat:read` with what it wrote,
  // and setCursor below corrects it a round trip later.
  function markRead(type: string, lobbyId: string) {
    setCursor(chatThreadKey(type, lobbyId), new Date().toISOString());
  }

  // The cursor as the server holds it, keyed by the thread it sent back.
  function setCursor(thread: string, lastReadAt: string) {
    cursors.value = {
      ...cursors.value,
      [thread]: lastReadAt,
    };
  }

  function unreadSince(
    type: string,
    lobbyId: string,
    messages: Array<{ timestamp?: string; from?: { steam_id?: string } }>,
    mySteamId?: string | null,
  ) {
    const cursor = cursors.value[chatThreadKey(type, lobbyId)];
    const readAt = cursor ? new Date(cursor).getTime() : 0;

    return messages.filter((message) => {
      if (String(message?.from?.steam_id) === String(mySteamId)) {
        return false;
      }

      return new Date(message?.timestamp ?? 0).getTime() > readAt;
    }).length;
  }

  return { cursors, hydrate, markRead, setCursor, unreadSince };
}
