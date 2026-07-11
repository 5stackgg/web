import { ref } from "vue";
import { toast } from "@/components/ui/toast";

// Per-type caps; routing is by SIZE, not type: anything ≤ DIRECT_MAX_SIZE
// posts through the API exactly like avatar/news uploads. Only bigger files
// (long mp4s) take the multipart bypass — Cloudflare caps proxied bodies at
// ~100MB and times slow ones out, the same reason demo uploads bypass it.
const MAX_SIZE_BY_TYPE: Record<string, number> = {
  "image/png": 10 * 1024 * 1024,
  "image/jpeg": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/gif": 10 * 1024 * 1024,
  "video/mp4": 512 * 1024 * 1024,
  "audio/mpeg": 50 * 1024 * 1024,
};
const DIRECT_MAX_SIZE = 90 * 1024 * 1024;

export const EVENT_MEDIA_ACCEPT = Object.keys(MAX_SIZE_BY_TYPE).join(",");

export function eventMediaUrl(eventId: string, filename: string): string {
  const apiDomain = useRuntimeConfig().public.apiDomain;
  return `https://${apiDomain}/events/media/${eventId}/${filename}`;
}

// Captures a poster frame from a local video file (no network: the uploader
// already has the bytes) so gallery tiles never have to fetch the mp4.
export function captureVideoSnapshot(file: File | Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const finish = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };

    const timeout = setTimeout(() => finish(null), 10_000);

    video.onerror = () => {
      clearTimeout(timeout);
      finish(null);
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1280 / (video.videoWidth || 1280));
        canvas.width = Math.round((video.videoWidth || 1280) * scale);
        canvas.height = Math.round((video.videoHeight || 720) * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), "image/webp", 0.85);
      } catch {
        finish(null);
      }
    };
  });
}

function putChunk(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`chunk upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(chunk);
  });
}

export function useEventMediaUpload(eventId: () => string) {
  const uploading = ref(false);
  const progress = ref(0);

  const upload = async (
    file: File | Blob,
    opts?: { silent?: boolean; onProgress?: (percent: number) => void },
  ): Promise<{ id: string; filename: string } | null> => {
    const t = useNuxtApp().$i18n.t;
    const report = (percent: number) => {
      progress.value = percent;
      opts?.onProgress?.(percent);
    };

    const maxSize = MAX_SIZE_BY_TYPE[file.type];
    if (maxSize === undefined) {
      toast({
        title: t("avatar.invalid_type") as string,
        variant: "destructive",
      });
      return null;
    }

    if (file.size > maxSize) {
      toast({
        title: t("avatar.too_large", {
          size: Math.round(maxSize / 1024 / 1024),
        }) as string,
        variant: "destructive",
      });
      return null;
    }

    uploading.value = true;
    report(0);
    try {
      // Poster capture decodes the local file — start it alongside the
      // upload instead of after, so it doesn't extend the "processing" tail.
      const snapshotPromise = file.type.startsWith("video/")
        ? captureVideoSnapshot(file).catch(() => null)
        : null;
      const result =
        file.size > DIRECT_MAX_SIZE
          ? await uploadMultipart(file as File, report)
          : await uploadDirect(file, report);
      if (snapshotPromise) {
        // Best-effort poster; the tile falls back to an icon without one.
        const snapshot = await snapshotPromise;
        if (snapshot) {
          await uploadThumbnail(result.id, snapshot).catch(() => {});
        }
      }
      if (!opts?.silent) {
        toast({ title: t("event.media.uploaded") as string });
      }
      return result;
    } catch (error: any) {
      toast({
        title: t("avatar.upload_failed") as string,
        description: error?.message,
        variant: "destructive",
      });
      return null;
    } finally {
      uploading.value = false;
    }
  };

  // XMLHttpRequest instead of fetch: fetch cannot report upload progress,
  // and without it the bar sits at 0% until the whole body has been sent.
  const uploadDirect = (
    file: File | Blob,
    report: (percent: number) => void,
  ): Promise<{ id: string; filename: string }> => {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const formData = new FormData();
    formData.append("file", file, (file as File).name || "media");

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://${apiDomain}/events/media/${eventId()}/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          report(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          report(100);
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(
            new Error(xhr.responseText || `upload failed (${xhr.status})`),
          );
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(formData);
    });
  };

  const uploadThumbnail = async (mediaId: string, snapshot: Blob) => {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const formData = new FormData();
    formData.append("file", snapshot, "thumbnail.webp");
    await fetch(
      `https://${apiDomain}/events/media/${eventId()}/${mediaId}/thumbnail`,
      { method: "POST", body: formData, credentials: "include" },
    );
  };

  const uploadMultipart = async (
    file: File,
    report: (percent: number) => void,
  ): Promise<{ id: string; filename: string }> => {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const base = `https://${apiDomain}/events/media/${eventId()}`;

    const initiate = await fetch(`${base}/initiate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
    });
    if (!initiate.ok) {
      throw new Error(
        (await initiate.text()) ||
          `could not start upload (${initiate.status})`,
      );
    }
    const session = (await initiate.json()) as {
      uploadId: string;
      key: string;
      chunkSize: number;
      parts: Array<{ partNumber: number; url: string }>;
    };

    try {
      let uploadedBytes = 0;
      for (const part of session.parts) {
        const start = (part.partNumber - 1) * session.chunkSize;
        const chunk = file.slice(start, start + session.chunkSize);
        await putChunk(part.url, chunk, (loaded) => {
          report(Math.round(((uploadedBytes + loaded) / file.size) * 100));
        });
        uploadedBytes += chunk.size;
      }
      report(100);

      const complete = await fetch(`${base}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: session.uploadId,
          key: session.key,
          fileName: file.name,
        }),
      });
      if (!complete.ok) {
        throw new Error(
          (await complete.text()) || `upload failed (${complete.status})`,
        );
      }
      return (await complete.json()) as { id: string; filename: string };
    } catch (error) {
      void fetch(`${base}/abort`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: session.uploadId, key: session.key }),
      }).catch(() => {});
      throw error;
    }
  };

  return { upload, uploading, progress, accept: EVENT_MEDIA_ACCEPT };
}
