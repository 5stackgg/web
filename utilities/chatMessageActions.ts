import type { ChatType, LobbyMessage } from "~/web-sockets/Socket";

export interface ChatMessagePermissions {
  canDelete: boolean;
}

export interface ChatMessagePermissionInput {
  message: LobbyMessage | null | undefined;
  viewerSteamId?: string | null;
  canModerate: boolean;
  roomType: ChatType | string;
}

// Mirrors the api's ChatService.canDelete, so the menu never offers what the
// server would refuse. The api only addresses a message by its id; lines from
// before it stamped one can't be targeted at all.
export function chatMessagePermissions({
  message,
  canModerate,
  roomType,
}: ChatMessagePermissionInput): ChatMessagePermissions {
  const addressable = !!message?.id;

  return {
    canDelete: addressable && canModerate && roomType !== "direct",
  };
}

export function hasChatMessageActions(permissions: ChatMessagePermissions) {
  return Object.values(permissions).some(Boolean);
}
