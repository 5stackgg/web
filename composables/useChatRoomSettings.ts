import { ref, watch } from "vue";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { schemaHasField } from "~/utilities/schemaHasType";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "~/stores/AuthStore";
import { chatRoomSettingsThread } from "~/utilities/chatThread";
import { formatStartTime } from "~/utilities/watchEventCard";
import {
  chatRoomAlerts,
  chatRoomQuietAt,
  muteEndsAt,
  nextMuteExpiry,
  type ChatNotifyLevel,
  type ChatRoomQuiet,
  type ChatRoomSetting,
} from "~/utilities/chatRoomSettings";

// A player's mute and "notify me about" per room, kept on their account so
// every device agrees. The api's push gate reads the same rows; this side
// decides the badge, the sound and the tab flash.

const SUBSCRIPTION_KEY = "chat:room_settings";

// Raw documents: chat_room_settings is newer than the generated Zeus types.
const CHAT_ROOM_SETTINGS = gql`
  subscription ChatRoomSettings {
    chat_room_settings {
      thread
      muted
      muted_until
      notify
    }
  }
`;

// A length, not an end: the api ends the mute by its own clock, the one the
// push gate reads. Each write sets only its own columns, so a change of level
// leaves a running mute's end where it was.
const MUTE_CHAT_ROOM = gql`
  mutation MuteChatRoom(
    $thread: String!
    $muted: Boolean!
    $mute_minutes: Int
  ) {
    insert_chat_room_settings_one(
      object: { thread: $thread, muted: $muted, mute_minutes: $mute_minutes }
      on_conflict: {
        constraint: chat_room_settings_pkey
        update_columns: [muted, mute_minutes]
      }
    ) {
      thread
    }
  }
`;

const SET_CHAT_ROOM_NOTIFY = gql`
  mutation SetChatRoomNotify($thread: String!, $notify: String!) {
    insert_chat_room_settings_one(
      object: { thread: $thread, notify: $notify }
      on_conflict: {
        constraint: chat_room_settings_pkey
        update_columns: [notify]
      }
    ) {
      thread
    }
  }
`;

const settings = ref<Record<string, ChatRoomSetting>>({});
// False against an api that does not take a mute's length yet, which hides
// the controls and leaves every room as it always was.
const supported = ref(false);
// Moved on when a timed mute runs out, so whatever reads a room's quiet is
// worked out again at that moment and not on the next unrelated change.
const now = ref(Date.now());
let expiry: ReturnType<typeof setTimeout> | null = null;

// setTimeout overflows past this and fires at once.
const MAX_TIMEOUT_MS = 2_147_483_647;

function scheduleExpiry() {
  if (expiry) {
    clearTimeout(expiry);
    expiry = null;
  }

  const next = nextMuteExpiry(Object.values(settings.value), Date.now());

  if (next === null) {
    return;
  }

  expiry = setTimeout(
    () => {
      now.value = Date.now();
      scheduleExpiry();
    },
    Math.min(Math.max(next - Date.now(), 0) + 50, MAX_TIMEOUT_MS),
  );
}

watch(settings, () => {
  now.value = Date.now();
  scheduleExpiry();
});

function settingFor(type: string, lobbyId: string): ChatRoomSetting {
  return (
    settings.value[chatRoomSettingsThread(type, lobbyId)] ?? {
      muted: false,
      muted_until: null,
      notify: "all",
    }
  );
}

export function chatRoomQuiet(type: string, lobbyId: string): ChatRoomQuiet {
  return chatRoomQuietAt(
    settings.value[chatRoomSettingsThread(type, lobbyId)],
    now.value,
  );
}

export function chatTabQuiet(tab: { type: string; lobbyId?: string }) {
  return chatRoomQuiet(tab.type, tab.lobbyId ?? "");
}

export function chatRoomMutedLabel(
  quiet: ChatRoomQuiet,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  if (!quiet.muted) {
    return null;
  }

  return quiet.mutedUntil
    ? t("chat.room_settings.muted_until", {
        time: formatStartTime(quiet.mutedUntil),
      })
    : t("chat.room_settings.muted");
}

export function chatRoomRings(type: string, lobbyId: string, tagged: boolean) {
  return chatRoomAlerts(chatRoomQuiet(type, lobbyId), tagged);
}

async function write(
  type: string,
  lobbyId: string,
  next: Partial<ChatRoomSetting>,
  mutation: typeof MUTE_CHAT_ROOM,
  variables: Record<string, unknown>,
) {
  const thread = chatRoomSettingsThread(type, lobbyId);
  const previous = settings.value[thread];

  settings.value = {
    ...settings.value,
    [thread]: { ...settingFor(type, lobbyId), ...next },
  };

  try {
    await getGraphqlClient().mutate({
      mutation,
      variables: { thread, ...variables },
    });
  } catch (error) {
    const restored = { ...settings.value };

    if (previous) {
      restored[thread] = previous;
    } else {
      delete restored[thread];
    }

    settings.value = restored;
    throw error;
  }
}

export function muteChatRoom(
  type: string,
  lobbyId: string,
  minutes: number | null,
) {
  return write(
    type,
    lobbyId,
    { muted: true, muted_until: muteEndsAt(minutes, Date.now()) },
    MUTE_CHAT_ROOM,
    { muted: true, mute_minutes: minutes },
  );
}

export function unmuteChatRoom(type: string, lobbyId: string) {
  return write(
    type,
    lobbyId,
    { muted: false, muted_until: null },
    MUTE_CHAT_ROOM,
    { muted: false, mute_minutes: null },
  );
}

export function setChatRoomNotify(
  type: string,
  lobbyId: string,
  notify: ChatNotifyLevel,
) {
  return write(type, lobbyId, { notify }, SET_CHAT_ROOM_NOTIFY, { notify });
}

// Started on sign-in by the main window and by the chat pop-out, each of which
// is an app of its own. Follows the player's rooms live, so a mute set on one
// device quiets every other.
export async function syncChatRoomSettings(steamId: string) {
  const client = getGraphqlClient();

  if (!(await schemaHasField(client, "chat_room_settings", "mute_minutes"))) {
    return;
  }

  if (String(useAuthStore().me?.steam_id ?? "") !== String(steamId)) {
    return;
  }

  supported.value = true;

  useSubscriptionManager().subscribe(
    SUBSCRIPTION_KEY,
    client.subscribe({ query: CHAT_ROOM_SETTINGS }).subscribe({
      next: ({ data }) => {
        const rows: Array<ChatRoomSetting & { thread: string }> =
          (data as any)?.chat_room_settings ?? [];
        const next: Record<string, ChatRoomSetting> = {};

        for (const row of rows) {
          next[row.thread] = {
            muted: row.muted === true,
            muted_until: row.muted_until ?? null,
            notify: row.notify ?? "all",
          };
        }

        settings.value = next;
      },
    }),
  );
}

export function resetChatRoomSettings() {
  useSubscriptionManager().unsubscribe(SUBSCRIPTION_KEY);
  supported.value = false;
  settings.value = {};
}

export function useChatRoomSettings() {
  return { supported, settings };
}
