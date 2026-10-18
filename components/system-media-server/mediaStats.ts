// The shape of GET /mediamtx/stats and what the Media Server page derives
// from it. Everything here is per kind: the api does not list paths or
// sessions one by one yet.

export type MediaKind =
  "gameStreams" | "playerCameras" | "voice" | "videoCalls" | "cameraTalkback";

export type MediaKindStats = {
  paths: number;
  // Actually publishing. A path can exist without a live publisher.
  ready: number;
  bytesReceived: number;
};

export type MediaStats = {
  paths: number;
  ready: number;
  // Null when MediaMTX answered for paths but not for sessions.
  webrtcSessions: number | null;
  byKind: Partial<Record<MediaKind, MediaKindStats>>;
};

// Ordered by how much attention each deserves rather than alphabetically:
// game streams are the heaviest, talk-back the rarest. Colours are the
// validated categorical data-viz set used for these kinds in the mock.
export const MEDIA_KINDS: Record<MediaKind, string> = {
  gameStreams: "#3987e5",
  playerCameras: "#d95926",
  voice: "#199e70",
  videoCalls: "#c98500",
  cameraTalkback: "#d55181",
};

const KIND_ORDER = Object.keys(MEDIA_KINDS) as MediaKind[];

export type MediaKindRow = MediaKindStats & {
  kind: MediaKind;
  // Share of all bytes received, 0..1.
  share: number;
};

// Kinds with at least one path, heaviest first by bytes received.
export function kindRows(stats: MediaStats): MediaKindRow[] {
  const used = KIND_ORDER.map((kind) => ({
    kind,
    paths: stats.byKind[kind]?.paths ?? 0,
    ready: stats.byKind[kind]?.ready ?? 0,
    bytesReceived: stats.byKind[kind]?.bytesReceived ?? 0,
  })).filter((row) => row.paths > 0);

  const total = used.reduce((sum, row) => sum + row.bytesReceived, 0);

  return used
    .map((row) => ({ ...row, share: total ? row.bytesReceived / total : 0 }))
    .sort(
      (a, b) =>
        b.bytesReceived - a.bytesReceived ||
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
    );
}

export function unusedKinds(stats: MediaStats): MediaKind[] {
  return KIND_ORDER.filter((kind) => !(stats.byKind[kind]?.paths ?? 0));
}

// A rolling window of the last `size` polls, for the tiles' lines.
export function pushHistory<T>(list: T[], value: T, size = 30): T[] {
  const next = [...list, value];
  return next.length > size ? next.slice(next.length - size) : next;
}
