import { CHAT_REACTIONS, type ChatReaction } from "~/constants/chat";
import type { ChatType, LobbyMessage } from "~/web-sockets/Socket";

// Must match the api's ChatService.SELF_SERVICE_WINDOW_MS.
export const SELF_SERVICE_WINDOW_MS = 600_000;

export interface ChatMessagePermissions {
  canDelete: boolean;
  canEdit: boolean;
  canReact: boolean;
  canAddReaction: boolean;
  canSanction: boolean;
}

export interface ChatMessagePermissionInput {
  message: LobbyMessage | null | undefined;
  viewerSteamId?: string | null;
  viewerGagged?: boolean;
  canModerate: boolean;
  canPost?: boolean;
  roomType: ChatType | string;
  now?: number;
}

export function isOwnChatMessage(
  message: LobbyMessage | null | undefined,
  viewerSteamId?: string | null,
) {
  const author = message?.from?.steam_id;

  if (!viewerSteamId || author === undefined || author === null) {
    return false;
  }

  return String(author) === String(viewerSteamId);
}

export function heldChatReactions(
  message: LobbyMessage | null | undefined,
  viewerSteamId?: string | null,
): Set<ChatReaction> {
  const held = new Set<ChatReaction>();

  if (!viewerSteamId) {
    return held;
  }

  for (const { id } of CHAT_REACTIONS) {
    const steamIds = message?.reactions?.[id];

    if (
      Array.isArray(steamIds) &&
      steamIds.some((steamId) => String(steamId) === String(viewerSteamId))
    ) {
      held.add(id);
    }
  }

  return held;
}

// Mirrors the api's ChatService.canDelete and selfServiceRefusal, so the menu
// never offers what the server would refuse. The api only addresses a message
// by its id; lines from before it stamped one can't be targeted at all, and
// lines stored before it recorded a source are nobody's to change. A gag stops
// an edit in a group room, like a send, but never the author's own delete.
//
// Reacting follows sending instead, on any line of any source. A gag in a group
// room stops adding a reaction but not taking one back, so a gagged player is
// only offered the reactions they already hold.
//
// A sanction is on the author, not the line, so it needs neither an id nor a
// source -- only someone other than the viewer to put it on.
//
// A line that is only files or a GIF has no text to edit, and the api refuses
// an edit that would leave it empty.
export function chatMessagePermissions({
  message,
  viewerSteamId,
  viewerGagged = false,
  canModerate,
  canPost = false,
  roomType,
  now = Date.now(),
}: ChatMessagePermissionInput): ChatMessagePermissions {
  const addressable = !!message?.id;

  const sentAt = new Date(message?.timestamp ?? NaN).getTime();

  const selfService =
    addressable &&
    message?.source === "web" &&
    isOwnChatMessage(message, viewerSteamId) &&
    Number.isFinite(sentAt) &&
    now - sentAt < SELF_SERVICE_WINDOW_MS;

  const gaggedHere = viewerGagged && roomType !== "direct";

  const reactor = addressable && canPost && !!viewerSteamId;

  const canAddReaction = reactor && !gaggedHere;

  return {
    canDelete:
      addressable && ((canModerate && roomType !== "direct") || selfService),
    canEdit: selfService && !gaggedHere && !!message?.message?.trim(),
    canReact:
      canAddReaction ||
      (reactor && heldChatReactions(message, viewerSteamId).size > 0),
    canAddReaction,
    canSanction:
      canModerate &&
      roomType !== "direct" &&
      !!message?.from?.steam_id &&
      !isOwnChatMessage(message, viewerSteamId),
  };
}

export function canToggleChatReaction(
  permissions: Pick<ChatMessagePermissions, "canReact" | "canAddReaction">,
  held: boolean,
) {
  return held ? permissions.canReact : permissions.canAddReaction;
}

// Every reaction, marked with whether the viewer holds it and whether they may
// toggle it -- what a picker lays out.
export function chatReactionChoices(
  message: LobbyMessage | null | undefined,
  viewerSteamId: string | null | undefined,
  permissions: Pick<ChatMessagePermissions, "canReact" | "canAddReaction">,
) {
  const held = heldChatReactions(message, viewerSteamId);

  return CHAT_REACTIONS.map(({ id, glyph }) => {
    const mine = held.has(id);

    return {
      id,
      glyph,
      mine,
      disabled: !canToggleChatReaction(permissions, mine),
    };
  });
}

export function hasChatMessageActions(permissions: ChatMessagePermissions) {
  return Object.values(permissions).some(Boolean);
}
