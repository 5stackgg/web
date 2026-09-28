import type { ChatReactions, LobbyMessage } from "~/web-sockets/Socket";

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
//
// Reactions carry no version to compare. `reacted` names the messages whose
// reactions changed live after this snapshot was asked for, and for those the
// live state wins: the snapshot may have been read before it. Were the snapshot
// the newer one after all, the event for the toggle it saw is still on its way
// and replaces the state again.
export function mergeChatSnapshot(
  current: LobbyMessage[],
  snapshot: LobbyMessage[] | null | undefined,
  deleted: ReadonlySet<string>,
  reacted: ReadonlySet<string> = new Set(),
) {
  const held = new Map<string, LobbyMessage>();
  for (const message of current) {
    if (message?.id && (message.edited_at || reacted.has(message.id))) {
      held.set(message.id, message);
    }
  }

  const history = (snapshot || []).map((message) => {
    const mine = message?.id ? held.get(message.id) : undefined;

    return keepLiveReactions(keepNewerEdit(message, mine), mine, reacted);
  });
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

function editTime(message: { edited_at?: string }) {
  return new Date(message.edited_at ?? 0).getTime() || 0;
}

// Two tabs can edit one message, and each edit's ack and broadcast land in
// any order, so an older server stamp never replaces a newer one. A stamp
// taken from this browser's clock can't be ordered against the server's: the
// server's stamp always replaces it.
function isOlderEdit(edit: { edited_at?: string }, held: LobbyMessage) {
  if (!edit.edited_at || held.__edited_locally) {
    return false;
  }

  return editTime(edit) < editTime(held);
}

function keepNewerEdit(
  snapshot: LobbyMessage,
  held: LobbyMessage | undefined,
) {
  if (!held || (snapshot.edited_at && !isOlderEdit(snapshot, held))) {
    return snapshot;
  }

  const kept: LobbyMessage = {
    ...snapshot,
    message: held.message,
    edited_at: held.edited_at,
  };

  if (held.__edited_locally) {
    kept.__edited_locally = true;
  }

  return kept;
}

function keepLiveReactions(
  snapshot: LobbyMessage,
  held: LobbyMessage | undefined,
  reacted: ReadonlySet<string>,
) {
  if (!held?.id || !reacted.has(held.id)) {
    return snapshot;
  }

  return { ...snapshot, reactions: held.reactions };
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

  if (isOlderEdit(edit, current[index])) {
    return null;
  }

  const edited: LobbyMessage = {
    ...current[index],
    message: edit.message,
    edited_at: edit.edited_at ?? new Date().toISOString(),
  };

  if (edit.edited_at) {
    delete edited.__edited_locally;
  } else {
    edited.__edited_locally = true;
  }

  const messages = current.slice();
  messages[index] = edited;

  return messages;
}

export interface ChatMessageReactionsUpdate {
  id?: string;
  reactions?: ChatReactions;
}

// Each update is the message's whole reaction state, so it replaces what is
// held. Like an edit, it never brings back a message this client doesn't hold.
export function applyChatMessageReactions(
  current: LobbyMessage[],
  update: ChatMessageReactionsUpdate | null | undefined,
  deleted: ReadonlySet<string>,
): LobbyMessage[] | null {
  const id = update?.id;
  const reactions = update?.reactions;

  if (typeof id !== "string" || !id || deleted.has(id)) {
    return null;
  }

  if (
    !reactions ||
    typeof reactions !== "object" ||
    Array.isArray(reactions)
  ) {
    return null;
  }

  const index = current.findIndex((message) => message?.id === id);

  if (index === -1) {
    return null;
  }

  const messages = current.slice();
  messages[index] = { ...messages[index], reactions };

  return messages;
}
