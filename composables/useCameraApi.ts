// The camera routes live on the API rather than the MediaMTX ingress: that
// ingress forward-auths against /streams/authorize, which is a different gate
// to "are you in this match". Every one of them carries the session — the phone
// that scanned the QR signs in like any other device, and the code itself is
// only a way of typing a URL.

import { deviceUrl } from "~/composables/useDeviceUrl";

function apiUrl(path: string) {
  return `https://${useRuntimeConfig().public.apiDomain}/matches/camera/${path}`;
}

export function cameraPlayerPath(matchId: string) {
  return `/matches/${matchId}/camera`;
}

// Absolute, because this is what goes into the QR code and a phone cannot
// resolve wherever the current tab happens to be served from. The popup on
// this computer uses cameraPlayerPath instead.
export function cameraPlayerJoinUrl(matchId: string) {
  return deviceUrl(`matches/${matchId}/camera`);
}

// Relative, like the setup popup: an organizer opening the grid is already on
// the app, and building this from the configured web domain sends them to
// whatever is deployed there rather than where they are.
export function cameraAdminGridPath(matchId: string) {
  return `/matches/${matchId}/camera-admin`;
}

export function cameraPlayerPublishUrl(matchId: string) {
  return apiUrl(`player/${matchId}/whip`);
}

export function cameraPlayerTalkUrl(matchId: string) {
  return apiUrl(`player/${matchId}/talk/whep`);
}

export function cameraAdminWatchUrl(matchId: string, steamId: string) {
  return apiUrl(`admin/${matchId}/${steamId}/whep`);
}

export function cameraAdminTalkUrl(matchId: string, steamId: string) {
  return apiUrl(`admin/${matchId}/${steamId}/talk/whip`);
}

export type CameraHealth = "live" | "stalled" | "down";

export type CameraPlayerStatus = {
  steamId: string;
  name: string | null;
  avatarUrl: string | null;
  lineupId: string;
  ready: boolean;
  // A "stalled" feed is still connected but has stopped delivering frames — it
  // looks identical to a working camera unless the grid says otherwise.
  health: CameraHealth;
  // Coaching this side rather than playing on it. Coaches publish a camera too:
  // during a technical timeout they are the one person who can coach out loud
  // without the server seeing it.
  coach: boolean;
};

export type CameraLineup = {
  id: string;
  name: string;
  players: Array<CameraPlayerStatus>;
};

async function readiness(url: string, credentials?: RequestCredentials) {
  try {
    const response = await fetch(url, { credentials });

    if (!response.ok) {
      return { ready: false };
    }

    return (await response.json()) as { ready: boolean };
  } catch {
    return { ready: false };
  }
}

export function fetchCameraStatus(matchId: string) {
  return readiness(apiUrl(`player/${matchId}/status`), "include");
}

export function fetchCameraTalkStatus(matchId: string) {
  return readiness(apiUrl(`player/${matchId}/talk/status`), "include");
}

export function fetchAdminTalkStatus(matchId: string, steamId: string) {
  return readiness(
    apiUrl(`admin/${matchId}/${steamId}/talk/status`),
    "include",
  );
}

export function hangupPlayerTalk(matchId: string) {
  return fetch(apiUrl(`player/${matchId}/talk/hangup`), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export function hangupAdminTalk(matchId: string, steamId: string) {
  return fetch(apiUrl(`admin/${matchId}/${steamId}/talk/hangup`), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export async function fetchCameraPlayers(matchId: string) {
  const response = await fetch(apiUrl(`admin/${matchId}/players`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  // One entry for an organizer (both sides); a competitor allowed to watch
  // their own team gets only theirs.
  return (await response.json()) as { lineups: Array<CameraLineup> };
}

// A bare fetch rejection is reported by every browser as "Failed to fetch",
// which tells nobody anything -- CORS, DNS, a refused connection and mixed
// content all look identical. Carry enough to tell them apart.
export class SignalingError extends Error {
  constructor(
    public readonly kind: "unreachable" | "http",
    public readonly url: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(
      kind === "unreachable"
        ? `could not reach ${url}: ${detail}`
        : `${url} responded ${status}: ${detail}`,
    );
    this.name = "SignalingError";
  }
}

// Shared by the player publish page and the admin call: offer, wait for ICE,
// POST the SDP, apply the answer.
export async function negotiateWebRtc(
  pc: RTCPeerConnection,
  url: string,
  credentials?: RequestCredentials,
) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      }
    });

    setTimeout(resolve, 1500);
  });

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
      },
      body: pc.localDescription?.sdp ?? "",
      credentials,
    });
  } catch (cause) {
    // application/sdp is not a CORS-safelisted content type, so this is a
    // preflighted request -- a blocked OPTIONS lands here too.
    throw new SignalingError(
      "unreachable",
      url,
      undefined,
      (cause as Error)?.message ?? String(cause),
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    // An ingress that has no route for this path answers with a full HTML
    // error page; quoting it back is noise, the status already said it.
    const detail = /^\s*</.test(body)
      ? response.statusText
      : body.trim().slice(0, 200);

    throw new SignalingError("http", url, response.status, detail);
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: await response.text(),
  });
}
