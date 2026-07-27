import { ref } from "vue";
import { toast } from "@/components/ui/toast";
import { captureVideoSnapshot } from "~/composables/useEventMediaUpload";

// Routing is by SIZE: anything ≤ DIRECT_MAX_SIZE posts through the API exactly
// like a news image. Bigger files take the S3 multipart bypass — Cloudflare
// caps proxied request bodies at ~100MB and times slow ones out.
const MAX_SIZE = 512 * 1024 * 1024;
const DIRECT_MAX_SIZE = 90 * 1024 * 1024;

export const NEWS_VIDEO_ACCEPT = "video/mp4";

export interface NewsVideoUploadResult {
  src: string;
  poster: string | null;
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

export function useNewsVideoUpload() {
  const uploading = ref(false);
  const progress = ref(0);

  const { upload: uploadImage } = useNewsImageUpload();

  const videoUrl = (filename: string) =>
    `https://${useRuntimeConfig().public.apiDomain}/news/video/${filename}`;

  const upload = async (
    file: File,
    opts?: { onProgress?: (percent: number) => void },
  ): Promise<NewsVideoUploadResult | null> => {
    const t = useNuxtApp().$i18n.t;
    const report = (percent: number) => {
      progress.value = percent;
      opts?.onProgress?.(percent);
    };

    if (file.type !== "video/mp4") {
      toast({
        title: t("avatar.invalid_type") as string,
        variant: "destructive",
      });
      return null;
    }

    if (file.size > MAX_SIZE) {
      toast({
        title: t("avatar.too_large", {
          size: Math.round(MAX_SIZE / 1024 / 1024),
        }) as string,
        variant: "destructive",
      });
      return null;
    }

    uploading.value = true;
    report(0);
    try {
      // Poster capture decodes the local file — start it alongside the upload
      // instead of after, so it doesn't extend the "processing" tail.
      const snapshotPromise = captureVideoSnapshot(file).catch(() => null);

      const filename =
        file.size > DIRECT_MAX_SIZE
          ? await uploadMultipart(file, report)
          : await uploadDirect(file, report);

      // Best-effort poster; the player falls back to a black first frame.
      const snapshot = await snapshotPromise;
      const poster = snapshot
        ? await uploadImage(snapshot).catch(() => null)
        : null;

      return { src: videoUrl(filename), poster };
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

  // XMLHttpRequest instead of fetch: fetch cannot report upload progress, and
  // without it the bar sits at 0% until the whole body has been sent.
  const uploadDirect = (
    file: File,
    report: (percent: number) => void,
  ): Promise<string> => {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const formData = new FormData();
    formData.append("file", file, file.name || "video.mp4");

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://${apiDomain}/news/upload/video`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          report(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          report(100);
          resolve(
            (JSON.parse(xhr.responseText) as { filename: string }).filename,
          );
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

  const uploadMultipart = async (
    file: File,
    report: (percent: number) => void,
  ): Promise<string> => {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const base = `https://${apiDomain}/news/upload`;

    const initiate = await fetch(`${base}/initiate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileSize: file.size }),
    });
    if (!initiate.ok) {
      throw new Error(
        (await initiate.text()) || `could not start upload (${initiate.status})`,
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
        }),
      });
      if (!complete.ok) {
        throw new Error(
          (await complete.text()) || `upload failed (${complete.status})`,
        );
      }
      return (await complete.json() as { filename: string }).filename;
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

  return { upload, uploading, progress, accept: NEWS_VIDEO_ACCEPT };
}
