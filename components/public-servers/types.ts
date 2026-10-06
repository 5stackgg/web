import type { PingTier, RankableServer } from "~/utilities/publicServers";

// A server row from the subscription, joined with what the page learns about
// it elsewhere: players and map from the info poll, ping from the viewer's
// region probe.
export interface PublicServerView extends RankableServer {
  type: string;
  game: string;
  region: string;
  connection_link?: string | null;
  connection_string?: string | null;
  game_mode?: { slug: string; name: string } | null;
  server_region?: { is_lan: boolean } | null;
  // Raw map name (de_mirage), or "default" before the server reports one.
  map: string;
  isFull: boolean;
  tier: PingTier;
}
