import type { ChatType, LobbyMessage } from "~/web-sockets/Socket";

// Must match the api's ChatService.SELF_SERVICE_WINDOW_MS.
export const SELF_SERVICE_WINDOW_MS = 600_000;

export interface ChatMessagePermissions {
  canDelete: boolean;
  canEdit: boolean;
}

export interface ChatMessagePermissionInput {
  message: LobbyMessage | null | undefined;
  viewerSteamId?: string | null;
  canModerate: boolean;
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

// Mirrors the api's ChatService.canDelete and selfServiceRefusal, so the menu
// never offers what the server would refuse. The api only addresses a message
// by its id; lines from before it stamped one can't be targeted at all, and
// lines stored before it recorded a source are nobody's to change.
export function chatMessagePermissions({
  message,
  viewerSteamId,
  canModerate,
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

  return {
    canDelete:
      addressable && ((canModerate && roomType !== "direct") || selfService),
    canEdit: selfService,
  };
}

export function hasChatMessageActions(permissions: ChatMessagePermissions) {
  return Object.values(permissions).some(Boolean);
}
