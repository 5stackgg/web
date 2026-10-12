// The clip Worker and the api's clip stream count a view for any GET that
// reaches past the middle of the file, and warming the next clip is such a
// GET. Both skip a request marked `noview`. Only the warm-up is marked: the
// player keeps the plain URL, so every deployed Worker counts real plays.
export function clipPreloadUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    url.searchParams.set("noview", "1");
    return url.toString();
  } catch {
    return downloadUrl;
  }
}
