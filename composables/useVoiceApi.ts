// Voice rides the same API-proxied WebRTC path as player cameras, for the same
// reason: the MediaMTX ingress forward-auths against /streams/authorize, which
// is a different gate to "are you in this lobby". negotiateWebRtc is imported
// from useCameraApi at the call site rather than re-exported here, so Nuxt's
// auto-import registry only ever sees one binding for that name.
//
// Absolute, like every other API call in the app. These are preflighted (an
// application/sdp body is not CORS-safelisted), so the calling origin has to be
// in the API's allowlist -- set EXTRA_CORS_ORIGINS to develop from one that is
// not a configured domain.

function apiUrl(path: string) {
  return `https://${useRuntimeConfig().public.apiDomain}/voice/${path}`;
}

export function voicePublishUrl(lobbyId: string) {
  return apiUrl(`${lobbyId}/whip`);
}

export function voiceSubscribeUrl(lobbyId: string, steamId: string) {
  return apiUrl(`${lobbyId}/${steamId}/whep`);
}

export function voiceLeaveUrl(lobbyId: string) {
  return apiUrl(`${lobbyId}/leave`);
}

export type VoiceParticipant = {
  steamId: string;
  name: string | null;
  avatarUrl: string | null;
  speaking: boolean;
};

export async function fetchVoiceParticipants(lobbyId: string) {
  const response = await fetch(apiUrl(`${lobbyId}/participants`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as Array<VoiceParticipant>;
}
