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
//
// The same goes for an edit: a message is never un-edited, so a snapshot copy
// older than the edit this client already applied keeps the edit.
export function mergeChatSnapshot(
  current: LobbyMessage[],
  snapshot: LobbyMessage[] | null | undefined,
  deleted: ReadonlySet<string>,
) {
  const edited = new Map<string, LobbyMessage>();
  for (const message of current) {
    if (message?.id && message.edited_at) {
      edited.set(message.id, message);
    }
  }

  const history = (snapshot || []).map((message) =>
    keepNewerEdit(message, message?.id ? edited.get(message.id) : undefined),
  );
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

function editTime(message: LobbyMessage | undefined) {
  return new Date(message?.edited_at ?? 0).getTime() || 0;
}

function keepNewerEdit(
  snapshot: LobbyMessage,
  held: LobbyMessage | undefined,
) {
  if (!held || editTime(held) <= editTime(snapshot)) {
    return snapshot;
  }

  return { ...snapshot, message: held.message, edited_at: held.edited_at };
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

// A conversation's unread count comes from the server, which counts every
// message from the other party after the read cursor -- which are always the
// newest of theirs. So the ids behind the count can be read off the room
// without trusting this browser's copy of the cursor.
export function newestMessageIdsFrom(
  messages: readonly LobbyMessage[],
  count: number,
  viewerSteamId?: string | null,
): string[] {
  if (count <= 0) {
    return [];
  }

  return messages
    .filter(
      (message) =>
        !!message?.id &&
        String(message.from?.steam_id) !== String(viewerSteamId),
    )
    .slice(-count)
    .map((message) => message.id as string);
}

export interface ChatMessageEdit {
  id?: string;
  message?: string;
  edited_at?: string;
}

// An edit can race a delete and arrive after it, so it only ever changes a
// message this client still holds and never brings one back.
export function applyChatMessageEdit(
  current: LobbyMessage[],
  edit: ChatMessageEdit | null | undefined,
  deleted: ReadonlySet<string>,
): LobbyMessage[] | null {
  const id = edit?.id;

  if (typeof id !== "string" || !id || typeof edit?.message !== "string") {
    return null;
  }

  if (deleted.has(id)) {
    return null;
  }

  const index = current.findIndex((message) => message?.id === id);

  if (index === -1) {
    return null;
  }

  const messages = current.slice();
  messages[index] = {
    ...messages[index],
    message: edit.message,
    edited_at: edit.edited_at ?? new Date().toISOString(),
  };

  return messages;
}
