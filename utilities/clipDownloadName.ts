// Derive the filename the browser should suggest when downloading a
// clip. We can't lean on Content-Disposition alone — Chromium will
// silently fall back to the URL path's basename (the clip UUID) when
// the `<a download>` attribute has no value AND the response is
// cross-origin. Setting `download="<filename>"` explicitly forces the
// right name in every browser.
//
// Source priority:
//   1. `?name=` from the worker URL (computed by clip_download_url)
//   2. JS-side slug of the clip title
//   3. UUID-based fallback
export function clipDownloadName(clip: {
  id: string;
  title: string | null;
  download_url: string | null;
}): string {
  if (clip.download_url) {
    try {
      const u = new URL(clip.download_url);
      const fromQuery = u.searchParams.get("name");
      if (fromQuery) return fromQuery;
    } catch {
      // Bad URL — fall through to title/id paths.
    }
  }
  if (clip.title) {
    const slug = clip.title
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (slug) return `${slug}.mp4`;
  }
  return `clip-${clip.id.slice(0, 8)}.mp4`;
}
