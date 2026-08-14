// Voice rides the same API-proxied WebRTC path as player cameras, for the same
// reason: the MediaMTX ingress forward-auths against /streams/authorize, which
// is a different gate to "are you in this lobby". negotiateWebRtc is imported
// from useCameraApi at the call site rather than re-exported here, so Nuxt's
// auto-import registry only ever sees one binding for that name.
//
// Absolute, like every other API call in the app. These are preflighted (an
// application/sdp body is not CORS-safelisted), so the calling origin has to be
// one the API allows.

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

// A camera rides a path of its own rather than a second track on the microphone
// above: turning it on or off would otherwise renegotiate the audio publish and
// force every other member to re-subscribe, which is a drop-out in the middle of
// a call for a change that has nothing to do with the microphone.
export function voiceCamPublishUrl(lobbyId: string) {
  return apiUrl(`${lobbyId}/cam/whip`);
}

export function voiceCamSubscribeUrl(lobbyId: string, steamId: string) {
  return apiUrl(`${lobbyId}/${steamId}/cam/whep`);
}

export function voiceCamStopUrl(lobbyId: string) {
  return apiUrl(`${lobbyId}/cam/stop`);
}

export type VoiceParticipant = {
  steamId: string;
  name: string | null;
  avatarUrl: string | null;
  // In the call: has a live microphone published. The gate mutes by gain rather
  // than by dropping the track, so this does not flicker with speech.
  connected: boolean;
  // Talking right now, as reported by their own gate over the socket.
  speaking: boolean;
  // Coaching this lineup rather than playing on it.
  coach: boolean;
  // Publishing a camera as well. Independent of `connected`: being in the call
  // and being on camera are separate choices, and either can be true alone.
  video: boolean;
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
