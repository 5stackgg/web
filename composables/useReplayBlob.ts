export type ReplayBlob = {
  schema_version: number;
  match_map_id: string;
  tick_rate: number;
  total_ticks: number;
  map_name: string | null;
  round_ticks: any[];
  players: any[];
  kills: any[];
  bombs: any[];
  kit_drops?: any[];
  positions: any[];
  shots_fired: any[];
  grenade_throws: any[];
  damages: any[];
};

export async function fetchReplayBlob(url: string): Promise<ReplayBlob | null> {
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`replay blob fetch failed: ${res.status}`);
  }
  if (!res.body) {
    throw new Error("replay blob response had no body");
  }
  const decompressed = res.body.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressed).text();
  return JSON.parse(text) as ReplayBlob;
}

export function normalizeBlobGrenades(grenades: any[]): any[] {
  return (grenades ?? []).map((g) => ({
    ...g,
    x: g.x == null ? 0 : Number(g.x),
    y: g.y == null ? 0 : Number(g.y),
    z: g.z == null ? 0 : Number(g.z),
  }));
}
