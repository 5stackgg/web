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
// Counting a room's history before the cursors arrive counts every line in it
// as unread, so a recount waits for them, the latest one per room.
const hydrated = ref(false);
const waiting = new Map<string, () => void>();
// How far each thread has been seen, which is what a line tagging the viewer
// stays lit against. Unlike the cursor it holds still while the room is open --
// the cursor moves the moment a line is read, so a mention would go dark as it
// arrived -- and moves on only when the room is left. Nothing is lit until the
// server has said where each thread was left, or every old tag would light up.
const seenUntil = ref<Record<string, number>>({});
const seenHydrated = ref(false);

export function useChatReadState() {
  async function hydrate() {
    hydrated.value = false;
    seenHydrated.value = false;

    try {
      const { threads } = await $fetch<{
        threads: Array<{ thread: string; lastReadAt: string }>;
      }>(`https://${useRuntimeConfig().public.apiDomain}/chat/threads`, {
        credentials: "include",
      });

      const next: Record<string, string> = {};
      const seen: Record<string, number> = {};
      for (const { thread, lastReadAt } of threads) {
        next[thread] = lastReadAt;
        seen[thread] = new Date(lastReadAt).getTime();
      }
      cursors.value = next;
      seenUntil.value = seen;
      seenHydrated.value = true;
    } catch {
      // Badges fall back to counting from this session only, which is what
      // they did before there was a cursor at all.
    } finally {
      hydrated.value = true;

      const recounts = [...waiting.values()];
      waiting.clear();
      for (const recount of recounts) {
        recount();
      }
    }
  }

  function afterHydrated(key: string, recount: () => void) {
    if (hydrated.value) {
      recount();
      return;
    }

    waiting.set(key, recount);
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

  function isUnread(
    type: string,
    lobbyId: string,
    message: { timestamp?: string; from?: { steam_id?: string } },
    mySteamId?: string | null,
  ) {
    if (String(message?.from?.steam_id) === String(mySteamId)) {
      return false;
    }

    const cursor = cursors.value[chatThreadKey(type, lobbyId)];
    const readAt = cursor ? new Date(cursor).getTime() : 0;

    return new Date(message?.timestamp ?? 0).getTime() > readAt;
  }

  // Up to the latest line the room had on screen when it was left.
  function markSeen(type: string, lobbyId: string, at: number) {
    const thread = chatThreadKey(type, lobbyId);

    if (!(at > (seenUntil.value[thread] ?? 0))) {
      return;
    }

    seenUntil.value = { ...seenUntil.value, [thread]: at };
  }

  function isUnseen(type: string, lobbyId: string, timestamp?: string) {
    if (!seenHydrated.value) {
      return false;
    }

    const seen = seenUntil.value[chatThreadKey(type, lobbyId)] ?? 0;

    return new Date(timestamp ?? 0).getTime() > seen;
  }

  return {
    cursors,
    hydrate,
    afterHydrated,
    isUnread,
    markRead,
    setCursor,
    markSeen,
    isUnseen,
  };
}
