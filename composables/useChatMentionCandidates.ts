import { ref } from "vue";
import type { ChatMentionCandidate } from "~/utilities/chatMentions";

export type ChatMentionCandidatesStatus = "loading" | "ready" | "failed";

interface RoomCandidates {
  status: ChatMentionCandidatesStatus;
  members: ChatMentionCandidate[];
}

// Asked for the first time @ is typed in a room and kept for the session. A
// failed load is asked for again on the next @.
const rooms = ref<Record<string, RoomCandidates>>({});
const loading = new Set<string>();

const roomKey = (type: string, id: string) => `${type}:${id}`;

export function useChatMentionCandidates() {
  function candidates(type: string, id: string): RoomCandidates | undefined {
    return rooms.value[roomKey(type, id)];
  }

  function set(key: string, value: RoomCandidates) {
    rooms.value = { ...rooms.value, [key]: value };
  }

  async function load(type: string, id: string) {
    const key = roomKey(type, id);

    if (rooms.value[key]?.status === "ready" || loading.has(key)) {
      return;
    }

    loading.add(key);
    set(key, { status: "loading", members: [] });

    try {
      const { members } = await $fetch<{ members: ChatMentionCandidate[] }>(
        `https://${useRuntimeConfig().public.apiDomain}/chat/rooms/${encodeURIComponent(type)}/${encodeURIComponent(id)}/members`,
        { credentials: "include" },
      );

      set(key, {
        status: "ready",
        members: (members ?? []).map((member) => ({
          ...member,
          steam_id: String(member.steam_id),
        })),
      });
    } catch {
      set(key, { status: "failed", members: [] });
    } finally {
      loading.delete(key);
    }
  }

  return { candidates, load };
}
