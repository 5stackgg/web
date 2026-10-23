// The whole 5Stack network's match and player counts, for 5stack.gg's welcome
// page. The fleet totals are admin-only, so they are read here with the admin
// secret and only these two numbers go out. Every other panel answers null.
const QUERY = `query NetworkStats {
  telemetryStats(includeSelf: true) {
    totals {
      matches
      playersRegistered
    }
  }
}`;

type NetworkStats = { matches: number; players: number } | null;

export default defineCachedEventHandler(
  async (): Promise<NetworkStats> => {
    const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;
    const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

    if (
      process.env.NUXT_PUBLIC_WEB_DOMAIN !== "5stack.gg" ||
      !apiDomain ||
      !adminSecret
    ) {
      return null;
    }

    try {
      const res = await $fetch<{
        data?: {
          telemetryStats?: {
            totals?: { matches?: number; playersRegistered?: number };
          };
        };
      }>(`https://${apiDomain}/v1/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret,
        },
        body: { query: QUERY },
      });
      const totals = res?.data?.telemetryStats?.totals;
      if (!totals?.matches) {
        return null;
      }
      return {
        matches: Number(totals.matches),
        players: Number(totals.playersRegistered ?? 0),
      };
    } catch (err) {
      console.error("[network-stats] telemetry fetch failed:", err);
      return null;
    }
  },
  { maxAge: 60 * 10, name: "network-stats", getKey: () => "all" },
);
