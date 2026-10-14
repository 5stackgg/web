// Kept in step with the api's match_streams_link_http check, so a link the
// form lets through is one the database takes.
const HTTP_LINK = /^https?:\/\//i;

export function isHttpLink(link: string | null | undefined): boolean {
  if (!link || !HTTP_LINK.test(link)) {
    return false;
  }

  try {
    new URL(link);
    return true;
  } catch {
    return false;
  }
}
