// Client-side image helpers for the roster image uploader.

/**
 * Decode `file` and, if its longest edge exceeds `maxEdge`, redraw it at the
 * scaled size onto a canvas and re-encode as WebP. Returns an object URL the
 * caller is responsible for revoking. Falls back to the original file's
 * object URL if anything in the decode/encode pipeline fails.
 *
 * This lets us accept 5–10MB phone photos: the cropper / bg-removal step
 * gets a manageable image instead of a 20MP buffer.
 */
export async function downscaleFileToObjectUrl(
  file: File,
  maxEdge: number,
  quality = 0.92,
): Promise<string> {
  const bitmap = await decodeToBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  if (longest <= maxEdge) {
    bitmap.close?.();
    return URL.createObjectURL(file);
  }

  const scale = maxEdge / longest;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return URL.createObjectURL(file);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) return URL.createObjectURL(file);
  return URL.createObjectURL(blob);
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respects EXIF orientation in modern browsers and
  // avoids the image-element flicker / async-load dance.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari < 16 throws on the imageOrientation option — retry plain.
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through */
      }
    }
  }
  // Fallback: decode via an <img>.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Adapt HTMLImageElement to the bitmap-ish shape we use above.
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => {},
      // drawImage accepts HTMLImageElement, so this works at the call site.
    } as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Run a dynamic-import once, and if it fails with the classic stale-deploy
 * "Failed to fetch dynamically imported module" error, retry once after a
 * short delay. If it still fails, hard-reload the page (once per session)
 * so the user lands on the new build instead of a broken state.
 */
export async function retryDynamicImport<T>(
  load: () => Promise<T>,
  attempts = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await load();
    } catch (err) {
      lastErr = err;
      if (!isChunkLoadError(err)) throw err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  // Last-ditch: stale chunk hashes mean the user's HTML references a
  // bundle that no longer exists. Force a reload, but guard against
  // reload loops with a sessionStorage flag.
  if (typeof window !== "undefined" && isChunkLoadError(lastErr)) {
    const key = "chunk-reload-attempted";
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    } catch {
      /* sessionStorage blocked — give up silently */
    }
  }
  throw lastErr;
}

export function isChunkLoadError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}
