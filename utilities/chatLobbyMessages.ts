import type { LobbyMessage } from "~/web-sockets/Socket";

// The live `chat` event and the history snapshot sent on every (re)join can
// carry the same message, so a message needs an identity the client can compare
// them by. Anything written before the server started stamping an id falls back
// to a composite key.
export function chatMessageKey(message: LobbyMessage) {
  if (message?.id) {
    return message.id;
  }

  return [
    message?.from?.steam_id ?? "",
    message?.timestamp ?? "",
    message?.message ?? "",
  ].join("|");
}

export function chatMessageTime(message: LobbyMessage) {
  return new Date(message?.timestamp).getTime() || 0;
}

export function isChatMessageDeleted(
  message: LobbyMessage,
  deleted: ReadonlySet<string>,
) {
  return !!message?.id && deleted.has(message.id);
}

// The server sends its whole history for the room, so the snapshot replaces
// what we hold rather than being unioned into it. A union never drops what the
// server has since expired, and leaves the list growing for the life of the
// handle.
//
// Anything newer than the snapshot is kept: a live message can land in the
// window between the server building the snapshot and it arriving here. The
// same window means a snapshot can still carry a message deleted since, so the
// tombstones apply to both halves.
export function mergeChatSnapshot(
  current: LobbyMessage[],
  snapshot: LobbyMessage[] | null | undefined,
  deleted: ReadonlySet<string>,
) {
  const history = snapshot || [];
  const snapshotKeys = new Set(history.map(chatMessageKey));

  const newest = history.reduce(
    (latest, message) => Math.max(latest, chatMessageTime(message)),
    0,
  );

  const merged = history
    .concat(
      current.filter((message) => {
        return (
          !snapshotKeys.has(chatMessageKey(message)) &&
          chatMessageTime(message) >= newest
        );
      }),
    )
    .filter((message) => !isChatMessageDeleted(message, deleted));

  merged.sort((a, b) => chatMessageTime(a) - chatMessageTime(b));

  return merged;
}

export function insertChatMessage(
  current: LobbyMessage[],
  message: LobbyMessage,
) {
  const messages = current.slice();
  const timestamp = chatMessageTime(message);

  let index = messages.length;
  while (index > 0 && chatMessageTime(messages[index - 1]) > timestamp) {
    index--;
  }
  messages.splice(index, 0, message);

  return messages;
}

export interface RemovedChatMessage {
  messages: LobbyMessage[];
  message: LobbyMessage;
  index: number;
}

export function removeChatMessage(
  current: LobbyMessage[],
  messageId: string,
): RemovedChatMessage | null {
  const index = current.findIndex((message) => message?.id === messageId);

  if (index === -1) {
    return null;
  }

  const messages = current.slice();
  const [message] = messages.splice(index, 1);

  return { messages, message, index };
}
