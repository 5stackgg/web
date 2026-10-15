import { ref } from "vue";
import type { ChatMentionCandidate } from "~/utilities/chatMentions";

export type ChatMentionCandidatesStatus = "loading" | "ready" | "failed";

interface RoomCandidates {
  status: ChatMentionCandidatesStatus;
  members: ChatMentionCandidate[];
  loadedAt?: number;
}

// A room fills up while it is open, so a list older than this is asked for
// again on the next @, and shown as it was until the answer arrives.
const FRESH_MS = 60_000;

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
    const current = rooms.value[key];

    if (
      loading.has(key) ||
      (current?.status === "ready" &&
        Date.now() - (current.loadedAt ?? 0) < FRESH_MS)
    ) {
      return;
    }

    loading.add(key);

    if (current?.status !== "ready") {
      set(key, { status: "loading", members: [] });
    }

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
        loadedAt: Date.now(),
      });
    } catch {
      if (current?.status !== "ready") {
        set(key, { status: "failed", members: [] });
      }
    } finally {
      loading.delete(key);
    }
  }

  return { candidates, load };
}
