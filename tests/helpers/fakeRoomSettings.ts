import { vi } from "vitest";
import type { ChatRoomSetting } from "~/utilities/chatRoomSettings";

export type RoomRow = ChatRoomSetting & { thread: string };

// The api as useChatRoomSettings sees it: introspection says the table is
// served, the subscription hands over the player's rows, and a write is
// recorded. `supported: false` is an api that predates the table.
export function fakeRoomSettingsClient() {
  let deliver: ((rows: RoomRow[]) => void) | null = null;

  const state = {
    supported: true,
    mutate: vi.fn(async (_options: any) => ({ data: {} })),
    subscriptions: 0,
  };

  const client = {
    query: vi.fn(async ({ variables }: any) => ({
      data: {
        __type:
          state.supported && variables?.name === "chat_room_settings"
            ? { name: "chat_room_settings", fields: [] }
            : null,
      },
    })),
    subscribe: vi.fn(() => ({
      subscribe: ({ next }: { next: (value: unknown) => void }) => {
        state.subscriptions += 1;
        deliver = (rows) => next({ data: { chat_room_settings: rows } });
        return {
          unsubscribe() {
            deliver = null;
          },
        };
      },
    })),
    mutate: (options: any) => state.mutate(options),
  };

  return {
    client,
    state,
    rooms(rows: RoomRow[]) {
      deliver?.(rows);
    },
    writes() {
      return state.mutate.mock.calls.map(([options]) => options.variables);
    },
  };
}

export function room(
  thread: string,
  over: Partial<ChatRoomSetting> = {},
): RoomRow {
  return { thread, muted: false, muted_until: null, notify: "all", ...over };
}
