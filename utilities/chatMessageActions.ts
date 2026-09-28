import { CHAT_REACTIONS, type ChatReaction } from "~/constants/chat";
import type { ChatType, LobbyMessage } from "~/web-sockets/Socket";

// Must match the api's ChatService.SELF_SERVICE_WINDOW_MS.
export const SELF_SERVICE_WINDOW_MS = 600_000;

export interface ChatMessagePermissions {
  canDelete: boolean;
  canEdit: boolean;
  canReact: boolean;
  canAddReaction: boolean;
}

export interface ChatMessagePermissionInput {
  message: LobbyMessage | null | undefined;
  viewerSteamId?: string | null;
  viewerGagged?: boolean;
  canModerate: boolean;
  // Whether the viewer may send in this room at all.
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
    canEdit: selfService && !gaggedHere,
    canReact:
      canAddReaction ||
      (reactor && heldChatReactions(message, viewerSteamId).size > 0),
    canAddReaction,
  };
}

export function canToggleChatReaction(
  permissions: Pick<ChatMessagePermissions, "canReact" | "canAddReaction">,
  held: boolean,
) {
  return held ? permissions.canReact : permissions.canAddReaction;
}

export function hasChatMessageActions(permissions: ChatMessagePermissions) {
  return Object.values(permissions).some(Boolean);
}
