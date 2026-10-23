// Every public.* setting, read with the admin secret for the server-rendered
// pages crawlers get (the app itself is a SPA). Cached for 10 minutes.

export type PublicSettings = Record<string, string | undefined>;

const SETTINGS_QUERY = `query PublicSettings {
  settings(where: { name: { _like: "public.%" } }) {
    name
    value
  }
}`;

export const loadPublicSettings = defineCachedFunction(
  async (): Promise<PublicSettings> => {
    const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
    const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
    if (!apiDomain || !adminSecret) return {};
    try {
      const res = await $fetch<{
        data?: { settings?: Array<{ name: string; value: string }> };
      }>(`https://${apiDomain}/v1/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret,
        },
        body: { query: SETTINGS_QUERY },
      });
      return Object.fromEntries(
        (res?.data?.settings ?? []).map((s) => [s.name, s.value]),
      );
    } catch (err) {
      console.error("[public-settings] settings fetch failed:", err);
      return {};
    }
  },
  { maxAge: 60 * 10, name: "public-settings", getKey: () => "all" },
);
