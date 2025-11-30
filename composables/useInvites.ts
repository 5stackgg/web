import { computed } from "vue";

export function useInvites() {
  const matchInvites = computed(() => useMatchmakingStore().matchInvites);
  const lobbyInvites = computed(() => useMatchmakingStore().lobbyInvites);
  const friends = computed(() =>
    (useMatchmakingStore().friends as any[]).sort((a: any, b: any) => {
      return a.name.localeCompare(b.name);
    })
  );
  const pendingFriends = computed(() =>
    friends.value?.filter((friend: any) => {
      return (
        friend.status === "Pending" &&
        friend.invited_by_steam_id !== useAuthStore().me?.steam_id
      );
    })
  );
  const hasInvites = computed(
    () =>
      matchInvites.value.length > 0 ||
      lobbyInvites.value.length > 0 ||
      pendingFriends.value.length > 0
  );
  const totalCount = computed(
    () =>
      matchInvites.value.length +
      lobbyInvites.value.length +
      pendingFriends.value.length
  );

  return {
    matchInvites,
    lobbyInvites,
    pendingFriends,
    hasInvites,
    totalCount,
  };
}
