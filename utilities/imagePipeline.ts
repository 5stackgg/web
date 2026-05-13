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
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => {},
    } as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  if (typeof window !== "undefined" && isChunkLoadError(lastErr)) {
    const key = "chunk-reload-attempted";
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    } catch {
      /* noop */
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
