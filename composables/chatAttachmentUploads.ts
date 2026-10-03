import { captureVideoSnapshot } from "~/composables/useEventMediaUpload";
import {
  ChatUploadError,
  type ChatUploadHooks,
  type ChatUploadRoom,
} from "~/composables/useChatComposerAttachments";
import type { ChatAttachment } from "~/utilities/chatAttachments";

const apiBase = () => `https://${useRuntimeConfig().public.apiDomain}/chat`;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function chatAttachmentUrl(id: string): string {
  return UUID.test(id) ? `${apiBase()}/attachments/${id}` : "";
}

export function chatAttachmentPosterUrl(id: string): string {
  const url = chatAttachmentUrl(id);

  return url ? `${url}/poster` : "";
}

// Must match the api's ChatAttachmentsService.MAX_UPLOADS_PER_PLAYER: it
// answers 429 to a third part from the same player, so the whole tray shares
// two at a time. A 429 can still come from the api pod's own limit, so that
// part is sent again after a pause rather than the file started over.
const PARTS_IN_FLIGHT = 2;
const RATE_LIMIT_RETRIES = 6;
const RATE_LIMIT_BACKOFF_MS = 400;

let partsInFlight = 0;
const waitingForPart: Array<() => void> = [];

async function withPartSlot<T>(
  signal: AbortSignal,
  work: () => Promise<T>,
): Promise<T> {
  while (partsInFlight >= PARTS_IN_FLIGHT) {
    await new Promise<void>((resolve) => waitingForPart.push(resolve));
    stopIfAborted(signal);
  }

  partsInFlight++;

  try {
    return await work();
  } finally {
    partsInFlight--;
    waitingForPart.shift()?.();
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ChatUploadError("aborted"));
      },
      { once: true },
    );
  });
}

async function putPart(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withPartSlot(signal, () =>
        put(url, body, signal, onProgress),
      );
    } catch (error) {
      if (
        !(error instanceof ChatUploadError) ||
        error.code !== "rate_limited" ||
        attempt >= RATE_LIMIT_RETRIES
      ) {
        throw error;
      }

      onProgress(0);
      await pause(RATE_LIMIT_BACKOFF_MS * 2 ** attempt, signal);
    }
  }
}

function stopIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new ChatUploadError("aborted");
  }
}

async function request<T>(
  method: "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await $fetch<T>(`${apiBase()}${path}`, {
      method,
      body,
      credentials: "include",
    });
  } catch (error) {
    const failure = error as { data?: { code?: string }; status?: number };

    throw new ChatUploadError(
      failure?.data?.code ??
        (failure?.status === 413 ? "too_large" : "unavailable"),
    );
  }
}

function errorCode(xhr: XMLHttpRequest): string {
  const fallback = xhr.status === 413 ? "too_large" : "unavailable";

  try {
    const code = JSON.parse(xhr.responseText)?.code;

    return typeof code === "string" ? code : fallback;
  } catch {
    return fallback;
  }
}

// Raw bytes, never a multipart form: a part is one request to the api, kept
// well under Cloudflare's 100 MB body cap. XHR because fetch cannot report
// upload progress; a Blob body always goes with its Content-Length, never
// chunked, and the api refuses a part without one.
function put(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ChatUploadError("aborted"));
      return;
    }

    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();

    xhr.open("PUT", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      signal.removeEventListener("abort", abort);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new ChatUploadError(errorCode(xhr)));
    };

    xhr.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(new ChatUploadError("unavailable"));
    };

    xhr.onabort = () => {
      reject(new ChatUploadError("aborted"));
    };

    signal.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const finish = (size: { width?: number; height?: number }) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };

    image.onload = () =>
      finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish({});
    image.src = url;
  });
}

function videoSize(
  file: File,
): Promise<{ width?: number; height?: number; duration_ms?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (size: {
      width?: number;
      height?: number;
      duration_ms?: number;
    }) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(size);
    };
    const timeout = setTimeout(() => finish({}), 10_000);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      finish({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration_ms: Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : undefined,
      });
    video.onerror = () => finish({});
    video.src = url;
  });
}

async function readMeta(file: File) {
  if (file.type.startsWith("video/")) {
    const [size, poster] = await Promise.all([
      videoSize(file),
      captureVideoSnapshot(file).catch(() => null),
    ]);

    return { ...size, poster };
  }

  return { ...(await imageSize(file)), poster: null };
}

export async function uploadChatAttachment(
  file: File,
  room: ChatUploadRoom,
  hooks: ChatUploadHooks,
): Promise<ChatAttachment> {
  const { poster, ...meta } = await readMeta(file);

  stopIfAborted(hooks.signal);

  const created = await request<{
    id: string;
    part_size: number;
    parts: number;
  }>("POST", "/attachments", {
    type: room.type,
    id: room.id,
    name: file.name,
    size: file.size,
    mime_type: file.type,
    ...meta,
  });

  hooks.onCreated(created.id);
  stopIfAborted(hooks.signal);

  const url = chatAttachmentUrl(created.id);

  if (!url) {
    throw new ChatUploadError("unavailable");
  }

  for (let part = 1; part <= created.parts; part++) {
    const start = (part - 1) * created.part_size;
    const chunk = file.slice(start, Math.min(start + created.part_size, file.size));

    await putPart(`${url}/parts/${part}`, chunk, hooks.signal, (loaded) => {
      hooks.onProgress(((start + loaded) / file.size) * 0.98);
    });
  }

  if (poster) {
    await putPart(`${url}/poster`, poster, hooks.signal, () => {}).catch(
      () => {
        return;
      },
    );
  }

  stopIfAborted(hooks.signal);

  const attachment = await request<ChatAttachment>(
    "POST",
    `/attachments/${created.id}/complete`,
  );

  hooks.onProgress(1);

  return attachment;
}

export function discardChatAttachment(id: string): void {
  if (!UUID.test(id)) {
    return;
  }

  void request("DELETE", `/attachments/${id}`).catch(() => {
    return;
  });
}
