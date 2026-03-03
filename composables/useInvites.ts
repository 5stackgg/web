import { computed } from "vue";

export function useInvites() {
  const matchInvites = computed(() => useMatchmakingStore().matchInvites);
  const lobbyInvites = computed(() => useMatchmakingStore().lobbyInvites);
  const friends = computed(() =>
    (useMatchmakingStore().friends as any[]).sort((a: any, b: any) => {
      return a.name.localeCompare(b.name);
    }),
  );
  const pendingFriends = computed(() =>
    friends.value?.filter((friend: any) => {
      return (
        friend.status === "Pending" &&
        friend.invited_by_steam_id !== useAuthStore().me?.steam_id
      );
    }),
  );

  const hasMatchInvites = computed(() => (matchInvites.value?.length ?? 0) > 0);
  const hasLobbyInvites = computed(() => (lobbyInvites.value?.length ?? 0) > 0);
  const hasPendingFriends = computed(
    () => (pendingFriends.value?.length ?? 0) > 0,
  );

  const hasInvites = computed(
    () =>
      hasMatchInvites.value || hasLobbyInvites.value || hasPendingFriends.value,
  );

  const hasSocialInvites = computed(
    () => hasMatchInvites.value || hasPendingFriends.value,
  );

  const totalCount = computed(
    () =>
      (matchInvites.value?.length ?? 0) +
      (lobbyInvites.value?.length ?? 0) +
      (pendingFriends.value?.length ?? 0),
  );

  return {
    matchInvites,
    lobbyInvites,
    pendingFriends,
    hasMatchInvites,
    hasLobbyInvites,
    hasPendingFriends,
    hasInvites,
    hasSocialInvites,
    totalCount,
  };
}
