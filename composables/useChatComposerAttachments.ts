import { computed, ref } from "vue";
import {
  chatAttachmentKind,
  pickChatFiles,
  type ChatAttachment,
  type ChatAttachmentConfig,
  type ChatFileRejection,
  type ChatTrayItem,
} from "~/utilities/chatAttachments";

export class ChatUploadError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ChatUploadError";
  }
}

export interface ChatUploadRoom {
  type: string;
  id: string;
}

export interface ChatUploadHooks {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
  onCreated: (id: string) => void;
}

export type ChatAttachmentUploader = (
  file: File,
  room: ChatUploadRoom,
  hooks: ChatUploadHooks,
) => Promise<ChatAttachment>;

interface Entry {
  file: File;
  room: ChatUploadRoom;
  controller?: AbortController;
  serverId?: string;
  attachment?: ChatAttachment;
  removed?: boolean;
}

// The composer's tray. A file starts uploading the moment it is picked, so by
// the time the message is written it is usually already there; the message
// carries only the ids. Anything taken out of the tray, or left in it when the
// composer goes away, is deleted from the api straight away rather than left
// for the api's 24 hour sweep.
export function createChatComposerAttachments(options: {
  room: () => ChatUploadRoom | null;
  config: () => ChatAttachmentConfig | null;
  upload: ChatAttachmentUploader;
  discard: (id: string) => void;
  onRejected?: (rejections: ChatFileRejection[]) => void;
}) {
  const items = ref<ChatTrayItem[]>([]);
  const entries = new Map<string, Entry>();
  let sequence = 0;

  const ready = computed(
    () =>
      items.value.length > 0 &&
      items.value.every(({ status }) => status === "done"),
  );

  function patch(key: string, changes: Partial<ChatTrayItem>) {
    const index = items.value.findIndex((item) => item.key === key);

    if (index === -1) {
      return;
    }

    items.value.splice(index, 1, { ...items.value[index], ...changes });
  }

  function previewOf(file: File): string | undefined {
    try {
      return URL.createObjectURL(file);
    } catch {
      return undefined;
    }
  }

  function release(key: string) {
    const url = items.value.find((item) => item.key === key)?.previewUrl;

    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        return;
      }
    }
  }

  function start(key: string) {
    const entry = entries.get(key);

    if (!entry) {
      return;
    }

    const controller = new AbortController();
    entry.controller = controller;
    entry.serverId = undefined;
    entry.attachment = undefined;

    const current = () =>
      entries.get(key) === entry &&
      entry.controller === controller &&
      !controller.signal.aborted;

    patch(key, { status: "uploading", progress: 0, error: undefined });

    options
      .upload(entry.file, entry.room, {
        signal: controller.signal,
        onProgress: (fraction) => {
          if (current()) {
            patch(key, { progress: Math.max(0, Math.min(1, fraction)) });
          }
        },
        onCreated: (id) => {
          if (current()) {
            entry.serverId = id;
            return;
          }

          options.discard(id);
        },
      })
      .then((attachment) => {
        if (!current()) {
          if (attachment.id !== entry.serverId) {
            options.discard(attachment.id);
          }
          return;
        }

        entry.attachment = attachment;
        entry.serverId = attachment.id;
        patch(key, { status: "done", progress: 1 });
      })
      .catch((error: unknown) => {
        if (!current()) {
          return;
        }

        patch(key, {
          status: "failed",
          error: error instanceof ChatUploadError ? error.code : "unavailable",
        });
      });
  }

  function add(files: ArrayLike<File>) {
    const room = options.room();

    if (!room) {
      return;
    }

    const { accepted, rejected } = pickChatFiles(
      files,
      items.value.length,
      options.config(),
    );

    if (rejected.length > 0) {
      options.onRejected?.(rejected);
    }

    for (const file of accepted) {
      const key = `${Date.now().toString(36)}-${sequence++}`;

      entries.set(key, { file, room: { ...room } });
      items.value.push({
        key,
        name: file.name,
        kind: chatAttachmentKind(file.type) ?? "image",
        size: file.size,
        status: "uploading",
        progress: 0,
        previewUrl: previewOf(file),
      });

      start(key);
    }
  }

  function drop(key: string) {
    const entry = entries.get(key);

    if (!entry) {
      return;
    }

    entry.removed = true;
    entry.controller?.abort();

    if (entry.serverId) {
      options.discard(entry.serverId);
    }

    release(key);
    entries.delete(key);
  }

  function remove(key: string) {
    drop(key);
    items.value = items.value.filter((item) => item.key !== key);
  }

  function retry(key: string) {
    const entry = entries.get(key);

    if (!entry) {
      return;
    }

    if (entry.serverId) {
      options.discard(entry.serverId);
    }

    start(key);
  }

  // Sent: the files belong to the message now, so nothing is discarded.
  function take(): string[] {
    const ids = items.value
      .map((item) => entries.get(item.key)?.attachment?.id)
      .filter((id): id is string => !!id);

    for (const item of items.value) {
      release(item.key);
    }

    entries.clear();
    items.value = [];

    return ids;
  }

  function dispose() {
    for (const key of [...entries.keys()]) {
      drop(key);
    }

    items.value = [];
  }

  return { items, ready, add, remove, retry, take, dispose };
}
