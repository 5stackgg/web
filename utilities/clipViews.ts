// The clip Worker (and the api's own clip stream) count a view whenever a GET
// reaches past the middle of the file, and a preload is such a GET. Requests
// marked `noview` are never counted, so a player that warms and plays from
// one marked URL keeps a single cache entry and reports the view itself.
export const CLIP_VIEW_FRACTION = 0.5;

export function clipPlaybackUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    url.searchParams.set("noview", "1");
    return url.toString();
  } catch {
    return downloadUrl;
  }
}

// A POST to the clip's own URL is the view. Deduped server-side per viewer,
// the same as a counted GET.
export function sendClipView(downloadUrl: string) {
  if (navigator.sendBeacon?.(downloadUrl)) {
    return;
  }

  void fetch(downloadUrl, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    keepalive: true,
  }).catch(() => {});
}
