export type ChatNotifyLevel = "all" | "mentions" | "nothing";

export const CHAT_NOTIFY_LEVELS: readonly ChatNotifyLevel[] = [
  "all",
  "mentions",
  "nothing",
];

// In minutes; null holds until the player unmutes the room.
export const CHAT_MUTE_DURATIONS: ReadonlyArray<number | null> = [
  15,
  60,
  480,
  1440,
  null,
];

export interface ChatRoomSetting {
  muted: boolean;
  muted_until: string | null;
  notify: ChatNotifyLevel;
}

// What the setting means right now: a timed mute that has run out is no mute.
export interface ChatRoomQuiet {
  muted: boolean;
  mutedUntil: string | null;
  notify: ChatNotifyLevel;
}

export const LOUD_ROOM: ChatRoomQuiet = {
  muted: false,
  mutedUntil: null,
  notify: "all",
};

export function chatRoomQuietAt(
  setting: ChatRoomSetting | undefined,
  now: number,
): ChatRoomQuiet {
  if (!setting) {
    return LOUD_ROOM;
  }

  const until = setting.muted_until ? Date.parse(setting.muted_until) : null;
  const muted = setting.muted && (until === null || until > now);

  return {
    muted,
    mutedUntil: muted ? setting.muted_until : null,
    notify: setting.notify ?? "all",
  };
}

// The api's chat_room_notifies, which decides the push, says the same.
export function chatRoomAlerts(quiet: ChatRoomQuiet, tagged: boolean) {
  if (quiet.notify === "nothing") {
    return false;
  }

  if (tagged) {
    return true;
  }

  return quiet.notify === "all" && !quiet.muted;
}

export function nextMuteExpiry(
  settings: Iterable<ChatRoomSetting>,
  now: number,
): number | null {
  let next: number | null = null;

  for (const setting of settings) {
    if (!setting.muted || !setting.muted_until) {
      continue;
    }

    const until = Date.parse(setting.muted_until);

    if (until > now && (next === null || until < next)) {
      next = until;
    }
  }

  return next;
}

export function muteEndsAt(minutes: number | null, now: number) {
  return minutes === null
    ? null
    : new Date(now + minutes * 60_000).toISOString();
}
