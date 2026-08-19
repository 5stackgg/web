// The catalog stores an author as a display name, but every entry already
// carries a repository — either the homepage or a panel/variant "owner/name" —
// and its owner is the account that published it. Deriving the profile link
// from that avoids a second field that could drift out of step with the repo.
export function pluginAuthorUrl(plugin: Record<string, any>): string | null {
  const homepage: string | undefined = plugin?.homepage;

  if (homepage) {
    const match = homepage.match(
      /^https?:\/\/github\.com\/([^/]+)(?:\/|$)/i,
    );

    if (match) {
      return `https://github.com/${match[1]}`;
    }
  }

  const repo: string | undefined =
    plugin?.panel?.repo ??
    Object.values(plugin?.variants ?? {})[0]?.repo;

  if (repo && /^[^/]+\/[^/]+$/.test(repo)) {
    return `https://github.com/${repo.split("/")[0]}`;
  }

  return null;
}
