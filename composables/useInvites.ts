import { computed } from "vue";

export function useInvites() {
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

  const hasLobbyInvites = computed(() => (lobbyInvites.value?.length ?? 0) > 0);
  const hasPendingFriends = computed(
    () => (pendingFriends.value?.length ?? 0) > 0,
  );

  const hasInvites = computed(
    () => hasLobbyInvites.value || hasPendingFriends.value,
  );

  const hasSocialInvites = computed(() => hasPendingFriends.value);

  const totalCount = computed(
    () =>
      (lobbyInvites.value?.length ?? 0) + (pendingFriends.value?.length ?? 0),
  );

  return {
    lobbyInvites,
    pendingFriends,
    hasLobbyInvites,
    hasPendingFriends,
    hasInvites,
    hasSocialInvites,
    totalCount,
  };
}
