// Chromium falls back to the URL basename (clip UUID) for cross-origin
// downloads when `<a download>` has no value, so always set it explicitly.
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
      // fall through
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

// Append `dl=1` so the worker forces Content-Disposition: attachment.
export function clipDownloadUrl(downloadUrl: string): string {
  try {
    const u = new URL(downloadUrl);
    u.searchParams.set("dl", "1");
    return u.toString();
  } catch {
    return downloadUrl;
  }
}
