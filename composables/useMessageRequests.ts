import { computed, ref } from "vue";
import socket from "~/web-sockets/Socket";
import {
  directTabId,
  type DirectMessagePeer,
} from "~/composables/useDirectMessages";

// A first message from someone who is not a friend. It waits here rather than
// on the rail: no tab, no badge, no flash, so a flood of them cannot take over
// the chat. Replying accepts it; declining hides it, and the sender is never
// told. The server owns the state -- this mirrors it.
export interface MessageRequest {
  roomId: string;
  peer: DirectMessagePeer;
  unread: number;
}

const requestsRef = ref<MessageRequest[]>([]);
// Conversations the server says are waiting on the other side to reply to this
// player's request, and ones it says are not. A conversation started in this
// session is in neither, and is worked out from its messages instead.
const awaitingRef = ref<Set<string>>(new Set());
const settledRef = ref<Set<string>>(new Set());

function apiBase() {
  return `https://${useRuntimeConfig().public.apiDomain}/chat/direct/conversations`;
}

export function useMessageRequests() {
  const authStore = useAuthStore();
  const { relationship } = useFriendActions();

  const requests = computed(() => requestsRef.value);
  const requestCount = computed(() => requestsRef.value.length);

  function isRequest(roomId: string | undefined) {
    return (
      !!roomId && requestsRef.value.some((request) => request.roomId === roomId)
    );
  }

  function addRequest(request: MessageRequest) {
    const existing = requestsRef.value.find(
      ({ roomId }) => roomId === request.roomId,
    );

    if (existing) {
      existing.unread = Math.max(existing.unread, request.unread);
      return;
    }

    requestsRef.value = [request, ...requestsRef.value];
  }

  function removeRequest(roomId: string) {
    requestsRef.value = requestsRef.value.filter(
      (request) => request.roomId !== roomId,
    );
  }

  function setRequests(list: MessageRequest[]) {
    requestsRef.value = list;
  }

  // What the server last said about this player's side of a conversation.
  function setAwaitingReply(roomId: string, awaiting: boolean) {
    const awaitingRooms = new Set(awaitingRef.value);
    const settledRooms = new Set(settledRef.value);

    if (awaiting) {
      awaitingRooms.add(roomId);
      settledRooms.delete(roomId);
    } else {
      awaitingRooms.delete(roomId);
      settledRooms.add(roomId);
    }

    awaitingRef.value = awaitingRooms;
    settledRef.value = settledRooms;
  }

  // Whether this player has sent their one message and is waiting on a reply.
  // Anything from the other side ends the wait, whatever the server said last.
  function isAwaitingReply(
    roomId: string | undefined,
    peerSteamId: string | undefined,
  ): boolean {
    const me = authStore.me?.steam_id;

    if (!roomId || !peerSteamId || !me) {
      return false;
    }

    const messages = socket.lobbyMessages("direct", roomId);
    const fromPeer = messages.some(
      (message) => String(message.from?.steam_id) === String(peerSteamId),
    );

    if (fromPeer) {
      return false;
    }

    if (awaitingRef.value.has(roomId)) {
      return true;
    }

    if (
      settledRef.value.has(roomId) ||
      relationship(peerSteamId) === "friend"
    ) {
      return false;
    }

    return messages.some(
      (message) => String(message.from?.steam_id) === String(me),
    );
  }

  // Replying is what accepts a request, so once this player has written in it,
  // it is an ordinary conversation.
  function acceptIfReplied(roomId: string) {
    const me = authStore.me?.steam_id;

    if (
      me &&
      isRequest(roomId) &&
      socket
        .lobbyMessages("direct", roomId)
        .some((message) => String(message.from?.steam_id) === String(me))
    ) {
      removeRequest(roomId);
      setAwaitingReply(roomId, false);
    }
  }

  async function decline(roomId: string) {
    await $fetch(`${apiBase()}/${encodeURIComponent(roomId)}/decline`, {
      method: "POST",
      credentials: "include",
    });

    removeRequest(roomId);
    useChatTabs().closeTab(directTabId(roomId));
  }

  function reset() {
    requestsRef.value = [];
    awaitingRef.value = new Set();
    settledRef.value = new Set();
  }

  return {
    requests,
    requestCount,
    isRequest,
    addRequest,
    removeRequest,
    setRequests,
    setAwaitingReply,
    isAwaitingReply,
    acceptIfReplied,
    decline,
    reset,
  };
}
