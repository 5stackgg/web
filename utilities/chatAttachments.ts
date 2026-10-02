// Must match the api's ChatAttachmentsService: match and team rooms are relayed
// into the game server, which shows only text.
export const CHAT_ATTACHMENT_ROOMS = [
  "matchmaking",
  "tournament",
  "organizers",
  "draft",
  "direct",
] as const;

export type ChatAttachmentKind = "image" | "video";

export interface ChatAttachment {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  duration_ms?: number;
  poster?: boolean;
}

export interface ChatGif {
  id: string;
  width: number;
  height: number;
}

export interface ChatGifResult extends ChatGif {
  title: string;
}

export interface ChatAttachmentConfig {
  max_files: number;
  max_file_bytes: number;
  part_size: number;
  mime_types: string[];
  gifs: boolean;
}

export type ChatFileRejection = {
  file: File;
  reason: "type" | "size" | "count";
};

export type ChatTrayStatus = "uploading" | "done" | "failed";

export interface ChatTrayItem {
  key: string;
  name: string;
  kind: ChatAttachmentKind;
  size: number;
  status: ChatTrayStatus;
  progress: number;
  previewUrl?: string;
  error?: string;
}

const GIPHY_ID = /^[A-Za-z0-9]{1,64}$/;

export function chatRoomTakesAttachments(type?: string | null): boolean {
  return (CHAT_ATTACHMENT_ROOMS as readonly string[]).includes(type ?? "");
}

export function chatAttachmentKind(mimeType: string): ChatAttachmentKind | null {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return null;
}

export function pickChatFiles(
  files: ArrayLike<File>,
  held: number,
  config: ChatAttachmentConfig | null,
): { accepted: File[]; rejected: ChatFileRejection[] } {
  const accepted: File[] = [];
  const rejected: ChatFileRejection[] = [];

  for (const file of Array.from(files)) {
    if (!config || !config.mime_types.includes(file.type)) {
      rejected.push({ file, reason: "type" });
      continue;
    }

    if (file.size <= 0 || file.size > config.max_file_bytes) {
      rejected.push({ file, reason: "size" });
      continue;
    }

    if (held + accepted.length >= config.max_files) {
      rejected.push({ file, reason: "count" });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}

export function chatComposerCanSend(
  text: string,
  items: ReadonlyArray<Pick<ChatTrayItem, "status">>,
): boolean {
  if (items.some(({ status }) => status !== "done")) {
    return false;
  }

  return text.trim().length > 0 || items.length > 0;
}

// The id is all a message carries, so it can never point anywhere but GIPHY.
export function chatGifUrl(id: string, size: "preview" | "full"): string {
  if (!GIPHY_ID.test(id)) {
    return "";
  }

  return `https://i.giphy.com/media/${id}/${size === "preview" ? "200w" : "giphy"}.webp`;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function chatMediaLabel(
  message: {
    message?: string;
    attachments?: ChatAttachment[];
    gif?: ChatGif | null;
  },
  t: Translate,
): string {
  if (message.message?.trim()) {
    return message.message;
  }

  if (message.gif) {
    return t("chat.gifs.label");
  }

  const count = message.attachments?.length ?? 0;

  if (count > 1) {
    return t("chat.attachments.label_count", { count });
  }

  return count === 1 ? t("chat.attachments.label") : "";
}

export function formatChatDuration(ms?: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    return "";
  }

  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  }

  return `${minutes}:${seconds}`;
}
